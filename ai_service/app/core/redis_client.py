"""
core/redis_client.py - Async Redis Cache Client with Multi-Tenant Support.

Provides the RedisClient class which wraps aioredis with company-scoped key
prefixing to guarantee data isolation in a multi-tenant environment. All cache
operations (get, set, delete, scan) automatically namespace keys using the
pattern 'company:<id>:ai:<key>' so different companies never share cached data.
"""

import redis.asyncio as aioredis
import json
import logging
from typing import Optional, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """
    Async Redis client wrapper with multi-tenant support.

    Each cache operation automatically applies a company-scoped key prefix
    to prevent data leakage between tenants. The underlying connection uses
    a pooled aioredis client for efficient concurrent access.
    """
    
    def __init__(self):
        self.redis: Optional[aioredis.Redis] = None
        self._connection_pool = None
    
    async def connect(self):
        """
        Establishes the Redis connection using a shared connection pool.
        Configured via application settings (host, port, DB, optional password).

        Raises:
            Exception: If the Redis server is unreachable or authentication fails.
        """
        try:
            # Use connection pool
            self._connection_pool = aioredis.ConnectionPool.from_url(
                f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/{settings.REDIS_DB}",
                password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None,
                max_connections=50,  # Limit connections
                decode_responses=True
            )
            
            self.redis = aioredis.Redis(connection_pool=self._connection_pool)
            await self.redis.ping()
        except Exception:
            raise
    
    def _make_key(self, company_id: str, key: str) -> str:
        """
        Constructs a fully-scoped Redis key to enforce data isolation per company.

        Args:
            company_id (str): The tenant's unique identifier.
            key (str): The logical cache key for the operation.

        Returns:
            str: A namespaced Redis key in the format 'company:<id>:ai:<key>'.

        Raises:
            ValueError: If company_id is empty or None.
        """
        if not company_id:
            raise ValueError("Company ID is required for cache key")
        return f"company:{company_id}:ai:{key}"
    
    async def get(self, company_id: str, key: str) -> Optional[Any]:
        """
        Retrieves and deserializes a cached value for a given company.

        Args:
            company_id (str): The tenant's company identifier.
            key (str): The logical cache key.

        Returns:
            Optional[Any]: The deserialized cached object, or None if not found or on error.
        """
        if not self.redis:
            await self.connect()
        
        full_key = self._make_key(company_id, key)
        try:
            value = await self.redis.get(full_key)
            if value:
                return json.loads(value)
            return None
        except Exception:
            return None
    
    async def set(
        self, 
        company_id: str, 
        key: str, 
        value: Any, 
        ttl: int = None  # default to None, use settings in caller
    ) -> bool:
        """
        Serializes and stores a value in the cache with an expiry time.

        Args:
            company_id (str): The tenant's company identifier.
            key (str): The logical cache key.
            value (Any): The Python object to cache (must be JSON-serializable).
            ttl (int, optional): Time-to-live in seconds. Defaults to settings.CACHE_TTL_MEDIUM.

        Returns:
            bool: True if the value was stored successfully, False on error.
        """
        if not self.redis:
            await self.connect()
        
        # use settings.CACHE_TTL_MEDIUM if ttl not provided
        if ttl is None:
            ttl = settings.CACHE_TTL_MEDIUM
        
        full_key = self._make_key(company_id, key)
        try:
            serialized = json.dumps(value)
            await self.redis.setex(full_key, ttl, serialized)
            return True
        except Exception:
            return False
    
    async def delete(self, company_id: str, key: str) -> bool:
        """
        Deletes a single cache entry for a given company.

        Args:
            company_id (str): The tenant's company identifier.
            key (str): The logical cache key to remove.

        Returns:
            bool: True if deleted successfully, False on error.
        """
        if not self.redis:
            await self.connect()
        
        full_key = self._make_key(company_id, key)
        try:
            await self.redis.delete(full_key)
            return True
        except Exception:
            return False
    
    async def exists(self, company_id: str, key: str) -> bool:
        """
        Checks whether a cache entry exists for a given company.

        Args:
            company_id (str): The tenant's company identifier.
            key (str): The logical cache key to check.

        Returns:
            bool: True if the key exists, False otherwise or on error.
        """
        if not self.redis:
            await self.connect()
        
        full_key = self._make_key(company_id, key)
        try:
            return await self.redis.exists(full_key) > 0
        except Exception:
            return False
    
    async def invalidate_pattern(self, company_id: str, pattern: str):
        """
        Scans and deletes all cache entries matching a glob pattern for a company.
        Uses SCAN in batches of 100 to avoid blocking the Redis event loop.

        Args:
            company_id (str): The tenant's company identifier.
            pattern (str): A glob-style key pattern (e.g., 'analytics:*').
        """
        if not self.redis:
            await self.connect()
        
        full_pattern = self._make_key(company_id, pattern)
        try:
            cursor = 0
            while True:
                cursor, keys = await self.redis.scan(
                    cursor=cursor,
                    match=full_pattern,
                    count=100
                )
                if keys:
                    await self.redis.delete(*keys)
                if cursor == 0:
                    break
        except Exception as e:
            logger.error(f"Redis INVALIDATE error for {full_pattern}: {e}")
    
    async def ping(self) -> bool:
        """
        Tests connectivity to the Redis server.

        Returns:
            bool: True if the server responds, False on error.
        """
        if not self.redis:
            await self.connect()
        try:
            await self.redis.ping()
            return True
        except Exception:
            return False
    
    async def close(self):
        """
        Gracefully closes the Redis connection and releases pool resources.
        Should be called on application shutdown.
        """
        if self.redis:
            await self.redis.close()


# Module-level singleton shared across all API routers and background tasks.
redis_client = RedisClient()