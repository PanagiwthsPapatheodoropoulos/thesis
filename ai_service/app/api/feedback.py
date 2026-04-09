# ai_service/app/api/feedback.py
"""
api/feedback.py - Model Performance Feedback and Continuous Learning Loop.
This module manages the 'Learning' phase of the AI service. When users complete 
tasks, their actual effort is compared against AI predictions to calculate 
drift and accuracy. High errors or significant data accumulation trigger 
incremental (online) or full retraining of the duration prediction models.
"""

from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from typing import Optional, List
import logging
from pydantic import BaseModel, validator, Field
from datetime import datetime
import numpy as np

from app.core.redis_client import redis_client
from app.core.training_scheduler import training_scheduler

logger = logging.getLogger(__name__)
router = APIRouter()

# ============================================================
# MODELS
# ============================================================

class PredictionFeedbackRequest(BaseModel):
    """
    Data payload sent when a task is completed to refine AI models.
    
    Attributes:
        task_id (str): Reference to the completed task.
        actual_hours (float): The real clock-time spent on the task.
        predicted_hours (Optional[float]): The AI's initial duration estimate.
        title (str): Task title for NLP feature extraction.
        description (Optional[str]): Detailed requirements.
        priority (str): Organizational priority level.
        complexity_score (float): Calculated task difficulty.
        required_skill_ids (List[str]): Skills that were needed for completion.
    """
    task_id: str
    actual_hours: float
    predicted_hours: Optional[float] = None
    title: str
    description: Optional[str] = ""
    priority: str
    complexity_score: float = 0.5
    required_skill_ids: List[str] = Field(default_factory=list)
    
    @validator('actual_hours')
    def validate_actual_hours(cls, v):
        """Ensures the reported time is within a realistic operational range."""
        if v <= 0:
            raise ValueError('actual_hours must be strictly positive')
        if v > 1000:  # Adjusted sanity check for large projects
            raise ValueError('actual_hours exceeds maximum project threshold (>1000h)')
        return v


class FeedbackResponse(BaseModel):
    """
    Result of the feedback submission process.
    
    Attributes:
        message (str): Operational status message.
        prediction_error (Optional[float]): Absolute difference in hours.
        error_percentage (Optional[float]): Relative error vs actual time.
        should_retrain (bool): Whether this feedback triggered a retraining event.
        feedback_id (str): Unique trace ID for the stored feedback.
    """
    message: str
    prediction_error: Optional[float] = None
    error_percentage: Optional[float] = None
    should_retrain: bool = False
    feedback_id: str


class ModelPerformanceResponse(BaseModel):
    """
    Report on the current health and accuracy of a company's AI model.
    """
    total_predictions: int
    pending_predictions: int = 0
    average_error_hours: float
    average_error_percentage: float
    accuracy_within_20_percent: float
    last_training_date: Optional[str] = None
    model_version: str
    message: Optional[str] = None


# ============================================================
# ENDPOINTS
# ============================================================

