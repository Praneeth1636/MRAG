from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.core.generator import Generator
from app.core.retriever import RetrievedChunk, Retriever


@dataclass
class LatencyBreakdown:
    """Latency information for different stages of the pipeline."""

    retrieval_ms: float
    generation_ms: float
    total_ms: float


@dataclass
class SourceCitation:
    """Represents a source chunk used for answering."""

    id: str
    content: str
    metadata: Dict[str, Any]
    score: float


@dataclass
class RAGResponse:
    """Structured response from the RAG pipeline."""

    answer: str
    sources: List[SourceCitation]
    latency: LatencyBreakdown
    model_used: str


@dataclass
class QueryConfig:
    """Configuration for a RAG query."""

    top_k: int = 10
    final_k: int = 5
    model: Optional[str] = None


class RAGPipeline:
    """End-to-end retrieval-augmented generation pipeline."""

    def __init__(self, retriever: Retriever, generator: Generator) -> None:
        self._retriever = retriever
        self._generator = generator

    @property
    def retriever(self) -> Retriever:
        """Expose underlying retriever."""

        return self._retriever

    @property
    def generator(self) -> Generator:
        """Expose underlying generator."""

        return self._generator

    async def query(
        self,
        question: str,
        collection_name: str | None,
        config: QueryConfig,
        where: Optional[Dict[str, Any]] = None,
    ) -> RAGResponse:
        """Run a RAG query returning answer, sources, and latencies."""

        start_total = time.perf_counter()

        start_retrieval = time.perf_counter()
        retrieved_chunks: List[RetrievedChunk] = await self._retriever.retrieve(
            question,
            top_k=config.top_k,
            final_k=config.final_k,
            where=where,
        )
        retrieval_ms = (time.perf_counter() - start_retrieval) * 1000.0

        context = self._build_context(retrieved_chunks)
        prompt = self._build_prompt(question, context)

        start_generation = time.perf_counter()
        answer_text = await self._generator.generate(prompt, model=config.model)
        generation_ms = (time.perf_counter() - start_generation) * 1000.0

        total_ms = (time.perf_counter() - start_total) * 1000.0

        sources = [
            SourceCitation(
                id=chunk.id,
                content=chunk.content,
                metadata=chunk.metadata,
                score=chunk.score,
            )
            for chunk in retrieved_chunks
        ]

        return RAGResponse(
            answer=answer_text,
            sources=sources,
            latency=LatencyBreakdown(
                retrieval_ms=retrieval_ms,
                generation_ms=generation_ms,
                total_ms=total_ms,
            ),
            model_used=config.model or "",
        )

    def build_context(self, chunks: List[RetrievedChunk]) -> str:
        """Build textual context from retrieved chunks."""

        lines: List[str] = []
        for idx, chunk in enumerate(chunks):
            header = f"[Source {idx}] id={chunk.id} score={chunk.score:.3f}"
            lines.append(header)
            lines.append(chunk.content)
            lines.append("")
        return "\n".join(lines)

    def build_prompt(self, question: str, context: str) -> str:
        """Construct an instruction-following prompt for the LLM."""

        instructions = (
            "You are a helpful assistant answering questions using ONLY the provided context.\n"
            "If the answer cannot be derived from the context, reply exactly with:\n"
            "\"I don't have enough information from the provided documents to answer this.\"\n"
            "When you answer, cite the sources you used by their [Source N] index.\n"
            "The context may include text and image captions; treat both as authoritative.\n\n"
        )
        prompt = (
            f"{instructions}"
            f"Context:\n{context}\n\n"
            f"Question: {question}\n\n"
            "Answer (with citations):"
        )
        return prompt

