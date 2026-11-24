import uuid
from datetime import datetime
from pydantic import BaseModel, Field

# --- Projetos ---
class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120, examples=["production-api"])
    environment: str = Field(default="production", examples=["production", "staging"])

class ProjectCreatedResponse(BaseModel):
    id: uuid.UUID
    name: str
    environment: str
    api_key: str  # Retornada completa APENAS na criação
    api_key_prefix: str
    created_at: datetime

class ProjectListItem(BaseModel):
    id: uuid.UUID
    name: str
    environment: str
    api_key_prefix: str
    created_at: datetime

# --- Ingestão de Logs ---
class LogIngestRequest(BaseModel):
    message: str = Field(..., examples=["DatabaseConnectionError: Pool exhausted"])
    stack_trace: str = Field(..., examples=["Traceback (most recent call last):\n  File 'db.py', line 42..."])
    environment: str = Field(default="production", examples=["production"])
    metadata: dict = Field(default_factory=dict, examples=[{"user_id": 123, "endpoint": "/checkout"}])

# --- Clusters & Dashboard ---
class ClusterListItem(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    status: str
    occurrence_count: int
    last_seen_at: datetime

class HourlyMetric(BaseModel):
    hour: str
    count: int

class RcaResult(BaseModel):
    probable_cause: str
    suggested_fix: str
    confidence_score: int
    referenced_clusters: list[str] = []

class ClusterDetailResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    status: str
    occurrence_count: int
    normalized_stack: str
    resolution_notes: str | None
    ai_rca_cache: RcaResult | None
    last_seen_at: datetime
    hourly_frequency: list[HourlyMetric]

class ClusterResolveRequest(BaseModel):
    resolution_notes: str = Field(..., min_length=5, examples=["Aumentado o pool_size do SQLAlchemy de 10 para 50."])

class FileMetric(BaseModel):
    file: str
    count: int

class RecentLogItem(BaseModel):
    id: uuid.UUID
    cluster_id: uuid.UUID
    raw_message: str
    environment: str
    log_metadata: dict
    created_at: datetime

class DashboardSummaryResponse(BaseModel):
    active_clusters: int
    resolved_clusters: int
    events_24h: int
    anomalies_detected: int
    hourly_trend: list[HourlyMetric]
    top_files: list[FileMetric]
    clusters: list[ClusterListItem]