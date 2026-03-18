from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class MetricResult:
    """Generic metric result with score and optional details."""

    score: float
    details: Dict[str, Any]


class BaseMetric(ABC):
    """Base interface for all evaluation metrics."""

    @abstractmethod
    async def score(
        self,
        question: str,
        generated_answer: str,
        expected_answer: str,
        retrieved_chunks: List[Any],
        ground_truth_chunks: List[str],
    ) -> MetricResult:
        """Compute a metric score for a single Q&A example."""

        raise NotImplementedError

