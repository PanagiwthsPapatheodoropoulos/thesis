# ai_service/app/api/task_analysis.py
"""
api/task_analysis.py - NLP-based Task Analysis and Complexity Estimation.
This module provides endpoints for analyzing task descriptions using natural language
processing to determine complexity scores, risk levels, effort estimates, and category
classification. It also supports backlog prioritization for organizational planning.
"""

from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from typing import List, Optional
import logging
from pydantic import BaseModel
import time

from app.models.task_analyzer import TaskComplexityAnalyzer, TaskCategory
from app.core.redis_client import redis_client
from app.core.config import settings
from app.core.backend_client import backend_client

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize analyzer (loads models on startup)
task_analyzer = TaskComplexityAnalyzer()


# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================

class TaskAnalysisRequest(BaseModel):
    """
    Input for analyzing a task via its title and optional description.

    Attributes:
        title (str): The task title used as the primary classification signal.
        description (Optional[str]): Extended details for more accurate scoring.
    """
    title: str
    description: Optional[str] = ""


class ComplexityFactorsDTO(BaseModel):
    """
    Breakdown of the sub-scores contributing to the overall task complexity.

    Attributes:
        keyword_score (float): Score from high-complexity keyword detection.
        semantic_score (float): Score from semantic embedding similarity.
        linguistic_complexity (float): Lexical diversity and sentence complexity.
        scope_indicators (float): Signals of broad multi-component scope.
        dependency_indicators (float): Signals of blocking dependencies on other tasks.
    """
    keyword_score: float
    semantic_score: float
    linguistic_complexity: float
    scope_indicators: float
    dependency_indicators: float


class TaskAnalysisResponse(BaseModel):
    """
    Comprehensive response from the NLP analysis pipeline.

    Attributes:
        complexity_score (float): Normalized composite score (0.0 to 1.0).
        complexity_factors (ComplexityFactorsDTO): Breakdown of sub-scores.
        category (str): Predicted task type (e.g., BUG_FIX, FEATURE_DEVELOPMENT).
        category_confidence (float): Confidence of the category prediction.
        effort_hours_estimate (float): Estimated hours to complete the task.
        effort_confidence (float): Confidence of the effort estimate.
        risk_level (str): Assessed risk level (LOW, MEDIUM, HIGH).
        blocking_factors (List[str]): Detected blockers or dependencies.
        dependencies_detected (bool): Whether cross-task dependencies were found.
        estimated_components (int): Approximate number of work units.
        required_expertise (List[str]): Skills likely needed.
        reasoning (str): Human-readable explanation of the scores.
    """
    complexity_score: float
    complexity_factors: ComplexityFactorsDTO
    category: str
    category_confidence: float
    effort_hours_estimate: float
    effort_confidence: float
    risk_level: str
    blocking_factors: List[str]
    dependencies_detected: bool
    estimated_components: int
    required_expertise: List[str]
    reasoning: str


class BatchTaskAnalysisRequest(BaseModel):
    """
    Request to analyze multiple tasks in a single API call.

    Attributes:
        tasks (List[TaskAnalysisRequest]): A list of task items to analyze.
    """
    tasks: List[TaskAnalysisRequest]


class BatchAnalysisResult(BaseModel):
    """
    The analysis result for a single task within a batch request.

    Attributes:
        title (str): The task title.
        analysis (TaskAnalysisResponse): Full analysis data for this task.
    """
    title: str
    analysis: TaskAnalysisResponse


class BatchTaskAnalysisResponse(BaseModel):
    """
    Aggregated results from a batch analysis request.

    Attributes:
        results (List[BatchAnalysisResult]): Per-task analysis data.
        total_tasks (int): Number of tasks analyzed.
        average_complexity (float): Mean complexity score across all tasks.
    """
    results: List[BatchAnalysisResult]
    total_tasks: int
    average_complexity: float


class EstimationRequest(BaseModel):
    """
    A lightweight request for effort estimation without full analysis.

    Attributes:
        complexity_score (float): A pre-computed complexity value.
        description (Optional[str]): Optional description for improved confidence.
    """
    complexity_score: float
    description: Optional[str] = ""



# ENDPOINTS

