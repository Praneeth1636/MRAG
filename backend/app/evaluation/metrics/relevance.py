from __future__ import annotations

import json
from typing import Any, List

import numpy as np

from app.evaluation.metrics.base import BaseMetric, MetricResult


class AnswerRelevanceMetric(BaseMetric):
    """Measures how relevant the generated answer is to the original question."""

    def __init__(self, generator: Any, embedder: Any, num_questions: int = 3) -> None:
        self.generator = generator
        self.embedder = embedder
        self.num_questions = num_questions

    async def score(
        self,
        question: str,
        generated_answer: str,
        expected_answer: str,
        retrieved_chunks: List[Any],
        ground_truth_chunks: List[str],
    ) -> MetricResult:
        gen_prompt = (
            f"Given the following answer, generate exactly {self.num_questions} questions that this "
            "answer would be a good response to. Return ONLY a JSON array of question strings. "
            "No preamble.\n\n"
            f"Answer: {generated_answer}\n\nJSON array:"
        )

        raw = await self.generator.generate(gen_prompt, model=None)
        hypothetical_questions = self._parse_questions(str(raw))

        if not hypothetical_questions:
            return MetricResult(
                score=0.0,
                details={"error": "Could not generate hypothetical questions"},
            )

        original_embedding = self.embedder.embed(question)
        hypo_embeddings = self.embedder.embed_batch(hypothetical_questions)

        similarities: List[float] = []
        orig = np.asarray(original_embedding, dtype=float)
        for hypo_emb in hypo_embeddings:
            hyp = np.asarray(hypo_emb, dtype=float)
            denom = float(np.linalg.norm(orig) * np.linalg.norm(hyp) + 1e-10)
            sim = float(np.dot(orig, hyp) / denom)
            similarities.append(sim)

        mean_score = float(np.mean(similarities))
        bounded = max(0.0, min(1.0, mean_score))

        return MetricResult(
            score=round(bounded, 4),
            details={
                "hypothetical_questions": hypothetical_questions,
                "similarities": [round(s, 4) for s in similarities],
                "mean_similarity": round(mean_score, 4),
            },
        )

    def _parse_questions(self, raw: str) -> List[str]:
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.strip("`")
                cleaned = cleaned.replace("json", "", 1).strip()
            data = json.loads(cleaned)
            return [str(q) for q in data][: self.num_questions]
        except Exception:
            lines = raw.strip().splitlines()
            questions: List[str] = []
            for line in lines:
                line = line.strip().lstrip("0123456789.-) ").strip()
                if line and line.endswith("?"):
                    questions.append(line)
            return questions[: self.num_questions]

