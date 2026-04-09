# ai_service/app/api/skills_extraction.py
"""
Skills Extraction API Endpoints.

This module provides REST API endpoints for extracting skills from task descriptions
using Natural Language Processing (NLP) techniques. It combines keyword-based matching
with semantic similarity using sentence transformers for accurate skill identification.

Key Features:
    - Single task skill extraction with confidence scores
    - Batch extraction for multiple tasks
    - Team skill suggestions based on task backlog analysis
    - Category-based skill classification

Dependencies:
    - SentenceTransformer model 'all-MiniLM-L6-v2' for semantic matching
    - Redis for caching extraction results
    - FastAPI for REST API framework

Note:
    The skill extractor is initialized at module load time and may load ML models
    lazily on first use. Ensure sufficient memory for model loading.

Example:
    POST /api/ai/skills/extract
    {
        "task_title": "Implement REST API with Spring Boot",
        "task_description": "Create CRUD endpoints for user management",
        "min_confidence": 0.5
    }
"""

from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
import logging
from pydantic import BaseModel

from app.models.skill_extractor import SkillExtractor, SkillCategory
from app.core.redis_client import redis_client
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize the core extraction engine (SentenceTransformers) at module startup
skill_extractor = SkillExtractor()


# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================

class SkillExtractionRequest(BaseModel):
    """
    Request model for extracting skills from a single task.

    Attributes:
        task_title (str): The title of the task to analyze.
        task_description (Optional[str]): Detailed description of the task.
            Defaults to empty string.
        min_confidence (Optional[float]): Minimum confidence threshold for
            skill extraction. Skills below this threshold are filtered out.
            Range: 0.0-1.0. Defaults to 0.4.

    Example:
        >>> request = SkillExtractionRequest(
        ...     task_title="Build React dashboard",
        ...     task_description="Create analytics dashboard with charts",
        ...     min_confidence=0.5
        ... )
    """
    task_title: str
    task_description: Optional[str] = ""
    min_confidence: Optional[float] = 0.4  # 0.0-1.0


class ExtractedSkillDTO(BaseModel):
    """
    Data Transfer Object for an extracted skill with metadata.

    Attributes:
        name (str): The name of the extracted skill (e.g., "Python", "React").
        category (str): The skill category (e.g., "Programming", "Frontend").
        confidence (float): Confidence score of the extraction (0.0-1.0).
            Higher values indicate more certain matches.
        source (str): Where the skill was identified from.
            Values: "title", "description", "keywords", "semantic".
        suggested_proficiency (int): Suggested proficiency level (1-5 scale).
            1=Beginner, 3=Intermediate, 5=Expert.
    """
    name: str
    category: str
    confidence: float
    source: str
    suggested_proficiency: int


class SkillExtractionResponse(BaseModel):
    """
    Response model containing all extracted skills from a task.

    Attributes:
        extracted_skills (List[ExtractedSkillDTO]): List of extracted skills
            with confidence scores and metadata.
        total_extracted (int): Total number of skills extracted.
        processing_time_ms (Optional[float]): Processing time in milliseconds.
            May be None if not measured.
    """
    extracted_skills: List[ExtractedSkillDTO]
    total_extracted: int
    processing_time_ms: Optional[float] = None


class SkillSuggestionRequest(BaseModel):
    """
    Request model for suggesting skills a team should develop.

    Analyzes team's task backlog to identify skills that are frequently
    required but not currently possessed by team members.

    Attributes:
        team_tasks (List[dict]): List of task dictionaries, each containing
            'title' and optionally 'description' fields.
        existing_skills (List[str]): List of skill names the team already
            possesses. These will be excluded from suggestions.

    Example:
        >>> request = SkillSuggestionRequest(
        ...     team_tasks=[{"title": "Build React app"}],
        ...     existing_skills=["JavaScript", "HTML"]
        ... )
    """
    team_tasks: List[dict]
    existing_skills: List[str] = []


class SkillSuggestionDTO(BaseModel):
    """
    Data Transfer Object for a suggested skill for team development.

    Attributes:
        skill_name (str): Name of the suggested skill.
        category (str): Category of the skill.
        frequency (int): Number of tasks requiring this skill.
        avg_confidence (float): Average extraction confidence across tasks.
        priority_score (float): Calculated priority score (frequency * avg_confidence).
            Higher scores indicate more important skills to acquire.
    """
    skill_name: str
    category: str
    frequency: int  # How many tasks need this
    avg_confidence: float
    priority_score: float


class SkillSuggestionsResponse(BaseModel):
    """
    Response model containing skill development suggestions.

    Attributes:
        suggestions (List[SkillSuggestionDTO]): Ordered list of skill suggestions,
            sorted by priority_score in descending order.
        total_suggestions (int): Total number of skill suggestions.
    """
    suggestions: List[SkillSuggestionDTO]
    total_suggestions: int



