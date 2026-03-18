from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class OllamaSettings(BaseModel):
    """Configuration for Ollama models and endpoint."""

    base_url: str = "http://ollama:11434"
    chat_model: str = "llama3"
    fallback_chat_model: str = "mistral"
    image_model: str = "llava"


class EmbeddingSettings(BaseModel):
    """Configuration for embedding generation."""

    model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    batch_size: int = 32


class ChunkingSettings(BaseModel):
    """Configuration for chunking behavior."""

    semantic_similarity_threshold: float = 0.75
    max_tokens: int = 512
    overlap_ratio: float = 0.1


class RetrievalSettings(BaseModel):
    """Configuration for retrieval."""

    top_k: int = 10
    final_k: int = 5
    enable_hybrid: bool = True


class ChromaSettings(BaseModel):
    """Configuration for ChromaDB."""

    persist_directory: str = "data/chroma"


class LoggingSettings(BaseModel):
    """Configuration for logging."""

    level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_prefix="RAG_", env_file=".env", extra="ignore")

    # Phase 1 nested settings
    ollama: OllamaSettings = OllamaSettings()
    embeddings: EmbeddingSettings = EmbeddingSettings()
    chunking: ChunkingSettings = ChunkingSettings()
    retrieval: RetrievalSettings = RetrievalSettings()
    chroma: ChromaSettings = ChromaSettings()
    logging: LoggingSettings = LoggingSettings()

    # Phase 2: API and infrastructure settings
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    max_upload_size_mb: int = 50
    max_concurrent_ingestion_jobs: int = 3
    upload_dir: str = "./uploads"
    job_ttl_hours: int = 24

    # Convenience mirrors for existing nested settings
    ollama_base_url: str = "http://ollama:11434"
    ollama_timeout_seconds: int = 120

    chroma_persist_dir: str = "data/chroma"

    # Streaming behaviour
    stream_chunk_delay_ms: int = 50


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings instance."""

    return Settings()

