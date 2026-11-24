import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
import redis.asyncio as redis

from app.core.redis import get_redis
from app.core.security import verify_api_key
from app.db.models import Project
from app.schemas.api import LogIngestRequest

router = APIRouter(prefix="/ingest", tags=["Ingest"])


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def ingest_log(
    payload: LogIngestRequest,
    project: Project = Depends(verify_api_key),
    redis_conn: redis.Redis = Depends(get_redis),
):
    queue_item = {
        "project_id": str(project.id),
        "message": payload.message,
        "stack_trace": payload.stack_trace,
        "environment": payload.environment,
        "metadata": payload.metadata,
        "received_at": datetime.now(timezone.utc).isoformat(),
    }

    await redis_conn.lpush("logs_queue", json.dumps(queue_item))

    return {"status": "queued", "project": project.name}