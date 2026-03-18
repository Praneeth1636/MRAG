from __future__ import annotations

import json
from typing import Any, List

from app.evaluation.metrics.base import BaseMetric, MetricResult


class FaithfulnessMetric(BaseMetric):
    """Measures whether the generated answer is faithful to the retrieved context."""

    def __init__(self, generator: Any) -> None:
        self.generator = generator

    async def score(
        self,
        question: str,
        generated_answer: str,
        expected_answer: str,
        retrieved_chunks: List[Any],
        ground_truth_chunks: List[str],
    ) -> MetricResult:
        extract_prompt = (
            "Extract every distinct factual claim from the following answer.\n"
            "Return ONLY a JSON array of strings, one claim per element. "
            "No preamble, no markdown.\n\n"
            f"Answer: {generated_answer}\n\nJSON array:"
        )

        claims_raw = await self.generator.generate(extract_prompt, model=None)
        claims = self._parse_claims(str(claims_raw))

        if not claims:
            return MetricResult(
                score=1.0,
                details={"claims": [], "note": "No claims extracted"},
            )

        context_text = "\n\n".join(str(getattr(c, "content", "")) for c in retrieved_chunks)
        supported: List[str] = []
        unsupported: List[str] = []

        for claim in claims:
            verify_prompt = (
                "Given the following context, determine if the claim is SUPPORTED or "
                "NOT SUPPORTED.\nRespond with ONLY \"SUPPORTED\" or \"NOT SUPPORTED\". "
                "Nothing else.\n\n"
                f"Context:\n{context_text}\n\nClaim: {claim}\n\nVerdict:"
            )
            verdict_raw = await self.generator.generate(verify_prompt, model=None)
            verdict = str(verdict_raw).strip().upper()

            if "SUPPORTED" in verdict and "NOT" not in verdict:
                supported.append(claim)
            else:
                unsupported.append(claim)

        score = len(supported) / len(claims)

        return MetricResult(
            score=round(score, 4),
            details={
                "total_claims": len(claims),
                "supported_claims": len(supported),
                "unsupported_claims": len(unsupported),
                "supported": supported,
                "unsupported": unsupported,
            },
        )

    def _parse_claims(self, raw: str) -> List[str]:
        """Parse a JSON array of claims, with robust fallbacks."""

        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.strip("`")
                cleaned = cleaned.replace("json", "", 1).strip()
            return list(json.loads(cleaned))
        except Exception:
            lines = raw.strip().splitlines()
            claims: List[str] = []
            for line in lines:
                line = line.strip().lstrip("0123456789.-) ").strip()
                if line and len(line) > 10:
                    claims.append(line)
            return claims

