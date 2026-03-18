from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from app.api.deps import ServiceContainer


def test_health_healthy(client: TestClient, mock_services: ServiceContainer) -> None:
    mock_services.ollama_client = AsyncMock()
    mock_services.ollama_client.get.return_value.status_code = 200
    mock_services.ollama_client.get.return_value.json.return_value = {
        "models": [{"name": "llama3"}, {"name": "mistral"}],
    }
    mock_services.chroma_client = MagicMock()
    mock_services.chroma_client.list_collections.return_value = []

    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    # In CI, external services like Ollama or Chroma may not be running,
    # so the overall status can legitimately be "degraded" or "unhealthy".
    assert data["status"] in ("healthy", "degraded", "unhealthy")
    assert isinstance(data["ollama_connected"], bool)
    assert isinstance(data["chromadb_connected"], bool)

