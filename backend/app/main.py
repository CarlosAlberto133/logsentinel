from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import projects, ingest
from app.api.v1 import projects, ingest, clusters

app = FastAPI(title="LogSentinel API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/v1/projects")
app.include_router(ingest.router, prefix="/api/v1/ingest")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(ingest.router, prefix="/api/v1")
app.include_router(clusters.router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "ok"}