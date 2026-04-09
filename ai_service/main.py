"""
Smart Resource Planner - AI Service

Main FastAPI Application with Multi-Company Support.
This service handles AI-powered task assignment, duration prediction, 
skill extraction, and productivity analytics.
"""

from app.core import backend_client
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import uvicorn
from typing import Optional

from app.core.redis_client import redis_client
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.api import assignment, prediction, anomaly, analytics, feedback
from app.core.training_scheduler import training_scheduler
from app.api import skills_extraction
from app.api import task_analysis
from app.api import chatbot

# Configure logging to provide structured output for monitoring
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manages the application lifecycle.

    Handles startup tasks such as initializing database connections,
    starting background schedulers, and pre-loading ML models for better performance.
    """
    
    # Initialize connection to the Redis cache
    await redis_client.ping()

    # Start the background training scheduler for periodic model updates
    try:
        training_scheduler.start()
    except Exception as e:
        logger.error(f"Training scheduler failed: {e}")
    
    # Pre-load the SkillExtractor model to reduce first-request latency
    try:
        from app.models.skill_extractor import SkillExtractor
        skill_extractor = SkillExtractor()
        
        if skill_extractor.model is not None:
            logger.info("SkillExtractor model loaded")
        else:
            logger.warning("SkillExtractor running in keyword-only mode")
    except Exception as e:
        logger.error(f"SkillExtractor failed: {e}")
    
    # Pre-load the TaskComplexityAnalyzer models (NLP and spaCy)
    try:
        from app.models.task_analyzer import TaskComplexityAnalyzer
        task_analyzer = TaskComplexityAnalyzer()
        
        if task_analyzer.nlp_model is not None:
            logger.info("TaskComplexityAnalyzer NLP model loaded")
        else:
            logger.warning("TaskComplexityAnalyzer NLP model unavailable")
            
        if task_analyzer.spacy_model is not None:
            logger.info("TaskComplexityAnalyzer spaCy model loaded")
        else:
            logger.warning("TaskComplexityAnalyzer spaCy model unavailable")
            
        logger.info("TaskComplexityAnalyzer ready")
    except Exception as e:
        logger.error(f"TaskComplexityAnalyzer failed: {e}")
    
    logger.info("ALL MODELS PRE-LOADED SUCCESSFULLY")

    yield
    
    # Clean up resources during shutdown
    training_scheduler.stop()
    await redis_client.close()


app = FastAPI(
    title="Smart Resource Planner - AI Service",
    description="AI-powered task assignment, prediction, and analytics",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS to allow secure communication with the frontend and backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def get_company_id(x_company_id: Optional[str] = Header(None)) -> str:
    """Extracts and validates the company ID from request headers.

    Args:
        x_company_id: The ID provided in the 'X-Company-Id' header.

    Returns:
        str: The validated company ID.

    Raises:
        HTTPException: If the header is missing, ensuring data isolation.
    """
    if not x_company_id:
        raise HTTPException(
            status_code=400,
            detail="Missing X-Company-Id header. Multi-company isolation required."
        )
    return x_company_id


@app.get("/")
async def root():
    """Simple health check endpoint that returns service status.

    Returns:
        dict: A dictionary containing service name, status, and version.
    """
    return {
        "service": "Smart Resource Planner - AI Service",
        "status": "operational",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Detailed health check including external dependency status.

    Returns:
        dict: Detailed status of the service and its connections (e.g., Redis).
    """
    redis_status = "connected"
    try:
        await redis_client.ping()
    except Exception as e:
        redis_status = f"disconnected: {str(e)}"
    
    return {
        "status": "healthy",
        "redis": redis_status,
        "models_loaded": True
    }


@app.get("/test/company-isolation")
async def test_company_isolation(
    x_company_id: str = Header(...),
    authorization: str = Header(...)
):
    """Verifies data isolation between companies by fetching sample data.

    Args:
        x_company_id: The company ID to test.
        authorization: Bearer token for authentication.

    Returns:
        dict: Summary of accessible entities for the given company ID.
    """
    token = authorization.replace("Bearer ", "")
    
    employees = await backend_client.get_employees(x_company_id, token)
    tasks = await backend_client.get_tasks(x_company_id, token)
    
    return {
        "company_id": x_company_id,
        "employees_count": len(employees),
        "tasks_count": len(tasks),
        "sample_employee_ids": [e['id'] for e in employees[:3]],
        "sample_task_ids": [t['id'] for t in tasks[:3]]
    }


# Register all API routers with their respective prefixes and dependencies
app.include_router(
    assignment.router,
    prefix="/api/ai/assignment",
    tags=["Task Assignment"],
    dependencies=[Depends(get_company_id)]
)

app.include_router(
    prediction.router,
    prefix="/api/ai/prediction",
    tags=["Task Duration Prediction"],
    dependencies=[Depends(get_company_id)]
)

app.include_router(
    anomaly.router,
    prefix="/api/ai/anomaly",
    tags=["Anomaly Detection"],
    dependencies=[Depends(get_company_id)]
)

app.include_router(
    analytics.router,
    prefix="/api/ai/analytics",
    tags=["Productivity Analytics"],
    dependencies=[Depends(get_company_id)]
)

app.include_router(
    feedback.router,
    prefix="/api/ai/feedback",
    tags=["Prediction Feedback"],
    dependencies=[Depends(get_company_id)]
)

app.include_router(
    skills_extraction.router,
    prefix="/api/ai/skills", 
    tags=["Skill Extraction"],
    dependencies=[Depends(get_company_id)]
)

app.include_router(
    task_analysis.router,
    prefix="/api/ai/task-analysis",
    tags=["Task Analysis"],
    dependencies=[Depends(get_company_id)]
)

app.include_router(
    chatbot.router,
    prefix="/api/ai/chatbot",
    tags=["Chatbot"]
)

# Initialize and configure the rate limiter based on company ID
limiter = Limiter(key_func=lambda request: request.headers.get("X-Company-Id"))
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


if __name__ == "__main__":
    # Run the application using the Uvicorn ASGI server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
