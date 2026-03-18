from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    """Ingestion job status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class IngestResponse(BaseModel):
    """Response returned when an ingestion job is created."""

    job_id: str
    status: JobStatus
    message: str


class IngestJobDetail(BaseModel):
    """Detailed information about an ingestion job."""

    job_id: str
    status: JobStatus
    collection_name: str
    files: List[str]
    total_chunks: int = 0
    processed_files: int = 0
    total_files: int = 0
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class QueryRequest(BaseModel):
    """Request body for query endpoint."""

    question: str = Field(..., min_length=1, max_length=2000)
    collection_name: str = Field(..., min_length=1)
    model: str = Field(default="llama3", description="Ollama model to use")
    top_k: int = Field(default=5, ge=1, le=20)
    stream: bool = Field(default=True, description="Enable SSE streaming")


class SourceChunk(BaseModel):
    """Represents a retrieved source chunk in responses."""

    content: str
    source_file: str
    page_number: Optional[int] = None
    content_type: str
    relevance_score: float
    chunk_index: int


class QueryResponse(BaseModel):
    """Non-streaming query response model."""

    answer: str
    sources: List[SourceChunk]
    model_used: str
    latency_ms: Dict[str, float]


class CollectionInfo(BaseModel):
    """Metadata about a single Chroma collection."""

    name: str
    document_count: int
    metadata: Optional[Dict[str, Any]] = None


class CollectionListResponse(BaseModel):
    """Response model listing all collections."""

    collections: List[CollectionInfo]


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    ollama_connected: bool
    ollama_models: List[str]
    chromadb_connected: bool
    collections_count: int


class EvalRequest(BaseModel):
    """Request model for evaluation endpoint (Phase 3)."""

    collection_name: str
    dataset_path: Optional[str] = None
    model: str = Field(default="llama3")
    top_k: int = Field(default=5)

