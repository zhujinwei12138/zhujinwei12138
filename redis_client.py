import os
import redis.asyncio as aioredis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Shared connection pool — created once on startup
_pool: aioredis.ConnectionPool | None = None
redis: aioredis.Redis | None = None


def init_redis():
    global _pool, redis
    _pool = aioredis.ConnectionPool.from_url(REDIS_URL, decode_responses=True)
    redis = aioredis.Redis(connection_pool=_pool)


async def close_redis():
    if _pool:
        await _pool.aclose()
