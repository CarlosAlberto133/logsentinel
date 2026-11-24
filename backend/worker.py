import asyncio
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from app.core.redis import redis_client
from app.db.models import ErrorCluster, ErrorLog
from app.db.session import AsyncSessionLocal
from app.ml.embedder import get_embedding
from app.ml.normalizer import normalize_stack_trace

SIMILARITY_THRESHOLD = 0.15  # Distância de cosseno máxima para agrupar no mesmo cluster


async def process_log(raw_payload: str):
    data = json.loads(raw_payload)
    project_id = uuid.UUID(data["project_id"])
    message = data["message"]
    stack_trace = data["stack_trace"]
    environment = data.get("environment", "production")
    metadata = data.get("metadata", {})

    # 1. Normalizar e gerar embedding
    normalized_text = normalize_stack_trace(message, stack_trace)
    vector = get_embedding(normalized_text)

    async with AsyncSessionLocal() as db:
        # 2. Buscar o cluster mais próximo semanticamente dentro do mesmo projeto
        distance_expr = ErrorCluster.embedding.cosine_distance(vector).label("distance")
        stmt = (
            select(ErrorCluster, distance_expr)
            .where(ErrorCluster.project_id == project_id)
            .order_by(distance_expr.asc())
            .limit(1)
        )
        result = await db.execute(stmt)
        row = result.first()

        if row and row.distance < SIMILARITY_THRESHOLD:
            # Agrupa em um cluster existente
            cluster = row.ErrorCluster
            cluster.occurrence_count += 1
            cluster.last_seen_at = datetime.now(timezone.utc)
            if cluster.status == "RESOLVED":
                cluster.status = "OPEN"  # Reabre automaticamente se o bug voltou!
            print(f"[CLUSTER EXISTENTE] '{cluster.title}' (dist={row.distance:.4f}) -> total: {cluster.occurrence_count}")
        else:
            # Cria um novo cluster
            cluster = ErrorCluster(
                project_id=project_id,
                title=message[:250],
                status="OPEN",
                embedding=vector,
                occurrence_count=1,
                last_seen_at=datetime.now(timezone.utc),
            )
            db.add(cluster)
            await db.flush()  # Gera o cluster.id antes de salvar o ErrorLog
            print(f"[NOVO CLUSTER] '{cluster.title}' criado!")

        # 3. Salva a ocorrência individual na tabela error_logs
        log_entry = ErrorLog(
            cluster_id=cluster.id,
            raw_message=message,
            normalized_stack=normalized_text,
            environment=environment,
            log_metadata=metadata,
        )
        db.add(log_entry)
        await db.commit()


async def main():
    print("🚀 LogSentinel Worker iniciado. Aguardando logs na fila...")
    while True:
        # BRPOP bloqueia até chegar um item na fila sem consumir CPU à toa
        item = await redis_client.brpop("logs_queue", timeout=5)
        if item:
            _, raw_payload = item
            try:
                await process_log(raw_payload)
            except Exception as exc:
                print(f"❌ Erro ao processar log: {exc}")


if __name__ == "__main__":
    asyncio.run(main())