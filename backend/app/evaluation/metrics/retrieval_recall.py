from __future__ import annotations

from typing import Any, List

from app.evaluation.metrics.base import BaseMetric, MetricResult


class ContextRecallMetric(BaseMetric):
    """Measures what fraction of expected information appears in retrieved chunks."""

    def __init__(self, generator: Any | None = None, use_llm_judge: bool = False) -> None:
        self.generator = generator
        self.use_llm_judge = use_llm_judge

    async def score(
        self,
        question: str,
        generated_answer: str,
        expected_answer: str,
        retrieved_chunks: List[Any],
        ground_truth_chunks: List[str],
    ) -> MetricResult:
        statements = self._extract_statements(expected_answer)
        if not statements:
            return MetricResult(score=1.0, details={"note": "No statements to verify"})

        context_text = "\n".join(str(getattr(c, "content", "")) for c in retrieved_chunks)
        covered: List[str] = []
        missed: List[str] = []

        for stmt in statements:
            if self.use_llm_judge and self.generator is not None:
                is_covered = await self._llm_check(stmt, context_text)
            else:
                is_covered = self._keyword_check(stmt, context_text)

            if is_covered:
                covered.append(stmt)
            else:
                missed.append(stmt)

        score = len(covered) / len(statements)

        return MetricResult(
            score=round(score, 4),
            details={
                "total_statements": len(statements),
                "covered": len(covered),
                "missed": len(missed),
                "covered_statements": covered,
                "missed_statements": missed,
            },
        )

    def _extract_statements(self, text: str) -> List[str]:
        import re

        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        return [s.strip() for s in sentences if len(s.strip()) > 15]

    def _keyword_check(self, statement: str, context: str) -> bool:
        stmt_words = set(statement.lower().split())
        ctx_words = set(context.lower().split())
        stop_words = {
            "the",
            "a",
            "an",
            "is",
            "are",
            "was",
            "were",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "and",
            "or",
            "it",
            "this",
            "that",
        }
        stmt_words -= stop_words
        overlap = len(stmt_words & ctx_words) / max(len(stmt_words), 1)
        return overlap > 0.4

    async def _llm_check(self, statement: str, context: str) -> bool:
        prompt = (
            "Is the following statement supported by the context? "
            'Answer ONLY "YES" or "NO".\n\n'
            f"Context:\n{context}\n\nStatement: {statement}\n\nAnswer:"
        )
        result = await self.generator.generate(prompt, model=None)
        return "YES" in str(result).strip().upper()

