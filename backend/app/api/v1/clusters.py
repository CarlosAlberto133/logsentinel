import json
import re
import uuid
from collections import Counter
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from openai import AsyncOpenAI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models import ErrorCluster, ErrorLog
from app.db.session import get_db
from app.schemas.api import (
    ClusterDetailResponse,
    ClusterListItem,
    ClusterResolveRequest,
    DashboardSummaryResponse,
    FileMetric,
    HourlyMetric,
    RcaResult,
    RecentLogItem,
)

router = APIRouter(prefix="/clusters", tags=["Clusters"])

FILE_REGEX = re.compile(r"File ['\"]([^'\"]+)['\"]")


@router.get("", response_model=DashboardSummaryResponse)
async def list_clusters(
    project_id: uuid.UUID | None = Query(default=None),
    env: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ErrorCluster).order_by(ErrorCluster.last_seen_at.desc())

    if project_id:
        stmt = stmt.where(ErrorCluster.project_id == project_id)
    if status and status.upper() != "ALL":
        stmt = stmt.where(ErrorCluster.status == status.upper())
    if env and env.lower() != "all":
        stmt = stmt.where(
            ErrorCluster.id.in_(
                select(ErrorLog.cluster_id).where(ErrorLog.environment == env)
            )
        )

    result = await db.execute(stmt)
    clusters = result.scalars().all()

    active_count = sum(1 for c in clusters if c.status == "OPEN")
    resolved_count = sum(1 for c in clusters if c.status == "RESOLVED")
    anomalies_count = sum(1 for c in clusters if c.status == "OPEN" and c.occurrence_count >= 10)

    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    logs_stmt = select(ErrorLog.created_at, ErrorLog.normalized_stack).where(
        ErrorLog.created_at >= since_24h
    )
    if project_id:
        logs_stmt = logs_stmt.join(ErrorCluster).where(ErrorCluster.project_id == project_id)
    if env and env.lower() != "all":
        logs_stmt = logs_stmt.where(ErrorLog.environment == env)

    recent_rows = (await db.execute(logs_stmt)).all()
    events_24h = len(recent_rows)

    # Série temporal global das últimas 24h
    now = datetime.now(timezone.utc)
    buckets: dict[str, int] = {
        (now - timedelta(hours=i)).strftime("%H:00"): 0 for i in range(23, -1, -1)
    }
    file_counter: Counter[str] = Counter()

    for created_at, stack in recent_rows:
        label = created_at.strftime("%H:00")
        if label in buckets:
            buckets[label] += 1
        if stack:
            matches = FILE_REGEX.findall(stack)
            if matches:
                file_counter[matches[-1]] += 1

    hourly_trend = [HourlyMetric(hour=h, count=c) for h, c in buckets.items()]
    top_files = [FileMetric(file=f, count=cnt) for f, cnt in file_counter.most_common(6)]

    return DashboardSummaryResponse(
        active_clusters=active_count,
        resolved_clusters=resolved_count,
        events_24h=events_24h,
        anomalies_detected=anomalies_count,
        hourly_trend=hourly_trend,
        top_files=top_files,
        clusters=[
            ClusterListItem(
                id=c.id,
                project_id=c.project_id,
                title=c.title,
                status=c.status,
                occurrence_count=c.occurrence_count,
                last_seen_at=c.last_seen_at,
            )
            for c in clusters
        ],
    )