@router.post("/analyze", response_model=TaskAnalysisResponse)
async def analyze_task(
    request: TaskAnalysisRequest,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Performs a full NLP analysis on a single task.

    Args:
        request (TaskAnalysisRequest): The task with title and optional description.
        authorization (str): Auth token.
        x_company_id (str): Organization ID for cache scoping.

    Returns:
        TaskAnalysisResponse: Complexity score, category, effort estimate, and risk data.

    Raises:
        HTTPException: 500 on internal analysis failure.
    """
    
    start_time = time.time()
    
    token = authorization.replace("Bearer ", "")
    
    try:
        # Check cache
        cache_key = f"analysis:{hash(request.title + (request.description or ''))}"
        cached = await redis_client.get(x_company_id, cache_key)
        if cached:
            return cached
        
        # Analyze task
        analysis = task_analyzer.analyze_task(
            title=request.title,
            description=request.description or "",
            existing_tasks=None
        )
        
        # Convert to response
        response = TaskAnalysisResponse(
            complexity_score=analysis.complexity_score,
            complexity_factors=ComplexityFactorsDTO(**analysis.complexity_factors),
            category=analysis.category.value,
            category_confidence=analysis.category_confidence,
            effort_hours_estimate=analysis.effort_hours_estimate,
            effort_confidence=analysis.effort_confidence,
            risk_level=analysis.risk_level,
            blocking_factors=analysis.blocking_factors,
            dependencies_detected=analysis.dependencies_detected,
            estimated_components=analysis.estimated_components,
            required_expertise=analysis.required_expertise,
            reasoning=analysis.reasoning
        )
        
        # Cache result
        await redis_client.set(
            x_company_id,
            cache_key,
            response.dict(),
            ttl=settings.CACHE_TTL_LONG
        )
        
        elapsed = time.time() - start_time
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/estimate-effort", response_model=dict)
async def estimate_effort(
    request: EstimationRequest,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Returns a quick effort estimate based solely on complexity score.
    Lighter than a full analysis pass, suitable for real-time UI hints.

    Args:
        request (EstimationRequest): A pre-scored complexity value.
        authorization (str): Auth token.
        x_company_id (str): Organization ID.

    Returns:
        dict: Estimated hours, working days, confidence, and recommended range.
    """
        
    try:
        # Use the effort mapping
        effort = task_analyzer._estimate_effort(
            request.complexity_score,
            request.description or ""
        )
        
        # Add confidence based on description detail
        confidence = 0.7 if request.description else 0.4
        
        return {
            "complexity_score": request.complexity_score,
            "estimated_hours": round(effort, 1),
            "estimated_days": round(effort / 8, 1),
            "effort_confidence": confidence,
            "range": {
                "low": round(effort * 0.7, 1),
                "high": round(effort * 1.3, 1)
            },
            "recommendation": (
                "Quick task - can start immediately"
                if effort < 4
                else "Plan for next available slot"
                if effort < 16
                else "Requires planning and resource allocation"
            )
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-analyze", response_model=BatchTaskAnalysisResponse)
async def batch_analyze_tasks(
    request: BatchTaskAnalysisRequest,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Analyzes a collection of tasks in a single request.
    Useful for bulk imports, backlog reviews, or capacity planning sessions.

    Args:
        request (BatchTaskAnalysisRequest): A list of tasks to analyze.
        authorization (str): Auth token.
        x_company_id (str): Organization ID.

    Returns:
        BatchTaskAnalysisResponse: Per-task analyses and aggregate statistics.
    """
        
    token = authorization.replace("Bearer ", "")
    
    try:
        results = []
        complexities = []
        
        for task_req in request.tasks:
            analysis = task_analyzer.analyze_task(
                title=task_req.title,
                description=task_req.description or ""
            )
            
            response = TaskAnalysisResponse(
                complexity_score=analysis.complexity_score,
                complexity_factors=ComplexityFactorsDTO(**analysis.complexity_factors),
                category=analysis.category.value,
                category_confidence=analysis.category_confidence,
                effort_hours_estimate=analysis.effort_hours_estimate,
                effort_confidence=analysis.effort_confidence,
                risk_level=analysis.risk_level,
                blocking_factors=analysis.blocking_factors,
                dependencies_detected=analysis.dependencies_detected,
                estimated_components=analysis.estimated_components,
                required_expertise=analysis.required_expertise,
                reasoning=analysis.reasoning
            )
            
            results.append(BatchAnalysisResult(
                title=task_req.title,
                analysis=response
            ))
            
            complexities.append(analysis.complexity_score)
        
        avg_complexity = sum(complexities) / len(complexities) if complexities else 0
        
        return BatchTaskAnalysisResponse(
            results=results,
            total_tasks=len(results),
            average_complexity=round(avg_complexity, 2)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auto-assign-complexity")
async def auto_assign_complexity(
    task_id: str,
    authorization: str = Header(...),
    x_company_id: str = Header(...),
    background_tasks: BackgroundTasks = None
):
    """
    Fetches a task from the backend and automatically assigns its complexity score and category.
    Used for retroactively analyzing tasks that did not receive scores at creation time.

    Args:
        task_id (str): The UUID of the task to analyze.
        authorization (str): Auth token.
        x_company_id (str): Organization ID.
        background_tasks (BackgroundTasks): Optional FastAPI background manager.

    Returns:
        dict: The computed complexity and category fields, ready for persistence.
    """
        
    token = authorization.replace("Bearer ", "")
    
    try:
        # Fetch task from backend
        task = await backend_client.get_task_by_id(task_id, token, x_company_id)
        
        # Analyze it
        analysis = task_analyzer.analyze_task(
            title=task.get('title', ''),
            description=task.get('description', '')
        )
        
        # Update task with scores
        update_data = {
            'complexityScore': analysis.complexity_score,
            'taskCategory': analysis.category.value
        }
        
        return {
            "task_id": task_id,
            "updated_fields": update_data,
            "analysis": {
                "complexity": analysis.complexity_score,
                "category": analysis.category.value,
                "effort_hours": analysis.effort_hours_estimate,
                "risk_level": analysis.risk_level
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _get_category_description(cat: TaskCategory) -> str:
    """
    Returns a human-readable description for a given task category enum value.

    Args:
        cat (TaskCategory): The task category to describe.

    Returns:
        str: A brief description of the category.
    """
    descriptions = {
        TaskCategory.BUG_FIX: "Fix reported issues or bugs",
        TaskCategory.FEATURE_DEVELOPMENT: "Implement new features",
        TaskCategory.REFACTORING: "Improve code without changing behavior",
        TaskCategory.DOCUMENTATION: "Write or update documentation",
        TaskCategory.TESTING: "Write tests or perform QA",
        TaskCategory.DEPLOYMENT: "Deploy or release code",
        TaskCategory.INFRASTRUCTURE: "Infrastructure or DevOps work",
        TaskCategory.PERFORMANCE: "Optimize performance",
        TaskCategory.SECURITY: "Security improvements or fixes",
        TaskCategory.MAINTENANCE: "General maintenance work",
        TaskCategory.CODE_REVIEW: "Code review activities",
        TaskCategory.RESEARCH: "Research or proof of concept",
        TaskCategory.CONFIGURATION: "Configuration or setup work",
        TaskCategory.INTEGRATION: "Integration with other systems",
        TaskCategory.UNKNOWN: "Unclassified task"
    }
    return descriptions.get(cat, "")

@router.get("/categories")
async def get_task_categories(
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Returns the static list of all task category types used by the classifier.
    Used to populate dropdowns and filter controls in the frontend.

    Returns:
        dict: A list of category objects with id, name, and display_name.
    """
    
    categories = [
        {
            'id': cat.value,
            'name': cat.value,
            'description': self._get_category_description(cat)
        }
        for cat in TaskCategory
    ]
    
    return {
        'categories': categories,
        'total': len(categories)
    }




@router.post("/prioritize-backlog")
async def prioritize_backlog(
    tasks: List[TaskAnalysisRequest],
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Analyzes and sorts a list of tasks by calculated priority.
    Each task receives a priority_score weighted from complexity, risk, and effort.

    Args:
        tasks (List[TaskAnalysisRequest]): The backlog items to rank.
        authorization (str): Auth token.
        x_company_id (str): Organization ID.

    Returns:
        dict: A ranked list with priority scores and scheduling recommendations.
    """
        
    try:
        analyzed = []
        
        for task in tasks:
            analysis = task_analyzer.analyze_task(
                title=task.title,
                description=task.description or ""
            )
            
            # Calculate priority score (higher = more urgent)
            priority_score = (
                analysis.complexity_score * 0.4 +
                (0.3 if analysis.risk_level == "HIGH" else 0.1) * 0.3 +
                min(analysis.effort_hours_estimate / 40, 1.0) * 0.3
            )
            
            analyzed.append({
                'title': task.title,
                'complexity': analysis.complexity_score,
                'category': analysis.category.value,
                'effort_hours': analysis.effort_hours_estimate,
                'risk_level': analysis.risk_level,
                'priority_score': round(priority_score, 2),
                'rank_recommendation': (
                    "DO FIRST" if priority_score > 0.7
                    else "DO SOON" if priority_score > 0.5
                    else "SCHEDULE LATER"
                )
            })
        
        # Sort by priority
        analyzed.sort(key=lambda x: x['priority_score'], reverse=True)
        
        return {
            'total_tasks': len(analyzed),
            'prioritized': analyzed
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))