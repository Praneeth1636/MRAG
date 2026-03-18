from __future__ import annotations

from typing import Any, Dict

import chromadb
import httpx
from fastapi import Depends, FastAPI, Request

from app.config import get_settings
from app.core.document_processor import DocumentProcessor
from app.core.embedder import Embedder
from app.core.generator import Generator
from app.core.retriever import get_chroma_client
from app.logging_config import setup_logging


class ServiceContainer:
    """Holds initialized services and shared clients for the application."""

    def __init__(self) -> None:
        self.chroma_client: chromadb.ClientAPI | None = None
        self.embedder: Embedder | None = None
        self.generator: Generator | None = None
        self.document_processor: DocumentProcessor | None = None
        self.ollama_client: httpx.AsyncClient | None = None
        self.job_store: Dict[str, Dict[str, Any]] = {}


async def init_services(app: FastAPI) -> None:
    """Initialize shared services; called on application startup."""

    setup_logging()
    settings = get_settings()

    container = ServiceContainer()

    # Chroma client
    container.chroma_client = get_chroma_client()

    # Ollama HTTP client
    container.ollama_client = httpx.AsyncClient(
        base_url=settings.ollama_base_url,
        timeout=settings.ollama_timeout_seconds,
    )

    # Verify Ollama connection
    resp = await container.ollama_client.get("/api/tags")
    resp.raise_for_status()

    # Core components
    container.embedder = Embedder()
    container.generator = Generator(client=container.ollama_client)
    container.document_processor = DocumentProcessor(client=container.chroma_client)

    app.state.services = container


async def shutdown_services(app: FastAPI) -> None:
    """Gracefully shut down shared services; called on application shutdown."""

    container: ServiceContainer = app.state.services
    if container.ollama_client:
        await container.ollama_client.aclose()


def get_services(request: Request) -> ServiceContainer:
    """Return the shared ServiceContainer attached to the app."""

    return request.app.state.services


def get_chroma(services: ServiceContainer = Depends(get_services)) -> chromadb.ClientAPI:
    """FastAPI dependency returning the Chroma client."""

    assert services.chroma_client is not None
    return services.chroma_client


def get_embedder(services: ServiceContainer = Depends(get_services)) -> Embedder:
    """FastAPI dependency returning the shared Embedder."""

    assert services.embedder is not None
    return services.embedder


def get_generator(services: ServiceContainer = Depends(get_services)) -> Generator:
    """FastAPI dependency returning the shared Generator."""

    assert services.generator is not None
    return services.generator


def get_job_store(services: ServiceContainer = Depends(get_services)) -> Dict[str, Dict[str, Any]]:
    """FastAPI dependency returning the in-memory job store."""

    return services.job_store