@router.get("/logs/recent", response_model=list[RecentLogItem])
async def list_recent_logs(
    project_id: uuid.UUID | None = Query(default=None),
    env: str | None = Query(default=None),
    limit: int = Query(default=40, le=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ErrorLog).order_by(ErrorLog.created_at.desc()).limit(limit)
    if project_id:
        stmt = stmt.join(ErrorCluster).where(ErrorCluster.project_id == project_id)
    if env and env.lower() != "all":
        stmt = stmt.where(ErrorLog.environment == env)

    logs = (await db.execute(stmt)).scalars().all()
    return [
        RecentLogItem(
            id=log.id,
            cluster_id=log.cluster_id,
            raw_message=log.raw_message,
            environment=log.environment,
            log_metadata=log.log_metadata or {},
            created_at=log.created_at,
        )
        for log in logs
    ]


@router.get("/{cluster_id}", response_model=ClusterDetailResponse)
async def get_cluster_detail(cluster_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    cluster = await db.get(ErrorCluster, cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster não encontrado.")

    latest_log_stmt = (
        select(ErrorLog.normalized_stack)
        .where(ErrorLog.cluster_id == cluster_id)
        .order_by(ErrorLog.created_at.desc())
        .limit(1)
    )
    normalized_stack = (await db.execute(latest_log_stmt)).scalar() or cluster.title

    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    logs_stmt = select(ErrorLog.created_at).where(
        ErrorLog.cluster_id == cluster_id,
        ErrorLog.created_at >= since_24h,
    )
    timestamps = (await db.execute(logs_stmt)).scalars().all()

    now = datetime.now(timezone.utc)
    buckets: dict[str, int] = {
        (now - timedelta(hours=i)).strftime("%H:00"): 0 for i in range(23, -1, -1)
    }
    for ts in timestamps:
        label = ts.strftime("%H:00")
        if label in buckets:
            buckets[label] += 1

    hourly_frequency = [HourlyMetric(hour=h, count=c) for h, c in buckets.items()]

    return ClusterDetailResponse(
        id=cluster.id,
        project_id=cluster.project_id,
        title=cluster.title,
        status=cluster.status,
        occurrence_count=cluster.occurrence_count,
        normalized_stack=normalized_stack,
        resolution_notes=cluster.resolution_notes,
        ai_rca_cache=cluster.ai_rca_cache,
        last_seen_at=cluster.last_seen_at,
        hourly_frequency=hourly_frequency,
    )


@router.patch("/{cluster_id}/resolve")
async def resolve_cluster(
    cluster_id: uuid.UUID,
    payload: ClusterResolveRequest,
    db: AsyncSession = Depends(get_db),
):
    cluster = await db.get(ErrorCluster, cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster não encontrado.")

    cluster.status = "RESOLVED"
    cluster.resolution_notes = payload.resolution_notes
    await db.commit()
    return {"status": "RESOLVED", "cluster_id": str(cluster.id)}


@router.post("/{cluster_id}/analyze", response_model=RcaResult)
async def analyze_root_cause(cluster_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    cluster = await db.get(ErrorCluster, cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster não encontrado.")

    distance_expr = ErrorCluster.embedding.cosine_distance(cluster.embedding).label("distance")
    rag_stmt = (
        select(ErrorCluster, distance_expr)
        .where(
            ErrorCluster.project_id == cluster.project_id,
            ErrorCluster.status == "RESOLVED",
            ErrorCluster.id != cluster.id,
            ErrorCluster.resolution_notes.is_not(None),
        )
        .order_by(distance_expr.asc())
        .limit(3)
    )
    similar_rows = (await db.execute(rag_stmt)).all()
    past_resolutions = [
        f"- Erro: {row.ErrorCluster.title} | Solução aplicada: {row.ErrorCluster.resolution_notes}"
        for row in similar_rows
        if row.distance < 0.35
    ]
    referenced_titles = [row.ErrorCluster.title for row in similar_rows if row.distance < 0.35]

    latest_stack_stmt = (
        select(ErrorLog.normalized_stack).where(ErrorLog.cluster_id == cluster_id).limit(1)
    )
    stack_trace = (await db.execute(latest_stack_stmt)).scalar() or cluster.title

    if not settings.LLM_API_KEY:
        rca_data = RcaResult(
            probable_cause=f"Falha recorrente detectada em '{cluster.title}' ({cluster.occurrence_count} ocorrências).",
            suggested_fix="# Verifique limites de timeout e pool de conexões no trecho apontado.",
            confidence_score=85 if past_resolutions else 72,
            referenced_clusters=referenced_titles,
        )
    else:
        client = AsyncOpenAI(
            api_key=settings.LLM_API_KEY,
            base_url=settings.LLM_BASE_URL,
        )
        context_block = "\n".join(past_resolutions) if past_resolutions else "Nenhuma resolução histórica similar encontrada."
        prompt = (
            "Você é um engenheiro SRE sênior analisando um erro de produção.\n"
            f"Stack trace normalizado:\n{stack_trace}\n\n"
            f"Histórico de erros similares já resolvidos pela equipe:\n{context_block}\n\n"
            "Responda APENAS com um JSON válido contendo as chaves: "
            "'probable_cause' (string em português), 'suggested_fix' (trecho de código ou comando), "
            "'confidence_score' (inteiro de 0 a 100)."
        )
        completion = await client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        parsed = json.loads(completion.choices[0].message.content)
        rca_data = RcaResult(
            probable_cause=parsed.get("probable_cause", "Causa não identificada."),
            suggested_fix=parsed.get("suggested_fix", ""),
            confidence_score=int(parsed.get("confidence_score", 75)),
            referenced_clusters=referenced_titles,
        )

    cluster.ai_rca_cache = rca_data.model_dump()
    await db.commit()
    return rca_data