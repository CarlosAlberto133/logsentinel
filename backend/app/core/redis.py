import redis.asyncio as redis

REDIS_URL = "redis://localhost:6379/0"

redis_client = redis.from_url(
    REDIS_URL,
    decode_responses=True,
    socket_timeout=None,
    socket_connect_timeout=5,
)

async def get_redis():
    return redis_client