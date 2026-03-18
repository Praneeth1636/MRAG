from __future__ import annotations

from typing import Any, List

from app.evaluation.metrics.base import BaseMetric, MetricResult


class ContextPrecisionMetric(BaseMetric):
    """Measures how many retrieved chunks are actually relevant (precision@k)."""

    async def score(
        self,
        question: str,
        generated_answer: str,
        expected_answer: str,
        retrieved_chunks: List[Any],
        ground_truth_chunks: List[str],
    ) -> MetricResult:
        n = len(retrieved_chunks)
        if n == 0:
            return MetricResult(score=0.0, details={"error": "No chunks retrieved"})

        relevance_flags: List[float] = []

        if ground_truth_chunks:
            retrieved_ids = [self._get_chunk_id(c) for c in retrieved_chunks]
            for rid in retrieved_ids:
                relevance_flags.append(1.0 if rid in ground_truth_chunks else 0.0)
        else:
            expected_tokens = set(expected_answer.lower().split())
            for chunk in retrieved_chunks:
                chunk_tokens = set(str(getattr(chunk, "content", "")).lower().split())
                overlap = len(expected_tokens & chunk_tokens) / max(len(expected_tokens), 1)
                relevance_flags.append(1.0 if overlap > 0.15 else 0.0)

        weights = [1.0 / (i + 1) for i in range(n)]
        weighted_score = sum(r * w for r, w in zip(relevance_flags, weights)) / sum(weights)
        standard_precision = sum(relevance_flags) / n

        return MetricResult(
            score=round(weighted_score, 4),
            details={
                "weighted_precision": round(weighted_score, 4),
                "standard_precision": round(standard_precision, 4),
                "relevant_count": int(sum(relevance_flags)),
                "total_retrieved": n,
                "per_position_relevance": relevance_flags,
            },
        )

    def _get_chunk_id(self, chunk: Any) -> str:
        if hasattr(chunk, "id"):
            return str(chunk.id)
        if getattr(chunk, "metadata", None) and "chunk_id" in chunk.metadata:
            return str(chunk.metadata["chunk_id"])
        return ""

