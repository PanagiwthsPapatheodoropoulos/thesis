"""
api/assignment.py - AI-Powered Task Assignment and Resource Optimization.
This module provides endpoints for matching the most suitable employees to tasks
based on skill sets, current workload, experience, and organizational constraints.
It supports single-task suggestions and multi-task bulk optimization.
"""

from fastapi import APIRouter, HTTPException, Header, Request
from typing import List, Optional, Dict
import logging
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.models.assignment_model import TaskAssignmentModel
from app.core.backend_client import backend_client
from app.core.redis_client import redis_client
from app.models.constraint_solver import solve_optimal_assignments

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================

class AssignmentSuggestion(BaseModel):
    """
    Data model for a single employee assignment recommendation.
    
    Attributes:
        employeeId (str): Unique identifier of the candidate.
        employeeName (str): Full name of the candidate.
        position (Optional[str]): Current job title.
        fitScore (float): Normalized compatibility score (0 to 1).
        confidenceScore (float): AI's certainty in the recommendation.
        reasoning (str): Natural language explanation for the match.
        availableHours (Optional[int]): Estimated remaining capacity for the week.
        workloadWarning (Optional[str]): Visual alert text for high/overload states.
        workloadStatus (Optional[str]): Categorical status (red, orange, green, blue).
    """
    employeeId: str
    employeeName: str
    position: Optional[str] = None
    fitScore: float
    confidenceScore: float
    reasoning: str
    availableHours: Optional[int] = None
    workloadWarning: Optional[str] = None
    workloadStatus: Optional[str] = None
    components: Optional[Dict[str, float]] = None


class TaskAssignmentRequest(BaseModel):
    """
    Parameters for requesting individual task assignment suggestions.
    
    Attributes:
        task_id (str): The task to find candidates for.
        task_title (str): Brief title used for contextual matching.
        description (Optional[str]): Full requirements for deeper NLP analysis.
        priority (str): Importance level (LOW to CRITICAL).
        estimated_hours (Optional[float]): Required time commitment.
        required_skill_ids (List[str]): Skill requirements to match against.
        complexity_score (Optional[float]): Task difficulty multiplier.
        team_id (Optional[str]): Optional filter to limit search to a specific team.
        top_n (int): Maximum number of candidates to return.
    """
    task_id: str
    task_title: str
    description: Optional[str] = None
    priority: str = "MEDIUM"
    estimated_hours: Optional[float] = None
    required_skill_ids: List[str] = Field(default_factory=list)
    complexity_score: Optional[float] = 0.5
    team_id: Optional[str] = None
    top_n: int = 5


class BulkAssignmentRequest(BaseModel):
    """
    Parameters for multi-task assignment optimization.
    
    Attributes:
        task_ids (List[str]): Collection of tasks to assign simultaneously.
        optimize_workload (bool): Whether to focus on overall team balance.
    """
    task_ids: List[str]
    optimize_workload: bool = True


