# ai_service/app/api/prediction.py
"""
api/prediction.py - AI Task Duration Prediction Engine.
This module provides a predictive interface that estimates the time required 
to complete a task. It leverages a hybrid approach combining LSTM (for 
temporal patterns) and Random Forest (for static feature importance) to 
generate point estimates and confidence intervals based on organizational history.
"""

from fastapi import APIRouter, HTTPException, Header, Request
from typing import List, Optional, Dict
import logging
from pydantic import BaseModel, ConfigDict, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.backend_client import backend_client
from app.core.redis_client import redis_client
from app.core.config import settings
from app.models.lstm_predictor import HybridDurationPredictor

logger = logging.getLogger(__name__)
router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# ============================================================
# MODELS
# ============================================================

class PredictionRequest(BaseModel):
    """
    Input parameters for generating a task duration estimate.
    
    Attributes:
        task_id (str): Reference to the task being analyzed.
        priority (str): Organizational priority (LOW, MEDIUM, HIGH, CRITICAL).
        complexity_score (float): Numeric complexity (0.0 to 1.0).
        required_skill_ids (List[str]): UUIDs for required technical skills.
        assigned_employee_id (Optional[str]): Employee profile to consider for skills-specific scaling.
    """
    task_id: str
    priority: str
    complexity_score: float
    required_skill_ids: List[str] = Field(default_factory=list)
    assigned_employee_id: Optional[str] = None


