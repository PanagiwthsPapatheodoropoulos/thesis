"""
api/anomaly.py - Multi-type Anomaly Detection System.
This module provides a comprehensive engine for detecting irregular patterns within
the organization, including task duration skews, employee burnout/overload,
critical skill gaps, and department-level workload imbalances.
"""
from fastapi import APIRouter, HTTPException, Header
from typing import List, Dict
import logging
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest
import numpy as np
from app.core.backend_client import backend_client
from app.core.skill_matcher import skill_matcher

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================

class AnomalyDetectionRequest(BaseModel):
    """
    Data model for an anomaly detection request.
    
    Attributes:
        entity_type (str): Category to scan ('TASK', 'EMPLOYEE', 'SKILL_GAP', 
                           'WORKLOAD_IMBALANCE', 'COMPLEXITY_MISMATCH', or 'all').
        entity_id (str): Specific target ID or 'all' for an organizational sweep.
    """
    entity_type: str = Field(..., description="The category of data to analyze for anomalies.")
    entity_id: str = Field(default="all", description="Target identifier for scoped analysis.")

class AnomalyResult(BaseModel):
    """
    Descriptive result of a single detected anomaly.
    
    Attributes:
        entity_id (str): ID of the task, employee, or department where the anomaly was found.
        entity_type (str): Type of anomaly detected.
        anomaly_score (float): Confidence score of the detection (0 to 1).
        is_anomaly (bool): Flag indicating if the pattern is considered irregular.
        severity (str): Impact level (HIGH, MEDIUM, LOW).
        description (str): Human-readable explanation of why this was flagged.
        metrics (dict): Key data points used for the detection.
    """
    entity_id: str
    entity_type: str
    anomaly_score: float
    is_anomaly: bool
    severity: str
    description: str
    metrics: dict

class AnomalyDetectionResponse(BaseModel):
    """
    Summarized report of an anomaly detection run.
    
    Attributes:
        total_checked (int): Count of all items processed during the run.
        anomalies_found (int): Count of flags raised.
        results (List[AnomalyResult]): Detailed records of the detected anomalies.
    """
    total_checked: int
    anomalies_found: int
    results: List[AnomalyResult]

# ============================================================
# MAIN DETECTION ENDPOINT
# ============================================================

