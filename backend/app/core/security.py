import hashlib
import secrets
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Project
from app.db.session import get_db

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def generate_api_key(environment: str) -> tuple[str, str, str]:
    """Retorna (chave_plana, hash_sha256, prefixo_mascarado)."""
    prefix_env = "ls_live_" if environment == "production" else "ls_test_"
    raw_token = secrets.token_hex(24)
    full_key = f"{prefix_env}{raw_token}"
    key_hash = hashlib.sha256(full_key.encode()).hexdigest()
    masked_prefix = f"{prefix_env}••••••••{raw_token[-4:]}"
    return full_key, key_hash, masked_prefix

def hash_api_key(api_key: str) -> str:
    """Retorna o hash SHA256 da chave de API."""
    return hashlib.sha256(api_key.encode()).hexdigest()

async def verify_api_key(
    api_key: str | None = Security(api_key_header),
    db: AsyncSession = Depends(get_db),
) -> Project:
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header X-API-Key ausente.",
        )

    key_hash = hash_api_key(api_key)
    result = await db.execute(select(Project).where(Project.api_key_hash == key_hash))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key inválida.",
        )

    return project