class PredictionResponse(BaseModel):
    """
    Output model containing the AI estimate and reliability metrics.
    
    Attributes:
        task_id (str): The analyzed task.
        predicted_hours (float): The median predicted duration.
        confidence_interval_lower (float): 25th percentile (P25) pessimistic bound.
        confidence_interval_upper (float): 75th percentile (P75) optimistic bound.
        confidence_score (float): Normalized certainty (0.0 to 1.0).
        model_version (str): Metadata on the algorithm used (hybrid vs heuristic).
        feature_importance (Optional[Dict[str, float]]): Weightings of inputs.
    """
    model_config = ConfigDict(protected_namespaces=())
    
    task_id: str
    predicted_hours: float
    confidence_interval_lower: float
    confidence_interval_upper: float
    confidence_score: float
    model_version: str
    feature_importance: Optional[Dict[str, float]] = None


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/predict", response_model=PredictionResponse)
@limiter.limit("120/minute")
async def predict_task_duration(
    request: Request,
    prediction_request: PredictionRequest,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Generates a task completion estimate using a Hybrid LSTM + RF architecture.
    The service first attempts to pull from a local cache, then executes 
    dynamic inference using the company’s specific historical dataset.
    
    Args:
        request (PredictionRequest): Task parameters.
        authorization (str): Auth token for cross-service calls.
        x_company_id (str): Organization ID.
        
    Returns:
        PredictionResponse: A detailed time estimate with confidence bounds.
        
    Raises:
        HTTPException: On data retrieval or model inference failures.
    """
    token = authorization.replace("Bearer ", "")
    
    # Step 1: Cache Lookup - Prevent redundant expensive ML inference
    sorted_skills = "-".join(sorted(prediction_request.required_skill_ids))
    params_key = f"{prediction_request.priority}-{prediction_request.complexity_score:.2f}-{sorted_skills}-{prediction_request.assigned_employee_id or 'none'}"
    cache_key = f"prediction:{prediction_request.task_id}:{params_key}"
    if not prediction_request.task_id.startswith("preview-"):
        cached_result = await redis_client.get(x_company_id, cache_key)
        if cached_result:
            return cached_result
    
    try:
        # Step 2: Context Preparation - Load organization-specific ML model
        predictor = HybridDurationPredictor(x_company_id)
        
        # Pull recent institutional knowledge (historical tasks)
        historical_tasks = await backend_client.get_historical_tasks(x_company_id, token)
        
        # Step 3: Lazy Training - If model is missing but data is sufficient (30+ tasks)
        if len(historical_tasks) >= 30 and predictor.rf_model is None:
            training_lock = "training:lock"
            if not await redis_client.get(x_company_id, training_lock):
                await redis_client.set(x_company_id, training_lock, True, ttl=120)
                predictor.train(historical_tasks)
        
        # Step 4: Employee Context - Optionally factor in the assigned person's skill depth
        avg_skill_proficiency = 0.5
        employee_experience = 0.0
        if prediction_request.assigned_employee_id:
            try:
                # Retrieve detailed skills response to extract both skills and experience
                headers = {
                    "Authorization": authorization,
                    "X-Company-Id": x_company_id
                }
                url = f"/employees/{prediction_request.assigned_employee_id}/skills"
                detailed_data = await backend_client._request(
                    "GET",
                    url,
                    x_company_id,
                    headers=headers,
                    params={"format": "detailed"}
                )
                
                # Extract skills and calculate average proficiency (focusing on required skills)
                if detailed_data and isinstance(detailed_data, dict):
                    skills_by_id = detailed_data.get('skillsById', {})
                    skills_by_name = detailed_data.get('skillsByName', {})
                    
                    # Normalization function for robust name matching (space, case, character insensitive)
                    def normalize_name(name: str) -> str:
                        return name.lower().replace(" ", "").replace("-", "").replace("_", "").replace(".", "").replace("/", "")

                    norm_skills_by_name = {normalize_name(k): v for k, v in skills_by_name.items() if k}
                    
                    required_ids = prediction_request.required_skill_ids
                    if required_ids:
                        proficiencies = []
                        for s_id in required_ids:
                            # 1. Try exact match in skillsById (UUID or name)
                            if s_id in skills_by_id:
                                proficiencies.append(skills_by_id[s_id])
                            elif s_id in skills_by_name:
                                proficiencies.append(skills_by_name[s_id])
                            else:
                                # 2. Try normalized name match
                                norm_id = normalize_name(s_id)
                                if norm_id in norm_skills_by_name:
                                    proficiencies.append(norm_skills_by_name[norm_id])
                                else:
                                    proficiencies.append(0)
                        avg_skill_proficiency = sum(proficiencies) / (5.0 * len(proficiencies))
                    elif skills_by_id:
                        proficiencies = [p for p in skills_by_id.values() if p]
                        if proficiencies:
                            avg_skill_proficiency = sum(proficiencies) / (5.0 * len(proficiencies))
                    
                    # Extract years of experience from the skills list if hireDate is missing
                    skills_list = detailed_data.get('skills', [])
                    if skills_list:
                        exp_list = [float(s.get('yearsOfExperience', 0) or 0) for s in skills_list]
                        if exp_list:
                            employee_experience = max(exp_list)
                
                # Fetch employee profile to get hireDate for accurate experience calculation
                employee_profile = await backend_client.get_employee_by_id(
                    prediction_request.assigned_employee_id, token, x_company_id
                )
                if employee_profile and employee_profile.get('hireDate'):
                    try:
                        from datetime import datetime
                        hire_date_str = employee_profile.get('hireDate')
                        hire_date = datetime.strptime(hire_date_str.split('T')[0], '%Y-%m-%d')
                        employee_experience = max(employee_experience, (datetime.now() - hire_date).days / 365.25)
                    except Exception as parse_err:
                        logger.warning(f"Error parsing employee hireDate: {parse_err}")
                        
            except Exception as e:
                logger.warning(f"Skipping employee context due to fetch error: {str(e)}")
        
        # Step 5: Metric Extraction - Calculate local average for similar past tasks (KNN-style logic)
        historical_avg = None
        if historical_tasks:
            filtered = [
                t for t in historical_tasks
                if t.get('priority') == prediction_request.priority
                and abs(t.get('complexityScore', 0.5) - prediction_request.complexity_score) < 0.3
            ]
            
            # Weighted fallback: Similar tasks -> All tasks -> None
            actual_hours_list = [t['actualHours'] for t in (filtered if filtered else historical_tasks) if t.get('actualHours')]
            if actual_hours_list:
                historical_avg = sum(actual_hours_list) / len(actual_hours_list)
        
        # Step 6: Inference - Pass vectorized features to the Hybrid Predictor
        # Recent tasks provide the 'Temporal Context' for the LSTM
        lookback_window = historical_tasks[-5:] if len(historical_tasks) >= 5 else historical_tasks
        
        prediction, p25, p75 = predictor.predict(
            task_features={
                'priority': prediction_request.priority,
                'complexity_score': prediction_request.complexity_score,
                'required_skills': prediction_request.required_skill_ids,
                'historical_avg': historical_avg,
                'avg_skill_proficiency': avg_skill_proficiency,
                'employee_experience': employee_experience,
                'has_employee': prediction_request.assigned_employee_id is not None
            },
            recent_tasks=lookback_window
        )
        
        # Step 7: Version Metadata - Identify algorithm state (Hybrid, RF-only, or Heuristic)
        if predictor.lstm_model and predictor.rf_model:
            model_ver = "hybrid_lstm_rf_v1"
        elif predictor.rf_model:
            model_ver = "rf_only_v1"
        else:
            model_ver = "heuristic_v1"
        
        # Step 8: Precision Scoring - Narrower intervals yield higher confidence scores
        raw_confidence = 1.0 - ((p75 - p25) / prediction) / 2
        confidence_final = max(0.5, min(1.0, raw_confidence))
        
        # Step 9: Feature Importance - Extract RF tree weights if using the ML path
        explainability = None
        if predictor.rf_model:
            try:
                weights = predictor.rf_model.feature_importances_
                explainability = {
                    'priority': float(weights[0]),
                    'complexity': float(weights[1]),
                    'skill_count': float(weights[2])
                }
            except Exception: pass
        
        final_response = {
            'task_id': prediction_request.task_id,
            'predicted_hours': float(prediction),
            'confidence_interval_lower': float(p25),
            'confidence_interval_upper': float(p75),
            'confidence_score': round(float(confidence_final), 2),
            'model_version': model_ver,
            'feature_importance': explainability
        }
        
        # Step 10: Persistence - Cache result using the organization-specific TTL
        await redis_client.set(x_company_id, cache_key, final_response, ttl=settings.CACHE_TTL_LONG)
        
        return final_response
        
    except Exception as e:
        logger.error(f"Prediction inference failure: {str(e)}")
        raise HTTPException(status_code=500, detail="The AI prediction engine failed to process the request")

