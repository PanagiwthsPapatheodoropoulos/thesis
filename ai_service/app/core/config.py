"""
ai_service/app/core/config.py - Application Settings and Environment Configuration.
All service-wide settings are defined here using pydantic-settings, which reads
values from environment variables with fallback defaults for local development.
"""
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """
    Centralized configuration class for the AI service.
    Values are resolved from environment variables; defaults are used if a variable is absent.

    Attributes:
        JUNIOR_EXPERIENCE_YEARS (int): Minimum years of experience to classify as junior.
        SENIOR_EXPERIENCE_YEARS (int): Minimum years of experience to classify as senior.
        MIN_SKILL_COVERAGE (float): Minimum fraction of required skills an employee must match.
        BACKEND_API_URL (str): Base URL of the Spring Boot backend (e.g., http://backend:8080/api).
        REDIS_HOST (str): Hostname of the Redis cache server.
        REDIS_PORT (int): Port of the Redis cache server (default 6379).
        REDIS_DB (int): Redis database index to use (default 0).
        REDIS_PASSWORD (str): Redis AUTH password.
        CACHE_TTL_SHORT (int): Short cache TTL in seconds (default 5 minutes).
        CACHE_TTL_MEDIUM (int): Medium cache TTL in seconds (default 1 hour).
        CACHE_TTL_LONG (int): Long cache TTL in seconds (default 24 hours).
        MODEL_CACHE_DIR (str): Path on disk where downloaded ML models are stored.
        GENETIC_ALGORITHM_POPULATION (int): Population size for the GA optimizer.
        GENETIC_ALGORITHM_GENERATIONS (int): Number of generations for the GA optimizer.
        GENETIC_ALGORITHM_MUTATION_RATE (float): Mutation rate for GA offspring.
    """
    JUNIOR_EXPERIENCE_YEARS: int = 3
    SENIOR_EXPERIENCE_YEARS: int = 10
    MIN_SKILL_COVERAGE: float = 0.6
    # Backend connection
    BACKEND_API_URL: str = os.getenv("BACKEND_API_URL")
    
    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT"))
    REDIS_DB: int = int(os.getenv("REDIS_DB"))
    REDIS_PASSWORD: str = os.getenv("SPRING_REDIS_PASSWORD")
    

    CACHE_TTL_SHORT: int = int(os.getenv("CACHE_TTL_SHORT"))     # 5 minutes
    CACHE_TTL_MEDIUM: int = int(os.getenv("CACHE_TTL_MEDIUM"))  # 1 hour
    CACHE_TTL_LONG: int = int(os.getenv("CACHE_TTL_LONG"))     # 24 hours
    
    # Model settings
    MODEL_CACHE_DIR: str = os.getenv("MODEL_CACHE_DIR")
    
    # Genetic Algorithm
    GENETIC_ALGORITHM_POPULATION: int = int(os.getenv("GENETIC_ALGORITHM_POPULATION"))
    GENETIC_ALGORITHM_GENERATIONS: int = int(os.getenv("GENETIC_ALGORITHM_GENERATIONS"))
    GENETIC_ALGORITHM_MUTATION_RATE: float = float(os.getenv("GENETIC_ALGORITHM_MUTATION_RATE"))

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()