# ENDPOINTS
@router.post("/extract", response_model=SkillExtractionResponse)
async def extract_skills_from_task(
    request: SkillExtractionRequest,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Extract skills from a task's title and description.

    Uses NLP techniques including keyword matching and semantic similarity
    to identify required/relevant skills from the task text. Results are
    cached per company for performance.

    Args:
        request (SkillExtractionRequest): The task details including title,
            description, and minimum confidence threshold.
        authorization (str): Bearer token for authentication.
            Format: "Bearer <token>".
        x_company_id (str): Company UUID for multi-tenant isolation.
            Required for cache key scoping.

    Returns:
        SkillExtractionResponse: Contains list of extracted skills with
            confidence scores, categories, and suggested proficiency levels.

    Raises:
        HTTPException: 500 if skill extraction fails due to internal error.

    Example:
        >>> response = await extract_skills_from_task(
        ...     request=SkillExtractionRequest(
        ...         task_title="Build React Dashboard",
        ...         task_description="Create analytics dashboard with charts"
        ...     ),
        ...     authorization="Bearer token",
        ...     x_company_id="company-uuid"
        ... )
        >>> print(response.extracted_skills[0].name)  # "React"

    Note:
        Results are cached in Redis with TTL from settings.CACHE_TTL_LONG.
        The 'token' variable is extracted but not currently used - this is
        a potential issue if authentication validation is intended.

    Issue Found:
        - Variable 'token' is extracted from authorization header but never used.
          This suggests either dead code or missing authentication validation.
    """
    token = authorization.replace("Bearer ", "")
    
    try:
        # Check cache
        cache_key = f"skills:extract:{hash(request.task_title + request.task_description)}"
        cached = await redis_client.get(x_company_id, cache_key)
        if cached:
            return cached
        
        # Extract skills
        extracted = skill_extractor.extract_skills(
            title=request.task_title,
            description=request.task_description,
            min_confidence=request.min_confidence
        )
        
        # Convert to DTOs
        skill_dtos = [
            ExtractedSkillDTO(
                name=skill.name,
                category=skill.category.value,
                confidence=round(skill.confidence, 3),
                source=skill.source,
                suggested_proficiency=skill.suggested_proficiency
            )
            for skill in extracted
        ]
        
        response = SkillExtractionResponse(
            extracted_skills=skill_dtos,
            total_extracted=len(skill_dtos)
        )
        
        # Cache result
        await redis_client.set(
            x_company_id,
            cache_key,
            response.dict(),
            ttl=settings.CACHE_TTL_LONG
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suggest-for-team", response_model=SkillSuggestionsResponse)
async def suggest_team_skills(
    request: SkillSuggestionRequest,
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Identifies skills the team should develop based on their current task backlog.
    Skills already possessed by the team are excluded from the suggestions.
    Results are ranked by priority_score (frequency multiplied by confidence).

    Args:
        request (SkillSuggestionRequest): Backlog tasks and current team skills.
        authorization (str): Auth token.
        x_company_id (str): Organization ID.

    Returns:
        SkillSuggestionsResponse: Prioritized list of skill development targets.

    Raises:
        HTTPException: 500 on internal extraction failure.
    """
        
    token = authorization.replace("Bearer ", "")
    
    try:
        # Get suggestions
        suggestions = skill_extractor.suggest_skills_for_team(
            team_tasks=request.team_tasks,
            existing_skills=request.existing_skills
        )
        
        # Convert to DTOs
        suggestion_dtos = [
            SkillSuggestionDTO(
                skill_name=s['skill_name'],
                category=s['category'],
                frequency=s['frequency'],
                avg_confidence=round(s['avg_confidence'], 3),
                priority_score=round(s['priority_score'], 3)
            )
            for s in suggestions
        ]
        
        response = SkillSuggestionsResponse(
            suggestions=suggestion_dtos,
            total_suggestions=len(suggestion_dtos)
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/categories")
async def get_skill_categories(
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Returns the list of all skill category types supported by the extractor.
    Used to populate filter dropdowns and group skills in the UI.

    Returns:
        dict: A list of category objects with id, name, and display_name.
    """
    
    categories = [
        {
            'id': cat.value,
            'name': cat.value,
            'display_name': cat.value.replace('_', ' ')
        }
        for cat in SkillCategory
    ]
    
    return {
        'categories': categories,
        'total': len(categories)
    }


@router.post("/batch-extract")
async def batch_extract_skills(
    tasks: List[SkillExtractionRequest],
    authorization: str = Header(...),
    x_company_id: str = Header(...)
):
    """
    Extracts skills from multiple task descriptions in a single request.
    Processes each task independently and returns all results together.

    Args:
        tasks (List[SkillExtractionRequest]): A collection of task data objects.
        authorization (str): Auth token.
        x_company_id (str): Organization ID.

    Returns:
        dict: A summary of all extracted entities grouped by task, with totals.

    Raises:
        HTTPException: 500 if the extraction process fails for any task.
    """
        
    try:
        results = []
        
        for task_req in tasks:
            extracted = skill_extractor.extract_skills(
                title=task_req.task_title,
                description=task_req.task_description,
                min_confidence=task_req.min_confidence
            )
            
            results.append({
                'task_title': task_req.task_title,
                'extracted_skills': [
                    {
                        'name': s.name,
                        'category': s.category.value,
                        'confidence': round(s.confidence, 3),
                        'proficiency': s.suggested_proficiency
                    }
                    for s in extracted
                ]
            })
        
        return {
            'results': results,
            'total_tasks': len(results),
            'total_skills_extracted': sum(len(r['extracted_skills']) for r in results)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@router.on_event("startup")
async def startup_check():
    """
    Bootstrap probe that runs at application startup to warm up the NLP models.
    Prevents the first real request from suffering from high cold-start latency.
    """
    try:
        # Test skill extractor
        test_result = skill_extractor.extract_skills("test", "test", min_confidence=0.9)
    except Exception as e:
        logger.error(f"Skill extractor startup failed: {e}")