@router.post("/detect", response_model=AnomalyDetectionResponse)
async def detect_anomalies(
    request: AnomalyDetectionRequest,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Orchestrates multi-category anomaly detection based on the request type.
    This endpoint serves as a central hub for proactive organizational monitoring.
    
    Args:
        request (AnomalyDetectionRequest): Target category and scope.
        authorization (str): Bearer token for authentication.
        x_company_id (str): Organization identifier.
        
    Returns:
        AnomalyDetectionResponse: Aggregated results of the detection process.
        
    Raises:
        HTTPException: If an invalid entity type is provided or a system error occurs.
    """
    token = authorization.replace("Bearer ", "")
    
    try:
        results = []
        
        # Branch logic to determine which specific sub-engines to trigger
        if request.entity_type == 'all':
            # Perform a full global scan across all data dimensions
            tasks = await backend_client.get_tasks(x_company_id, token, fetch_all=True)
            employees = await backend_client.get_employees(x_company_id, token, fetch_all=True)
            workload = await backend_client.get_employee_workload(x_company_id, token, fetch_all=True)
            
            # Synchronize skill data for multidimensional checks
            await _enrich_employees_with_skills(employees, x_company_id, token)
            
            results.extend(await _detect_task_anomalies_with_data(tasks))
            results.extend(await _detect_employee_anomalies_with_data(workload))
            results.extend(await _detect_skill_gap_anomalies_with_data(tasks, employees, x_company_id, token))
            results.extend(await _detect_workload_imbalance_with_data(workload))
            results.extend(await _detect_complexity_mismatch_with_data(tasks, employees))
            
        elif request.entity_type == 'TASK':
            tasks = await backend_client.get_tasks(x_company_id, token, fetch_all=True)
            results = await _detect_task_anomalies_with_data(tasks)
            
        elif request.entity_type == 'EMPLOYEE':
            workload = await backend_client.get_employee_workload(x_company_id, token, fetch_all=True)
            results = await _detect_employee_anomalies_with_data(workload)
            
        elif request.entity_type == 'SKILL_GAP':
            tasks = await backend_client.get_tasks(x_company_id, token, fetch_all=True)
            employees = await backend_client.get_employees(x_company_id, token, fetch_all=True)
            await _enrich_employees_with_skills(employees, x_company_id, token)
            results = await _detect_skill_gap_anomalies_with_data(tasks, employees, x_company_id, token)
            
        elif request.entity_type == 'WORKLOAD_IMBALANCE':
            workload = await backend_client.get_employee_workload(x_company_id, token, fetch_all=True)
            results = await _detect_workload_imbalance_with_data(workload)
            
        elif request.entity_type == 'COMPLEXITY_MISMATCH':
            tasks = await backend_client.get_tasks(x_company_id, token, fetch_all=True)
            employees = await backend_client.get_employees(x_company_id, token, fetch_all=True)
            await _enrich_employees_with_skills(employees, x_company_id, token)
            results = await _detect_complexity_mismatch_with_data(tasks, employees)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid entity_type: '{request.entity_type}'")
        
        # Filter only active anomalies to reduce response payload noise
        anomalies = [r for r in results if r.get('is_anomaly', False)]
        
        return {
            'total_checked': len(results),
            'anomalies_found': len(anomalies),
            'results': anomalies
        }
        
    except Exception as e:
        logger.error(f"Anomaly detection failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during detection")


# ============================================================
# HELPER FUNCTIONS
# ============================================================

async def _enrich_employees_with_skills(
    employees: List[Dict],
    company_id: str,
    token: str
):
    """
    Batch enriches employee records with their technical skills.
    
    Args:
        employees (List[Dict]): List of employee objects to modify in-place.
        company_id (str): Org ID for data filtering.
        token (str): JWT for backend authentication.
    """
    if not employees:
        return
    
    try:
        # Use batch API for significantly better performance over O(n) calls
        employee_ids = [emp['id'] for emp in employees]
        all_skills = await backend_client.get_all_employee_skills_batch(
            employee_ids,
            token,
            company_id
        )
        for emp in employees:
            emp['skills'] = all_skills.get(emp['id'], {})
                
    except Exception as e:
        logger.warning(f"Batch skill enrichment failed, using individual fallback: {str(e)}")
        for emp in employees:
            emp['skills'] = await backend_client.get_employee_skills(
                emp['id'], token, company_id
            ) or {}


# ============================================================
# DETECTION ENGINES
# ============================================================

async def _detect_task_anomalies_with_data(tasks: List[dict]) -> List[dict]:
    """
    Uses Isolation Forest (Unsupervised ML) to detect irregular task performance.
    Flags tasks that take significantly longer or shorter than historical norms.
    
    Args:
        tasks (List[dict]): Task dataset to analyze.
        
    Returns:
        List[dict]: Detected task anomalies with ML scores.
    """
    if len(tasks) < 10: # Minimum sample size for statistical significance
        return []

    X = []
    task_ids = []
    task_data = []

    # Prepare feature matrix for the ML model
    for task in tasks:
        if task.get('status') in ['IN_PROGRESS', 'COMPLETED']:
            estimated = task.get('estimatedHours', 0)
            actual = task.get('actualHours', 0)
            
            if estimated > 0 and actual > 0:
                variance = (actual - estimated) / estimated
                duration_ratio = actual / estimated
                complexity = task.get('complexityScore', 0.5)
                
                priority_map = {'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4}
                priority_val = priority_map.get(task.get('priority', 'MEDIUM'), 2)
                
                # Features: [Variance, Ratio, Magnitude, Complexity, Priority]
                X.append([variance, duration_ratio, actual, complexity, priority_val])
                task_ids.append(task['id'])
                task_data.append(task)

    if len(X) < 5:
        return []

    # Configure Isolation Forest: contamination=0.1 assumes 10% of items are outliers
    model = IsolationForest(contamination=0.1, random_state=42, n_estimators=100)
    predictions = model.fit_predict(X)
    scores = model.score_samples(X) # Higher score means more 'normal' (standardized)

    results = []
    for i, task_id in enumerate(task_ids):
        is_anomaly = predictions[i] == -1
        anomaly_score = float(-scores[i]) # Invert for detection score (0-1)
        
        if is_anomaly:
            variance = X[i][0]
            actual_hours = X[i][2]
            task = task_data[i]
            
            # Severity thresholds based on ML confidence and raw variance
            if anomaly_score > 0.6 or abs(variance) > 1.0:
                severity = 'HIGH'
            elif anomaly_score > 0.4 or abs(variance) > 0.5:
                severity = 'MEDIUM'
            else:
                severity = 'LOW'
            
            if variance > 0.5:
                description = f"Task '{task['title']}' significantly exceeded estimates (+{variance*100:.0f}%)"
            elif variance < -0.3:
                description = f"Task '{task['title']}' completed unusually fast ({variance*100:.0f}% under estimate)"
            else:
                description = f"Task '{task['title']}' shows unusual completion patterns"
            
            results.append({
                'entity_id': task_id,
                'entity_type': 'TASK',
                'anomaly_score': round(anomaly_score, 3),
                'is_anomaly': True,
                'severity': severity,
                'description': description,
                'metrics': {
                    'estimated_hours': task.get('estimatedHours'),
                    'actual_hours': actual_hours,
                    'variance_percent': round(variance * 100, 1),
                    'complexity': task.get('complexityScore')
                }
            })

    return results


async def _detect_employee_anomalies_with_data(workload_data: List[dict]) -> List[dict]:
    """
    Uses Isolation Forest to detect extreme employee workload outliers.
    Identifies burnout risks (extreme high) or disengagement/idleness (extreme low).
    
    Args:
        workload_data (List[dict]): Employee workload statistics.
        
    Returns:
        List[dict]: Individual workload anomalies.
    """
    if len(workload_data) < 5:
        return []

    X = []
    employee_ids = []

    for emp in workload_data:
        # Features represent throughput and pressure
        X.append([
            emp['activeTasks'],
            emp['completedTasks'],
            emp['workloadPercentage'],
            emp.get('pendingTasks', 0)
        ])
        employee_ids.append(emp['employeeId'])

    model = IsolationForest(contamination=0.15, random_state=42, n_estimators=100)
    predictions = model.fit_predict(X)
    scores = model.score_samples(X)

    results = []
    for i, emp_id in enumerate(employee_ids):
        is_anomaly = predictions[i] == -1
        anomaly_score = float(-scores[i])
        
        if is_anomaly:
            emp = workload_data[i]
            
            # Heuristic override for severity classification
            if emp['workloadPercentage'] > 120:
                severity = 'HIGH'
                description = f"Employee '{emp['employeeName']}' is severely overloaded ({emp['workloadPercentage']:.0f}%)"
            elif emp['activeTasks'] > 10:
                severity = 'HIGH'
                description = f"Employee '{emp['employeeName']}' has {emp['activeTasks']} active tasks (bottleneck risk)"
            elif emp['completedTasks'] == 0 and emp['activeTasks'] > 0:
                severity = 'MEDIUM'
                description = f"Employee '{emp['employeeName']}' has no completions yet ({emp['activeTasks']} active)"
            elif emp['workloadPercentage'] < 30:
                severity = 'MEDIUM'
                description = f"Employee '{emp['employeeName']}' is underutilized ({emp['workloadPercentage']:.0f}%)"
            else:
                severity = 'LOW'
                description = f"Employee '{emp['employeeName']}' shows unusual workload patterns"
            
            results.append({
                'entity_id': emp_id,
                'entity_type': 'EMPLOYEE',
                'anomaly_score': round(anomaly_score, 3),
                'is_anomaly': True,
                'severity': severity,
                'description': description,
                'metrics': {
                    'active_tasks': emp['activeTasks'],
                    'completed_tasks': emp['completedTasks'],
                    'workload_percentage': emp['workloadPercentage'],
                    'pending_tasks': emp.get('pendingTasks', 0)
                }
            })

    return results


async def _detect_skill_gap_anomalies_with_data(
    tasks: List[dict],
    employees: List[dict],
    company_id: str,
    token: str
) -> List[dict]:
    """
    Detects organizational skill deficits using fuzzy and canonical matching.
    Checks for: missing required skills, single points of failure, and low proficiency in demand areas.
    
    Args:
        tasks (List[dict]): List of tasks with skill requirements.
        employees (List[dict]): List of employees with their skill profiles.
        company_id (str): Org ID.
        token (str): JWT.
        
    Returns:
        List[dict]: Skill gap anomalies.
    """
    # Create mapping for ID -> Name translation for reporting readability
    try:
        all_skills = await backend_client.get_skills(company_id, token, fetch_all=True)
        skill_map = {s['id']: s['name'] for s in all_skills}
    except Exception:
        skill_map = {}

    results = []
    available_canonical_skills = set()
    skill_inventory = {}

    # 1. Compile Current Organizational Capacity
    for emp in employees:
        emp_skills = emp.get('skills', {})
        if not isinstance(emp_skills, dict):
            continue
        
        for skill_key, proficiency in emp_skills.items():
            if skill_key not in skill_inventory:
                skill_inventory[skill_key] = {'employees': [], 'proficiencies': [], 'usage_count': 0}
            skill_inventory[skill_key]['employees'].append(emp['id'])
            skill_inventory[skill_key]['proficiencies'].append(proficiency)

            # Canonical mapping handles naming variations (e.g., 'ReactJS' vs 'React')
            canonical = skill_matcher.get_canonical_skill(skill_key)
            available_canonical_skills.add(canonical)
    
    # 2. Measure Operational Demand
    for task in tasks:
        if task.get('status') in ['PENDING', 'IN_PROGRESS'] and task.get('requiredSkillIds'):
            for skill_id in task['requiredSkillIds']:
                skill_name = skill_map.get(skill_id, "")
                if skill_name and skill_name in skill_inventory:
                    skill_inventory[skill_name]['usage_count'] += 1

    # 3. Detect Truly Missing Capabilities
    for task in tasks:
        if task.get('status') in ['PENDING', 'IN_PROGRESS']:
            required_ids = task.get('requiredSkillIds', [])
            truly_missing_names = []
            
            for req_id in required_ids:
                req_name = skill_map.get(req_id, "")
                if not req_name: continue
                
                req_canonical = skill_matcher.get_canonical_skill(req_name)
                if req_canonical not in available_canonical_skills:
                    truly_missing_names.append(req_name)
            
            if truly_missing_names:
                severity = 'HIGH' if len(truly_missing_names) > 2 else 'MEDIUM'
                total_req = len(required_ids)
                matched_count = total_req - len(truly_missing_names)
                coverage = matched_count / total_req if total_req > 0 else 0

                results.append({
                    'entity_id': task['id'],
                    'entity_type': 'SKILL_GAP',
                    'anomaly_score': 0.9,
                    'is_anomaly': True,
                    'severity': severity,
                    'description': f"Task '{task['title']}' requires unavailable skills: {', '.join(truly_missing_names)}",
                    'metrics': {
                        'required_skills': [skill_map.get(sid, sid) for sid in required_ids],
                        'missing_skills': truly_missing_names,
                        'coverage': round(coverage, 2),
                        'note': 'Checked via fuzzy canonical matching'
                    }
                })
    
    # 4. Identify Proficiency Gaps in High-Demand Skills
    for skill_name, data in skill_inventory.items():
        if data['usage_count'] > 5 and data['proficiencies']:
            avg_proficiency = np.mean(data['proficiencies'])
            if avg_proficiency < 3.0:
                results.append({
                    'entity_id': 'COMPANY',
                    'entity_type': 'SKILL_GAP',
                    'anomaly_score': 0.85,
                    'is_anomaly': True,
                    'severity': 'HIGH',
                    'description': f"Skill '{skill_name}' is high-demand ({data['usage_count']} tasks) but team has low proficiency (avg: {avg_proficiency:.1f}/5)",
                    'metrics': {
                        'skill_name': skill_name,
                        'usage_count': data['usage_count'],
                        'avg_proficiency': round(avg_proficiency, 2),
                        'employees_with_skill': len(data['employees']),
                        'recommendation': 'Initiate training or hire specialists'
                    }
                })
    
    # 5. Detect Organizational Risks (Single Point of Failure)
    for skill_name, data in skill_inventory.items():
        if data['usage_count'] > 3 and len(data['employees']) == 1:
            results.append({
                'entity_id': 'COMPANY',
                'entity_type': 'SKILL_GAP',
                'anomaly_score': 0.8,
                'is_anomaly': True,
                'severity': 'HIGH',
                'description': f"Critical skill '{skill_name}' ({data['usage_count']} tasks) held by only ONE employee",
                'metrics': {
                    'skill_name': skill_name,
                    'usage_count': data['usage_count'],
                    'employees_with_skill': 1,
                    'recommendation': 'Task cross-training immediately to mitigate bottleneck risk'
                }
            })
    
    return results


async def _detect_workload_imbalance_with_data(workload_data: List[dict]) -> List[dict]:
    """
    Identifies departmental workload skew using the Coefficient of Variation.
    Flags teams where a few members are significantly more loaded than others.
    
    Args:
        workload_data (List[dict]): Per-employee workload stats.
        
    Returns:
        List[dict]: Departmental imbalance anomalies.
    """
    if len(workload_data) < 3:
        return []
    
    results = []
    departments = {}
    for emp in workload_data:
        dept = emp.get('department', 'Unassigned')
        if dept not in departments:
            departments[dept] = []
        departments[dept].append(emp)
    
    for dept_name, dept_employees in departments.items():
        if len(dept_employees) < 2:
            continue
        
        workloads = [emp['workloadPercentage'] for emp in dept_employees]
        avg_workload = np.mean(workloads)
        std_workload = np.std(workloads)
        
        # Calculate CV = StdDev / Mean. > 0.3 indicates high variability within the group.
        coefficient_of_variation = std_workload / avg_workload if avg_workload > 0 else 0
        
        if coefficient_of_variation > 0.3:
            overloaded = [e for e in dept_employees if e['workloadPercentage'] > avg_workload * 1.3]
            underloaded = [e for e in dept_employees if e['workloadPercentage'] < avg_workload * 0.5]
            
            if overloaded or underloaded:
                severity = 'HIGH' if coefficient_of_variation > 0.5 else 'MEDIUM'
                
                results.append({
                    'entity_id': 'COMPANY',
                    'entity_type': 'WORKLOAD_IMBALANCE',
                    'anomaly_score': round(coefficient_of_variation, 2),
                    'is_anomaly': True,
                    'severity': severity,
                    'description': f"Department '{dept_name}' shows workload imbalance: {len(overloaded)} overloaded, {len(underloaded)} underloaded members",
                    'metrics': {
                        'department': dept_name,
                        'avg_workload': round(avg_workload, 1),
                        'std_deviation': round(std_workload, 1),
                        'overloaded_count': len(overloaded),
                        'underloaded_count': len(underloaded),
                        'recommendation': 'Trigger AI task rebalancing within this department'
                    }
                })
    
    return results


async def _detect_complexity_mismatch_with_data(
    tasks: List[dict],
    employees: List[dict]
) -> List[dict]:
    """
    Detects assignment mismatches where a task's complexity doesn't suit the employee's skill level.
    
    Args:
        tasks (List[dict]): Dataset of active/pending tasks.
        employees (List[dict]): Dataset of employee skill levels.
        
    Returns:
        List[dict]: Complexity mismatch anomalies.
    """
    results = []
    
    # 1. Compute aggregate skill level for each employee (score 0.0 to 1.0)
    employee_skill_levels = {}
    for emp in employees:
        emp_skills = emp.get('skills', {})
        if not isinstance(emp_skills, dict) or not emp_skills:
            continue
        
        avg_proficiency = np.mean(list(emp_skills.values()))
        skill_count = len(emp_skills)
        # Normalize skill level based on depth (proficiency) and breadth (count)
        skill_level = (avg_proficiency / 5.0) * min(skill_count / 5, 1.0)
        employee_skill_levels[emp['id']] = {
            'level': skill_level,
            'name': f"{emp.get('firstName', '')} {emp.get('lastName', '')}"
        }
    
    # 2. Compare task complexity against assigned employee capability
    for task in tasks:
        if task.get('status') not in ['PENDING', 'IN_PROGRESS']:
            continue
        
        complexity = task.get('complexityScore', 0.5)
        assigned_emp_id = task.get('assignedEmployeeId')
        
        if assigned_emp_id and assigned_emp_id in employee_skill_levels:
            emp_data = employee_skill_levels[assigned_emp_id]
            emp_level = emp_data['level']
            
            # Case: Overwhelmed Employee (High Complexity -> Low Skill)
            if complexity > 0.7 and emp_level < 0.4:
                results.append({
                    'entity_id': task['id'],
                    'entity_type': 'COMPLEXITY_MISMATCH',
                    'anomaly_score': 0.75,
                    'is_anomaly': True,
                    'severity': 'HIGH',
                    'description': f"Complexity mismatch: Task '{task['title']}' ({complexity:.1f}) assigned to non-specialist '{emp_data['name']}' ({emp_level:.2f})",
                    'metrics': {
                        'task_complexity': complexity,
                        'employee_skill_level': round(emp_level, 2),
                        'recommendation': 'Provide senior oversight or pair-programming support'
                    }
                })
            
            # Case: Underutilized Senior (Low Complexity -> High Skill)
            elif complexity < 0.3 and emp_level > 0.7:
                results.append({
                    'entity_id': task['id'],
                    'entity_type': 'COMPLEXITY_MISMATCH',
                    'anomaly_score': 0.6,
                    'is_anomaly': True,
                    'severity': 'MEDIUM',
                    'description': f"Potential underutilization: Simple task '{task['title']}' assigned to high-skill '{emp_data['name']}'",
                    'metrics': {
                        'task_complexity': complexity,
                        'employee_skill_level': round(emp_level, 2),
                        'recommendation': 'Consider delegating to a junior employee for growth opportunity'
                    }
                })
    
    return results