class AssignmentResponse(BaseModel):
    """
    The results container for task assignment suggestions.
    
    Attributes:
        task_id (str): Reference to the requested task.
        suggestions (List[AssignmentSuggestion]): Ranked candidate list.
        total_candidates (int): Total count of valid employees considered.
    """
    task_id: str
    suggestions: List[AssignmentSuggestion]
    total_candidates: int


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/suggest", response_model=AssignmentResponse)
@limiter.limit("10/minute")
async def suggest_assignment(
    request: Request,
    assignment_request: TaskAssignmentRequest,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Retrieves prioritized employee recommendations for a specific task.
    Uses a weighted model considering skill match, availability, and seniority.
    
    Args:
        request (Request): FastAPI request object for rate limiting.
        assignment_request (TaskAssignmentRequest): Details of the task to be assigned.
        authorization (str): Authentication token.
        x_company_id (str): Org identifier.
        
    Returns:
        AssignmentResponse: Ranked list of candidates.
    """
    token = authorization.replace("Bearer ", "")
    
    try:
        # Step 1: Resource Discovery - Fetch potential candidates from the company pool
        all_employees = await backend_client.get_employees(x_company_id, token, fetch_all=True)
        
        if not all_employees:
            raise HTTPException(status_code=404, detail="Organizational directory is empty")
        
        # Step 2: Geographic/Team Filtering - Narrow down the pool if a team constraint is set
        if assignment_request.team_id:
            all_users = await backend_client.get_users(x_company_id, token)
            team_user_ids = {u['id'] for u in all_users if u.get('teamId') == assignment_request.team_id}
            employees = [e for e in all_employees if e.get('userId') in team_user_ids]
        else:
            employees = all_employees
        
        # Step 3: Capacity Analysis - Fetch real-time workload stats to avoid burnout
        workload_data = await backend_client.get_employee_workload(x_company_id, token)
        workload_map = {w['employeeId']: w for w in workload_data}
        
        # Step 4: Data Enrichment - Build a multidimensional profile for each candidate
        enriched_employees = []
        for emp in employees:
            skills = await backend_client.get_employee_skills(emp['id'], token, x_company_id)
            workload_info = workload_map.get(emp['id'], {})
            workload_pct = workload_info.get('workloadPercentage', 0)

            # Sanitize workload data points
            if workload_pct is None or workload_pct != workload_pct or workload_pct < 0:
                workload_pct = 0

            # Calculate actual headroom (hours) based on weekly limits
            max_hours = emp.get('maxWeeklyHours', 40)
            used_hours = (float(workload_pct) / 100.0) * max_hours
            available_hours = max(0, max_hours - used_hours)

            enriched_employees.append({
                'id': emp['id'],
                'first_name': emp['firstName'],
                'last_name': emp['lastName'],
                'position': emp.get('position'),
                'skills': skills,
                'active_tasks': workload_info.get('activeTasks', 0),
                'max_weekly_hours': max_hours,
                'years_experience': emp.get('yearsOfExperience', 0),
                'workload_percentage': float(workload_pct),
                'available_hours': int(available_hours)
            })
        
        # Step 5: Matching Logic - Execute the scoring model for each candidate
        task_data = {
            'id': assignment_request.task_id,
                 'title': assignment_request.task_title,
                 'priority': assignment_request.priority,
                 'required_skills': assignment_request.required_skill_ids,
                 'complexity_score': assignment_request.complexity_score
        }
        
        model = TaskAssignmentModel(x_company_id)
        suggestions = []
        
        for emp in enriched_employees:
            fit_score, confidence, components = model.calculate_fit_score(task_data, emp)

            # Filtering: Skip candidates with zero skill intersection to maintain relevance quality
            skill_details = components.get('skill_details', {})
            if len(task_data.get('required_skills', [])) > 0 and skill_details.get('coverage', 0) == 0:
                continue
            
            # Minimum threshold to prevent listing 'random' employees for niche tasks
            if fit_score < 0.25:
                continue
            
            # Determine visual status flags based on utilization percentage
            workload_pct = emp.get('workload_percentage', 0)
            if workload_pct > 100:
                status, color = "⚠️ OVERLOADED", "red"
            elif workload_pct > 85:
                status, color = "⚠️ HIGH WORKLOAD", "orange"
            elif workload_pct < 50:
                status, color = "✅ AVAILABLE", "green"
            else:
                status, color = "✅ OPTIMAL", "blue"

            # Contextual explanation generation (XAI)
            reasoning = model._generate_reasoning(task_data, emp, fit_score, components)

            suggestions.append({
                'employeeId': emp['id'],
                'employeeName': f"{emp['first_name']} {emp['last_name']}",
                'position': emp['position'],
                'fitScore': fit_score,
                'confidenceScore': confidence,
                'reasoning': reasoning,
                'availableHours': emp['available_hours'],
                'workloadWarning': f"{status} ({workload_pct:.0f}% current capacity)",
                'workloadStatus': color,
                'components': {
                    'skill': round(components.get('skill_score', 0) * 100, 1),
                    'workload': round(components.get('workload_score', 0) * 100, 1),
                    'experience': round(components.get('experience_score', 0) * 100, 1)
                }
            })

        # Step 6: Ranking - Primary sort by skill/fit score, secondary by availability
        suggestions.sort(key=lambda x: (-x['fitScore'], -x['availableHours']))

        return {
            'task_id': assignment_request.task_id,
            'suggestions': suggestions[:assignment_request.top_n],
            'total_candidates': len(suggestions)
        }
        
    except Exception as e:
        logger.error(f"Assignment suggestion error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal processing error during assignment matching")


@router.post("/bulk-optimize")
async def bulk_optimize_assignments(
    request: BulkAssignmentRequest,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Executes a multi-task optimization using a Genetic Algorithm (GA).
    This seeks a global 'Pareto Optimal' state where tasks are assigned to the 
    best-fit employees while minimizing team-wide variance in workload.
    
    Args:
        request (BulkAssignmentRequest): List of tasks to optimize.
        authorization (str): Auth token.
        x_company_id (str): Org ID.
        
    Returns:
        dict: A collection of optimal assignments.
    """    
    token = authorization.replace("Bearer ", "")
    
    try:
        # Step 1: Global State Collection
        employees = await backend_client.get_employees(x_company_id, token)
        tasks = await backend_client.get_tasks(x_company_id, token)
        
        task_map = {t['id']: t for t in tasks}
        target_tasks = [task_map[tid] for tid in request.task_ids if tid in task_map]
        
        if not target_tasks:
            raise HTTPException(status_code=404, detail="None of the requested task IDs exist")
        
        # Step 2: Resource Inventory
        enriched_employees = []
        for emp in employees:
            skills = await backend_client.get_employee_skills(emp['id'], token)
            enriched_employees.append({
                'id': emp['id'],
                'first_name': emp['firstName'],
                'last_name': emp['lastName'],
                'skills': skills,
                'max_weekly_hours': emp.get('maxWeeklyHours', 40),
            })
        
        # Step 3: Simulation Phase - Pre-calculate fitness for all (T * E) combinations
        model = TaskAssignmentModel(x_company_id)
        pre_calculated = {}
        
        for task in target_tasks:
            task_id = task['id']
            pre_calculated[task_id] = {}
            
            # Resolve skill IDs to readable names for better AI context matching
            raw_skill_ids = task.get('requiredSkillIds', [])
            skill_id_to_name = {}
            if raw_skill_ids:
                try:
                    skill_id_to_name = await backend_client.get_skills_by_ids(raw_skill_ids, token, x_company_id)
                except Exception: pass
            
            skill_names = [skill_id_to_name.get(sid, sid) for sid in raw_skill_ids]
            task_repr = {
                'id': task_id, 'title': task['title'],
                'priority': task.get('priority', 'MEDIUM'),
                'required_skills': skill_names,
                'complexity_score': task.get('complexityScore', 0.5)
            }
            
            for emp in enriched_employees:
                fit_score, _, _ = model.calculate_fit_score(task_repr, emp)
                pre_calculated[task_id][emp['id']] = fit_score
        
        # Step 4: Optimization Strategy - Apply Genetic Algorithm or Greedy matching
        if request.optimize_workload:
            # GA looks for 'Fairness' (balance) across the group
            assignments = model.genetic_algorithm_optimize(target_tasks, enriched_employees, pre_calculated)
        else:
            # Greedy simply takes the best person for each task without looking at others
            assignments = []
            for task in target_tasks:
                best_emp = max(enriched_employees, key=lambda e: pre_calculated[task['id']][e['id']])
                assignments.append({
                    'task_id': task['id'],
                    'task_title': task['title'],
                    'employee_id': best_emp['id'],
                    'employee_name': f"{best_emp['first_name']} {best_emp['last_name']}",
                    'fit_score': pre_calculated[task['id']][best_emp['id']],
                    'confidence_score': 0.75,
                    'reasoning': 'Greedy best-fit assignment'
                })
        
        return {
            'total_tasks': len(request.task_ids),
            'assignments': assignments,
            'optimization_method': 'genetic_algorithm' if request.optimize_workload else 'greedy'
        }
        
    except Exception as e:
        logger.error(f"Bulk optimization error: {str(e)}")
        raise HTTPException(status_code=500, detail="Optimization engine failure")


@router.post("/bulk-optimize-balanced")
async def bulk_optimize_balanced(
    request: BulkAssignmentRequest,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Executes a high-precision optimization using Constraint Programming (CP).
    Best for hard constraints where workload limits MUST NOT be exceeded.
    
    Args:
        request (BulkAssignmentRequest): Dataset for assignment.
        authorization (str): Auth.
        x_company_id (str): Org ID.
        
    Returns:
        dict: Solved assignment matrix.
    """
    token = authorization.replace("Bearer ", "")
    
    try:
        # Preparation: Assemble the global constraint variable space
        tasks = await backend_client.get_tasks(x_company_id, token)
        employees = await backend_client.get_employees(x_company_id, token)
        target_tasks = [t for t in tasks if t['id'] in request.task_ids]
        
        for emp in employees:
            emp['skills'] = await backend_client.get_employee_skills(emp['id'], token, x_company_id)
        
        # Execution: Solve the linear assignment problem with satisfaction constraints
        assignments = solve_optimal_assignments(
            target_tasks,
            employees,
            weights={'skill_match': 0.5, 'workload_balance': 0.3, 'priority': 0.2}
        )
        
        return {
            'total_tasks': len(request.task_ids),
            'assignments': assignments,
            'optimization_method': 'constraint_programming'
        }
    except Exception as e:
        logger.error(f"CP optimization failure: {str(e)}")
        raise HTTPException(status_code=500, detail="Constraint solver failure")


@router.delete("/cache/{task_id}")
async def invalidate_assignment_cache(
    task_id: str,
    x_company_id: str = Header(...)
):
    """
    Clears cached assignment recommendations for a modified task.
    Ensures the next suggestion request pulls fresh data from the backend.
    
    Args:
        task_id (str): Target task identifier.
        x_company_id (str): Org identifier for Redis keying.
        
    Returns:
        dict: Status message confirming cache clearance.
    """
    cache_key = f"assignment:{task_id}"
    await redis_client.delete(x_company_id, cache_key)
    return {"message": f"Cache invalidated for task {task_id}"}
