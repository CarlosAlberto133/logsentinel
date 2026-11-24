from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_api_key
from app.db.models import Project
from app.db.session import get_db
from app.schemas.api import ProjectCreate, ProjectCreatedResponse, ProjectListItem

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.post("", response_model=ProjectCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, db: AsyncSession = Depends(get_db)):
    full_key, key_hash, masked_prefix = generate_api_key(payload.environment)

    project = Project(
        name=payload.name,
        environment=payload.environment,
        api_key_hash=key_hash,
        api_key_prefix=masked_prefix,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    return ProjectCreatedResponse(
        id=project.id,
        name=project.name,
        environment=project.environment,
        api_key=full_key,
        api_key_prefix=project.api_key_prefix,
        created_at=project.created_at,
    )

@router.get("", response_model=list[ProjectListItem])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return result.scalars().all()