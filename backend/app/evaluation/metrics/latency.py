from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List

import numpy as np


@dataclass
class LatencyProfile:
    """Latency measurements for a single query."""

    retrieval_ms: float
    reranking_ms: float
    generation_ms: float
    total_ms: float


class LatencyMetric:
    """Tracks and summarizes latency across many queries."""

    def __init__(self, thresholds: Dict[str, float] | None = None) -> None:
        self.thresholds = thresholds or {
            "retrieval_ms": 500.0,
            "generation_ms": 5000.0,
            "total_ms": 6000.0,
        }
        self.profiles: List[LatencyProfile] = []

    def record(self, profile: LatencyProfile) -> None:
        """Record a latency profile for a single query."""

        self.profiles.append(profile)

    def summarize(self) -> Dict[str, Any]:
        """Summarize latencies with mean and percentiles."""

        if not self.profiles:
            return {"error": "No latency data recorded"}

        stages = ["retrieval_ms", "reranking_ms", "generation_ms", "total_ms"]
        summary: Dict[str, Any] = {}

        for stage in stages:
            values = [getattr(p, stage) for p in self.profiles]
            arr = np.array(values, dtype=float)
            stage_summary: Dict[str, Any] = {
                "mean": round(float(np.mean(arr)), 2),
                "p50": round(float(np.percentile(arr, 50)), 2),
                "p95": round(float(np.percentile(arr, 95)), 2),
                "p99": round(float(np.percentile(arr, 99)), 2),
                "min": round(float(np.min(arr)), 2),
                "max": round(float(np.max(arr)), 2),
            }
            threshold = self.thresholds.get(stage)
            if threshold is not None:
                violations = int(np.sum(arr > threshold))
                stage_summary["threshold"] = threshold
                stage_summary["violations"] = violations
                stage_summary["violation_rate"] = round(violations / len(values), 4)
            summary[stage] = stage_summary

        return summary

    def score_single(self, profile: LatencyProfile) -> Dict[str, Any]:
        """Score a single query's latency on a normalized 0–1 scale."""

        total_threshold = self.thresholds.get("total_ms", 6000.0)
        normalized = max(0.0, 1.0 - (profile.total_ms / (2 * total_threshold)))
        return {
            "score": round(normalized, 4),
            "retrieval_ms": round(profile.retrieval_ms, 2),
            "reranking_ms": round(profile.reranking_ms, 2),
            "generation_ms": round(profile.generation_ms, 2),
            "total_ms": round(profile.total_ms, 2),
            "within_threshold": profile.total_ms <= total_threshold,
        }

