# ai_service/app/api/analytics.py
"""
api/analytics.py - Real-time Analytics with Proper Cache Busting.
This module provides endpoints for generating productivity metrics, employee performance
rankings, and skill-based insights using data from the core backend.
"""
from fastapi import APIRouter, Header
from typing import List, Optional
import logging
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
import numpy as np
import re

from app.core.backend_client import backend_client
from app.core.redis_client import redis_client

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================
# MODELS
# ============================================================

class AnalyticsRequest(BaseModel):
    """
    Data model for an analytics generation request.
    
    Attributes:
        time_period_days (int): The number of days looking back for historical data. Defaults to 30.
        bust_cache (bool): Whether to bypass existing cache and force recalculation. Defaults to False.
    """
    time_period_days: int = Field(default=30, ge=1, le=365)
    bust_cache: bool = False


class ProductivityMetrics(BaseModel):
    """
    Aggregated company-wide productivity metrics.
    
    Attributes:
        avg_completion_time (float): Average hours taken to complete tasks.
        task_completion_rate (float): Ratio of completed tasks to total tasks created.
        on_time_delivery_rate (float): Percentage of tasks finished before or on the due date.
        avg_task_variance (float): Average percentage difference between estimated and actual hours.
        total_tasks_completed (int): Absolute count of finished tasks.
        total_tasks_overdue (int): Count of non-completed tasks past their due date.
        avg_skill_utilization (float): Ratio of distinct skills used in tasks vs available in the company.
        skill_diversity_score (float): Measure of skill variety across completed tasks.
    """
    avg_completion_time: float
    task_completion_rate: float
    on_time_delivery_rate: float
    avg_task_variance: float
    total_tasks_completed: int
    total_tasks_overdue: int
    avg_skill_utilization: float
    skill_diversity_score: float


class EmployeeProductivity(BaseModel):
    """
    Productivity metrics for an individual employee.
    
    Attributes:
        employee_id (str): Unique identifier of the employee.
        employee_name (str): Full name of the employee.
        tasks_completed (int): Number of tasks completed by this individual.
        avg_completion_time (float): Personal average task duration.
        on_time_rate (float): Individual punctuality percentage.
        productivity_score (float): Computed composite score (0-100).
        skills_utilized (int): Count of distinct skills applied in completed tasks.
        skill_efficiency (float): Ratio of tasks completed where the employee had matching skills.
    """
    employee_id: str
    employee_name: str
    tasks_completed: int
    avg_completion_time: float
    on_time_rate: float
    productivity_score: float
    skills_utilized: int
    skill_efficiency: float


class SkillInsight(BaseModel):
    """
    Insights into skill supply and demand across the organization.
    
    Attributes:
        skill_name (str): The name or ID of the skill.
        usage_count (int): How many tasks (active or completed) required this skill.
        avg_proficiency (float): Average proficiency level among employees having this skill.
        demand_level (str): Categorical demand (LOW, MEDIUM, HIGH).
    """
    skill_name: str
    usage_count: int
    avg_proficiency: float
    demand_level: str


class AnalyticsResponse(BaseModel):
    """
    The full analytical report for the organization.
    
    Attributes:
        company_metrics (ProductivityMetrics): Global performance indicators.
        top_performers (List[EmployeeProductivity]): Ranked list of high-achieving employees.
        skill_insights (List[SkillInsight]): Summary of organizational skill landscape.
        recommendations (List[str]): AI-generated actionable advice based on metrics.
        generated_at (str): ISO timestamp of when the report was compiled.
    """
    company_metrics: ProductivityMetrics
    top_performers: List[EmployeeProductivity]
    skill_insights: List[SkillInsight]
    recommendations: List[str]
    generated_at: str


# ============================================================
# UTILITIES
# ============================================================
def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """
    Robustly parses Java LocalDateTime strings into Python datetime objects.
    Handles ISO formats, 'Z' suffix, and fractional second micro-variations.
    
    Args:
        date_str (Optional[str]): The date string to parse.
    Returns:
        Optional[datetime]: Parsed datetime object or None if parsing fails.
    """
    if not date_str:
        return None
    
    try:
        # Standardize UTC indicator
        date_str = date_str.replace('Z', '+00:00')
        return datetime.fromisoformat(date_str)
    except ValueError:
        try:
            # Handle non-standard fractional seconds by padding to 6 digits
            def pad_fraction(match):
                fraction = match.group(1)
                if len(fraction) > 6:
                    return f".{fraction[:6]}"
                return f".{fraction.ljust(6, '0')}"
            
            normalized_str = re.sub(r'\.(\d+)', pad_fraction, date_str)
            return datetime.fromisoformat(normalized_str)
        except Exception:
            return None


