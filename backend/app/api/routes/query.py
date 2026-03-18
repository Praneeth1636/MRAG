from __future__ import annotations

import json
import time
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
import structlog

from app.api.deps import ServiceContainer, get_services
from app.api.exceptions import CollectionNotFoundError
from app.config import get_settings
from app.core.rag_pipeline import RAGPipeline
from app.core.retriever import Retriever
from app.models.schemas import QueryRequest, QueryResponse, SourceChunk

logger = structlog.get_logger()
router = APIRouter()


@router.post("/query")
async def query_rag(request: QueryRequest, services: ServiceContainer = Depends(get_services)):
    """Query the RAG pipeline against a collection."""

    assert services.chroma_client is not None
    assert services.embedder is not None
    assert services.generator is not None

    try:
        collection = services.chroma_client.get_collection(name=request.collection_name)
    except Exception as exc:  # noqa: BLE001
        raise CollectionNotFoundError(request.collection_name) from exc

    retriever = Retriever(collection=collection, embedder=services.embedder)
    pipeline = RAGPipeline(retriever=retriever, generator=services.generator)

    if request.stream:
        stream = _stream_rag_response(pipeline, request)
        return StreamingResponse(
            stream,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Non-streaming JSON response
    start_total = time.perf_counter()

    start_ret = time.perf_counter()
    chunks = await retriever.retrieve(request.question, top_k=request.top_k)
    retrieval_ms = (time.perf_counter() - start_ret) * 1000.0

    context = pipeline.build_context(chunks)
    prompt = pipeline.build_prompt(request.question, context)

    start_gen = time.perf_counter()
    answer_text = await services.generator.generate(prompt, model=request.model)
    generation_ms = (time.perf_counter() - start_gen) * 1000.0
    total_ms = (time.perf_counter() - start_total) * 1000.0

    sources = [
        SourceChunk(
            content=chunk.content,
            source_file=str(chunk.metadata.get("source_file", "unknown")),
            page_number=chunk.metadata.get("page_num"),
            content_type=str(chunk.metadata.get("chunk_type", "text")),
            relevance_score=chunk.score,
            chunk_index=index,
        )
        for index, chunk in enumerate(chunks)
    ]

    return QueryResponse(
        answer=answer_text,
        sources=sources,
        model_used=request.model,
        latency_ms={
            "retrieval": round(retrieval_ms, 2),
            "generation": round(generation_ms, 2),
            "total": round(total_ms, 2),
        },
    )


async def _stream_rag_response(
    pipeline: RAGPipeline,
    request: QueryRequest,
) -> AsyncGenerator[str, None]:
    """SSE generator that yields source, token, latency, and done events."""

    settings = get_settings()
    delay_ms = settings.stream_chunk_delay_ms

    start_total = time.perf_counter()

    start_ret = time.perf_counter()
    chunks = await pipeline.retriever.retrieve(request.question, top_k=request.top_k)
    retrieval_ms = (time.perf_counter() - start_ret) * 1000.0

    for index, chunk in enumerate(chunks):
        source_data = {
            "content": chunk.content,
            "source_file": str(chunk.metadata.get("source_file", "unknown")),
            "page_number": chunk.metadata.get("page_num"),
            "content_type": str(chunk.metadata.get("chunk_type", "text")),
            "relevance_score": round(chunk.score, 4),
            "chunk_index": index,
        }
        yield f"event: source\ndata: {json.dumps(source_data)}\n\n"
        if delay_ms > 0:
            time.sleep(delay_ms / 1000.0)

    context = pipeline.build_context(chunks)
    prompt = pipeline.build_prompt(request.question, context)

    start_gen = time.perf_counter()
    full_text = ""

    async for token in pipeline.generator.stream(prompt, model=request.model):
        full_text += token
        yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
        if delay_ms > 0:
            time.sleep(delay_ms / 1000.0)

    generation_ms = (time.perf_counter() - start_gen) * 1000.0
    total_ms = (time.perf_counter() - start_total) * 1000.0

    latency_data = {
        "retrieval_ms": round(retrieval_ms, 2),
        "generation_ms": round(generation_ms, 2),
        "total_ms": round(total_ms, 2),
    }
    yield f"event: latency\ndata: {json.dumps(latency_data)}\n\n"
    yield 'event: done\ndata: {"status": "complete"}\n\n'

