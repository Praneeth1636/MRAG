from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import ServiceContainer, get_services
from app.models.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check(services: ServiceContainer = Depends(get_services)) -> HealthResponse:
    """Check connectivity to Ollama and ChromaDB."""

    ollama_ok = False
    ollama_models: list[str] = []

    try:
        assert services.ollama_client is not None
        resp = await services.ollama_client.get("/api/tags")
        if resp.status_code == 200:
            ollama_ok = True
            ollama_models = [m["name"] for m in resp.json().get("models", [])]
    except Exception:
        ollama_ok = False

    chroma_ok = False
    collections_count = 0
    try:
        assert services.chroma_client is not None
        collections = services.chroma_client.list_collections()
        chroma_ok = True
        collections_count = len(collections)
    except Exception:
        chroma_ok = False

    status = "healthy" if (ollama_ok and chroma_ok) else ("degraded" if chroma_ok else "unhealthy")

    return HealthResponse(
        status=status,
        ollama_connected=ollama_ok,
        ollama_models=ollama_models,
        chromadb_connected=chroma_ok,
        collections_count=collections_count,
    )