# MAIN ENDPOINT
@router.post("/productivity", response_model=AnalyticsResponse)
async def get_productivity_analytics(
    request: AnalyticsRequest,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Generates a comprehensive productivity report for a company.
    This endpoint aggregates data across tasks, workloads, and employee skills
    to provide high-level insights and specific actionable recommendations.
    
    Args:
        request (AnalyticsRequest): Parameters for the report (period, cache control).
        authorization (str): Bearer token for authentication.
        x_company_id (str): Company identifier for data isolation.
        
    Returns:
        AnalyticsResponse: The computed analytical report.
    """
    token = authorization.replace("Bearer ", "")
    
    # Attempt to retrieve from cache to ensure low latency for frequent dashboard views
    cache_key = f"analytics:v2:{request.time_period_days}d"
    
    if not request.bust_cache:
        cached = await redis_client.get(x_company_id, cache_key)
        if cached:
            # Ensure the response has a valid timestamp even when served from cache
            if isinstance(cached, dict) and 'generated_at' not in cached:
                cached['generated_at'] = datetime.now().isoformat()
            return cached
    else:
        logger.info("Cache busting triggered - bypassing Redis and fetching fresh data")
    
    try:
        # Fetch raw data from core service. fetch_all=True ensures we don't miss records 
        # due to pagination, which is critical for accurate statistical reporting.
        tasks = await backend_client.get_tasks(
            x_company_id, 
            token, 
            fetch_all=True
        )
        workload = await backend_client.get_employee_workload(
            x_company_id, 
            token,
            fetch_all=True
        )
        employees = await backend_client.get_employees(
            x_company_id, 
            token,
            fetch_all=True
        )
        
        # Calculate time horizon based on request parameters
        cutoff_date = datetime.now() - timedelta(days=request.time_period_days)
        
        # Filtering tasks to only include those relevant to the current analytical period
        recent_tasks = []
        for t in tasks:
            created_at_str = t.get('createdAt')
            if created_at_str:
                dt = parse_date(created_at_str)
                if dt and dt.replace(tzinfo=None) >= cutoff_date.replace(tzinfo=None):
                    recent_tasks.append(t)
                
        # Exclude synthetic automation tasks or draft requests from productivity analysis
        actual_tasks = [
            t for t in recent_tasks
            if not t.get('title', '').startswith('[REQUEST]') and
            not t.get('isEmployeeRequest', False)
        ]
                
        # Enrich the employee dataset with technical skills for utilization analysis
        try:
            employee_ids = [emp['id'] for emp in employees]
            
            # Execute batch fetch for efficiency
            all_skills = await backend_client.get_all_employee_skills_batch(
                employee_ids,
                token,
                x_company_id
            )
            
            # Map skills back to employee records
            for emp in employees:
                emp['skills'] = all_skills.get(emp['id'], {})
            
        except Exception:
            # Fallback to individual calls if batch extraction fails
            for emp in employees:
                emp['skills'] = await backend_client.get_employee_skills(
                    emp['id'], token, x_company_id
                ) or {}
        
        # Compute hierarchical metrics
        company_metrics = _calculate_company_metrics(actual_tasks, employees)
        top_performers = _calculate_employee_productivity(actual_tasks, workload, employees)
        skill_insights = _calculate_skill_insights(actual_tasks, employees)
        recommendations = _generate_recommendations(
            company_metrics, 
            top_performers, 
            skill_insights
        )
        
        generated_at = datetime.now().isoformat()
        
        response = {
            'company_metrics': company_metrics,
            'top_performers': top_performers[:10], # Return top 10 for dashboard space efficiency
            'skill_insights': skill_insights,
            'recommendations': recommendations,
            'generated_at': generated_at
        }
        
        # Update Redis cache with the newly computed report
        cache_ttl = 60 if not request.bust_cache else 30
        await redis_client.set(
            x_company_id,
            cache_key,
            response,
            ttl=cache_ttl
        )
        
        return response
        
    except Exception as e:
        logger.error(f"Failed to generate analytics: {str(e)}")
        # Return a safe, empty structure to prevent frontend crashes during processing errors
        return AnalyticsResponse(
            company_metrics={
                'avg_completion_time': 0, 'task_completion_rate': 0, 
                'on_time_delivery_rate': 0, 'avg_task_variance': 0,
                'total_tasks_completed': 0, 'total_tasks_overdue': 0,
                'avg_skill_utilization': 0, 'skill_diversity_score': 0
            },
            top_performers=[],
            skill_insights=[],
            recommendations=["Data processing error - check system logs for details"],
            generated_at=datetime.now().isoformat()
        )


# CALCULATION FUNCTIONS

def _calculate_company_metrics(tasks: List[dict], employees: List[dict]) -> dict:
    """
    Computes global performance indicators for the entire organization.
    
    Args:
        tasks (List[dict]): List of relevant task records.
        employees (List[dict]): List of employee records with skills.
        
    Returns:
        dict: Aggregated organizational metrics.
    """
    completed_tasks = [t for t in tasks if t.get('status') == 'COMPLETED']
    
    if not tasks:
        return {
            'avg_completion_time': 0, 'task_completion_rate': 0,
            'on_time_delivery_rate': 0, 'avg_task_variance': 0,
            'total_tasks_completed': 0, 'total_tasks_overdue': 0,
            'avg_skill_utilization': 0, 'skill_diversity_score': 0
        }
    
    completion_times = []
    variances = []
    on_time_count = 0
    
    # Process completed tasks for temporal performance
    for task in completed_tasks:
        actual_hours = task.get('actualHours')
        if actual_hours is not None and actual_hours > 0:
            completion_times.append(float(actual_hours))
            
            # Calculate estimation accuracy variance
            if task.get('estimatedHours'):
                est = float(task['estimatedHours'])
                act = float(task['actualHours'])
                if est > 0:
                    variance = (act - est) / est
                    variances.append(variance)
        
        # Check punctuality against due dates
        completed_at = parse_date(task.get('completedDate'))
        due_at = parse_date(task.get('dueDate'))
        
        if completed_at and due_at:
            if completed_at.replace(tzinfo=None) <= due_at.replace(tzinfo=None):
                on_time_count += 1
    
    # Count backlog items that are currently past their due date
    overdue_tasks = 0
    now = datetime.now()
    for t in tasks:
        if t.get('status') != 'COMPLETED':
            due_at = parse_date(t.get('dueDate'))
            if due_at and due_at.replace(tzinfo=None) < now:
                overdue_tasks += 1
    
    # Skill Utilization Analysis
    all_employee_skill_ids = set()
    for emp in employees:
        all_employee_skill_ids.update(emp.get('skills', {}).keys())

    skills_used_in_tasks = set()
    for task in completed_tasks:
        if task.get('requiredSkillIds'):
            skills_used_in_tasks.update(task['requiredSkillIds'])

    skill_utilization = (
        len(skills_used_in_tasks.intersection(all_employee_skill_ids)) / len(all_employee_skill_ids)
        if all_employee_skill_ids else 0
    )
    
    skill_diversity = (
        len(skills_used_in_tasks) / len(completed_tasks) 
        if completed_tasks else 0
    )
    
    avg_completion = float(np.mean(completion_times)) if len(completion_times) > 0 else 0.0

    return {
        'avg_completion_time': round(avg_completion, 2),
        'task_completion_rate': len(completed_tasks) / len(tasks) if tasks else 0,
        'on_time_delivery_rate': on_time_count / len(completed_tasks) if completed_tasks else 0,
        'avg_task_variance': float(np.mean(variances)) if variances else 0,
        'total_tasks_completed': len(completed_tasks),
        'total_tasks_overdue': overdue_tasks,
        'avg_skill_utilization': round(skill_utilization, 3),
        'skill_diversity_score': round(skill_diversity, 3)
    }


def _calculate_employee_productivity(
    tasks: List[dict], 
    workload: List[dict],
    employees: List[dict]
) -> List[dict]:
    """
    Computes fine-grained productivity scores for each individual employee.
    
    Args:
        tasks (List[dict]): Task records.
        workload (List[dict]): Workload distribution data.
        employees (List[dict]): Employee profile data.
        
    Returns:
        List[dict]: Individual performance metrics, sorted by score.
    """
    employee_stats = {}
    emp_lookup = {emp['id']: emp for emp in employees}
    
    # Trace task completion back to specific employees through assignments
    for task in tasks:
        if task.get('status') == 'COMPLETED' and task.get('assignments'):
            for assignment in task['assignments']:
                emp_id = assignment.get('employeeId')
                if not emp_id:
                    continue
                
                if emp_id not in employee_stats:
                    employee_stats[emp_id] = {
                        'employee_id': emp_id,
                        'employee_name': assignment.get('employeeName', 'Unknown'),
                        'completed_tasks': [],
                        'on_time_count': 0,
                        'skills_utilized': set(),
                        'skill_matches': 0,
                        'total_skill_checks': 0
                    }
                
                employee_stats[emp_id]['completed_tasks'].append(task)
                
                # Assess skill usage and suitability matching
                if task.get('requiredSkillIds'):
                    employee_stats[emp_id]['skills_utilized'].update(task['requiredSkillIds'])
                    employee_stats[emp_id]['total_skill_checks'] += 1
                    
                    emp_data = emp_lookup.get(emp_id, {})
                    emp_skills = emp_data.get('skills', {})
                    
                    required_skills = set(task['requiredSkillIds'])
                    has_skills = required_skills.intersection(set(emp_skills.keys()))
                    
                    if has_skills:
                        employee_stats[emp_id]['skill_matches'] += 1
                
                # Evaluate punctuality
                completed = parse_date(task.get('completedDate'))
                due = parse_date(task.get('dueDate'))
                if completed and due and completed.replace(tzinfo=None) <= due.replace(tzinfo=None):
                    employee_stats[emp_id]['on_time_count'] += 1
    
    results = []
    for emp_id, stats in employee_stats.items():
        completed_count = len(stats['completed_tasks'])
        
        avg_time = 0
        if stats['completed_tasks']:
            times = [
                float(t.get('actualHours', 0)) 
                for t in stats['completed_tasks'] 
                if t.get('actualHours')
            ]
            avg_time = np.mean(times) if times else 0
        
        on_time_rate = stats['on_time_count'] / completed_count if completed_count > 0 else 0
        skill_efficiency = stats['skill_matches'] / stats['total_skill_checks'] if stats['total_skill_checks'] > 0 else 0
        
        # Scoring logic heavily weighted toward completion and timeliness
        skill_diversity_bonus = min(len(stats['skills_utilized']) * 2, 10)
        skill_efficiency_bonus = skill_efficiency * 10
        
        productivity_score = (
            (completed_count / 10) * 30 +
            on_time_rate * 40 +
            (1 - min(avg_time / 40, 1)) * 20 +
            skill_diversity_bonus +
            skill_efficiency_bonus
        )
        
        results.append({
            'employee_id': emp_id,
            'employee_name': stats['employee_name'],
            'tasks_completed': completed_count,
            'avg_completion_time': round(avg_time, 1),
            'on_time_rate': round(on_time_rate, 2),
            'productivity_score': round(min(productivity_score, 100), 1),
            'skills_utilized': len(stats['skills_utilized']),
            'skill_efficiency': round(skill_efficiency, 2)
        })
    
    # Rank by composite productivity score descending
    results.sort(key=lambda x: x['productivity_score'], reverse=True)
    return results


def _calculate_skill_insights(tasks: List[dict], employees: List[dict]) -> List[dict]:
    """
    Identifies high-demand and under-utilized skills within the organization.
    
    Args:
        tasks (List[dict]): Task dataset.
        employees (List[dict]): Employee dataset.
        
    Returns:
        List[dict]: Skill-specific insights with demand level classification.
    """
    skill_usage = {}
    
    # Compile current organizational skill supply
    for emp in employees:
        emp_skills = emp.get('skills', {})
        for skill_id, proficiency in emp_skills.items():
            if skill_id not in skill_usage:
                skill_usage[skill_id] = {'count': 0, 'proficiencies': []}
            skill_usage[skill_id]['proficiencies'].append(proficiency)
    
    # Calculate demand based on active and completed task requirements
    active_statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED']
    active_tasks = [t for t in tasks if t.get('status') in active_statuses]
    
    for task in active_tasks:
        required_skill_ids = task.get('requiredSkillIds', [])
        
        if isinstance(required_skill_ids, dict):
            required_skill_ids = list(required_skill_ids.keys())
        
        for skill_id in required_skill_ids:
            if skill_id in skill_usage:
                skill_usage[skill_id]['count'] += 1
    
    insights = []
    for skill_id, data in skill_usage.items():
        if data['proficiencies']:
            avg_proficiency = np.mean(data['proficiencies'])
            
            # Categorize demand based on categorical thresholds
            if data['count'] >= 10:
                demand_level = "HIGH"
            elif data['count'] >= 5:
                demand_level = "MEDIUM"
            elif data['count'] >= 1:
                demand_level = "LOW"
            else:
                demand_level = "UNUSED"
            
            insights.append({
                'skill_name': skill_id,
                'usage_count': data['count'],
                'avg_proficiency': round(avg_proficiency, 1),
                'demand_level': demand_level
            })
    
    insights.sort(key=lambda x: x['usage_count'], reverse=True)
    return insights


def _generate_recommendations(
    metrics: dict, 
    top_performers: List[dict],
    skill_insights: List[dict]
) -> List[str]:
    """
    Uses heuristic rules to generate actionable AI recommendations based on calculated data.
    
    Args:
        metrics (dict): Global metrics.
        top_performers (List[dict]): Performance list.
        skill_insights (List[dict]): Capacity insights.
        
    Returns:
        List[str]: Human-readable recommendation strings.
    """
    recommendations = []
    
    # Scenario: Estimation Accuracy Issues
    if metrics['avg_task_variance'] > 0.3:
        recommendations.append(
            "Tasks exceed estimates by 30%+. Consider: "
            "1) Better estimation training, 2) Skill-based complexity scoring"
        )
    
    # Scenario: Low Overall Throughput
    if metrics['task_completion_rate'] < 0.7:
        recommendations.append(
            f"Low completion rate ({int(metrics['task_completion_rate'] * 100)}%). "
            f"Review: 1) Task priorities, 2) Skill-task matching, 3) Employee workload"
        )
    
    # Scenario: Missed Deadlines
    if metrics['on_time_delivery_rate'] < 0.8:
        recommendations.append(
            f"{int(metrics['on_time_delivery_rate'] * 100)}% on-time delivery. "
            f"Actions: 1) Adjust deadlines, 2) Use AI assignment, 3) Balance workload"
        )
    
    # Scenario: Critical Backlog
    if metrics['total_tasks_overdue'] > 5:
        recommendations.append(
            f"{metrics['total_tasks_overdue']} tasks overdue. "
            f"Prioritize completion or reassign using AI skill matching."
        )
    
    # Scenario: Skill Gap / Underutilization
    if metrics['avg_skill_utilization'] < 0.5:
        recommendations.append(
            f"Low skill utilization ({int(metrics['avg_skill_utilization'] * 100)}%). "
            f"Consider: 1) Cross-training programs, 2) More diverse task assignments"
        )
    
    # Scenario: Recognized Talent
    if top_performers and top_performers[0]['productivity_score'] > 80:
        top = top_performers[0]
        recommendations.append(
            f"{top['employee_name']} excels with {top['productivity_score']:.0f} score "
            f"using {top['skills_utilized']} different skills. "
            f"Consider mentorship or leadership roles."
        )
    
    # Scenario: Proficiency Deficit in Key Skills
    high_demand_skills = [s for s in skill_insights if s['demand_level'] == 'HIGH']
    if high_demand_skills and high_demand_skills[0]['avg_proficiency'] < 3.5:
        skill_name = high_demand_skills[0]['skill_name']
        recommendations.append(
            f"'{skill_name}' is high-demand but team proficiency is low. "
            f"Invest in training or hire specialists."
        )
    
    if not recommendations:
        recommendations.append(
            "System performing excellently. Continue monitoring key metrics."
        )
    
    return recommendations