@router.post("/submit", response_model=FeedbackResponse)
async def submit_feedback(
    request: PredictionFeedbackRequest,
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Submits ground-truth data after task completion.
    Triggers an immediate error analysis and potentially background retraining
    if model performance has drifted or enough new samples are available.
    
    Args:
        request (PredictionFeedbackRequest): Task outcome data.
        background_tasks (BackgroundTasks): FastAPI background manager.
        authorization (str): Auth token.
        x_company_id (str): Organization ID.
        
    Returns:
        FeedbackResponse: Statistics on the prediction's accuracy and retraining state.
    """    
    token = authorization.replace("Bearer ", "")
    
    try:
        # Step 1: Accuracy Benchmarking
        prediction_error = None
        error_percentage = None
        
        if request.predicted_hours:
            prediction_error = abs(request.actual_hours - request.predicted_hours)
            # Avoid division by zero if task was 'instant'
            safe_actual = max(0.1, request.actual_hours)
            error_percentage = (prediction_error / safe_actual) * 100
            
        # Step 2: Persistent Storage - Save for long-term historical training
        feedback_id = await _store_feedback(x_company_id, request, prediction_error, error_percentage)
        
        # Step 3: Online Learning Buffer - Update the 'Recent Completions' cache
        await _update_online_learning(x_company_id, request)
        
        # Step 4: Incremental Adaptation - Check if current error justifies an immediate weights update
        if await _should_update_immediately(x_company_id, prediction_error, error_percentage):
            background_tasks.add_task(_incremental_model_update, x_company_id, request)
        
        # Step 5: Global Retraining Schedule - Trigger full model rebuild if thresholds reached
        should_retrain = await _check_retrain_threshold(x_company_id)
        if should_retrain:
            background_tasks.add_task(training_scheduler.train_company_model, x_company_id, full_retrain=False)
        
        return FeedbackResponse(
            message="Outcome recorded; AI model scheduled for incremental refinement.",
            prediction_error=prediction_error,
            error_percentage=error_percentage,
            should_retrain=should_retrain,
            feedback_id=feedback_id
        )
        
    except Exception as e:
        logger.error(f"Feedback submission failure: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal failure during feedback processing")


@router.post("/track-prediction")
async def track_prediction(
    request: dict,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Logs a 'pending' prediction before the task is completed.
    This allows the system to track the 'Pending Prediction' count for the health dashboard.
    
    Args:
        request (dict): Contains task_id and predicted value.
        authorization (str): Auth.
        x_company_id (str): Org ID.
    """
    try:
        cache_key = "predictions:pending"
        pending = await redis_client.get(x_company_id, cache_key) or []
        
        prediction_data = {
            'task_id': request.get('task_id'),
            'predicted_hours': request.get('predicted_hours'),
            'title': request.get('title', ''),
            'priority': request.get('priority', ''),
            'predicted_at': datetime.now().isoformat()
        }
        
        pending.append(prediction_data)
        
        # Keep pending list for 90 days to allow for long projects
        await redis_client.set(x_company_id, cache_key, pending, ttl=86400 * 90)
          
        return {"message": "Active prediction tracked", "total_pending": len(pending)}
        
    except Exception as e:
        logger.error(f"Tracking failure: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to log active prediction")


@router.post("/retrain")
@router.post("/trigger-training")
async def trigger_manual_training(
    background_tasks: BackgroundTasks,
    full_retrain: bool = False,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Forces an immediate retraining of the prediction models for a company.
    Typically used by admins after large data migrations or system updates.
    
    Args:
        background_tasks (BackgroundTasks): Manager.
        full_retrain (bool): Whether to perform an exhaustive search (AutoML) or fast retrain.
        authorization (str): Auth.
        x_company_id (str): Org ID.
    """
    try:
        # Prevent concurrent training jobs for the same organization
        if training_scheduler.is_training.get(x_company_id, False):
            return {"message": "Retraining is already active for this organization", "status": "running"}
        
        background_tasks.add_task(training_scheduler.train_company_model, x_company_id, full_retrain=full_retrain)
        
        return {
            "message": "Global optimization workflow initiated",
            "status": "started",
            "full_retrain": full_retrain
        }
    except Exception as e:
        logger.error(f"Manual training trigger error: {str(e)}")
        raise HTTPException(status_code=500, detail="Retraining engine unreachable")


# ============================================================
# HELPER FUNCTIONS
# ============================================================

async def _store_feedback(
    company_id: str,
    request: PredictionFeedbackRequest,
    prediction_error: Optional[float],
    error_percentage: Optional[float]
) -> str:
    """
    Persists feedback data in a rolling cache buffer.
    Acts as the primary data source for background retraining jobs.
    
    Args:
        company_id (str): The organization.
        request (PredictionFeedbackRequest): Outcome details.
        prediction_error (Optional[float]): Absolute error hours.
        error_percentage (Optional[float]): Normalized error.
        
    Returns:
        str: Generated unique feedback identifier.
    """
    feedback_id = f"fdb_{int(datetime.now().timestamp())}"
    
    feedback_data = {
        'feedback_id': feedback_id,
        'task_id': request.task_id,
        'actual_hours': request.actual_hours,
        'predicted_hours': request.predicted_hours,
        'prediction_error': prediction_error,
        'error_percentage': error_percentage,
        'title': request.title,
        'description': request.description,
        'priority': request.priority,
        'complexity_score': request.complexity_score,
        'required_skill_ids': request.required_skill_ids,
        'timestamp': datetime.now().isoformat()
    }
    
    cache_key = "feedback:recent"
    recent_feedback = await redis_client.get(company_id, cache_key) or []
    recent_feedback.append(feedback_data)
    
    # Cap the rolling buffer to maintain low-latency inference cache
    if len(recent_feedback) > 100:
        recent_feedback = recent_feedback[-100:]
    
    await redis_client.set(company_id, cache_key, recent_feedback, ttl=86400 * 30)
    return feedback_id


async def _update_online_learning(
    company_id: str,
    request: PredictionFeedbackRequest
):
    """
    Maintains a high-speed buffer of very recent task completions.
    Used for local 'Fine-tuning' or online learning models.
    """
    try:
        cache_key = "recent_completions"
        recent = await redis_client.get(company_id, cache_key) or []
        
        completion_data = {
            'title': request.title,
            'description': request.description,
            'priority': request.priority,
            'complexity_score': request.complexity_score,
            'required_skill_ids': request.required_skill_ids,
            'actual_hours': request.actual_hours,
            'completed_at': datetime.now().isoformat()
        }
        
        recent.append(completion_data)
        
        # Only keep the most recent 50 to avoid input noise
        if len(recent) > 50:
            recent = recent[-50:]
        
        await redis_client.set(company_id, cache_key, recent, ttl=86400 * 7)
    except Exception as e:
        logger.warning(f"Online learning buffer update failed: {e}")


async def _check_retrain_threshold(company_id: str) -> bool:
    """
    Performance heuristic to determine if full model regeneration is needed.
    Considers sample volume, cumulative drift, and last training date.
    
    Returns:
        bool: True if retraining should be enqueued.
    """
    try:
        # Load feedback history
        recent_feedback = await redis_client.get(company_id, "feedback:recent") or []
        
        # Don't waste compute on small sample sizes
        if len(recent_feedback) < 20:
            return False
        
        # Avoid 'Over-training' (training multiple times per hour)
        training_metrics = await redis_client.get(company_id, "training_metrics:latest")
        if training_metrics:
            last_training = datetime.fromisoformat(training_metrics['trained_at'])
            if (datetime.now() - last_training).days < 1:
                return False
        
        # Significant Error Check: Triggers if recent 20 samples have >30% avg error
        errors_pct = [f['error_percentage'] for f in recent_feedback[-20:] if f.get('error_percentage')]
        if errors_pct and np.mean(errors_pct) > 30:
            return True
        
        # Maintenance Check: Regular weekly update to incorporate any drift
        if training_metrics and (datetime.now() - datetime.fromisoformat(training_metrics['trained_at'])).days >= 7:
            return True
        
        return False
    except Exception:
        return False
    
async def _should_update_immediately(
    company_id: str,
    prediction_error: Optional[float],
    error_percentage: Optional[float]
) -> bool:
    """
    Decides on 'Incremental Learning' (weight adjustment) vs waiting for retraining.
    Used for 'Catastrophic Error' correction.
    """
    # 1. Immediate update for significant misses (>30%)
    if error_percentage and error_percentage > 30:
        return True
    
    # 2. Sequential update every 5 feedbacks
    recent_feedback = await redis_client.get(company_id, "feedback:recent") or []
    if len(recent_feedback) % 5 == 0:
        return True
    
    return False


async def _incremental_model_update(
    company_id: str,
    feedback_request: PredictionFeedbackRequest
):
    """
    Executes a fast, incremental model update using the HybridPredictor's Online Learning mode.
    Adjusts weights without the overhead of a full hyper-parameter search.
    """
    try:        
        # Lazy import to reduce API startup time/memory
        from app.models.lstm_predictor import HybridDurationPredictor
        predictor = HybridDurationPredictor(company_id)
        
        task_data = {
            'priority': feedback_request.priority,
            'complexity_score': feedback_request.complexity_score,
            'required_skills': feedback_request.required_skill_ids,
            'title': feedback_request.title,
            'description': feedback_request.description
        }
        
        # Step: Apply Online Learning weights adjustment
        success = predictor.incremental_update(
            task_data=task_data,
            actual_hours=feedback_request.actual_hours
        )
        
        if success:
            await redis_client.set(
                company_id,
                "last_incremental_update",
                {"timestamp": datetime.now().isoformat()},
                ttl=86400 * 7
            )
        else:
            logger.info(f"Incremental update deferred for {company_id}")
            
    except Exception as e:
        logger.error(f"Background online learning crash: {str(e)}")
