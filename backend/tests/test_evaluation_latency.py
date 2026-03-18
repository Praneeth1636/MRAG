from __future__ import annotations

from app.evaluation.metrics.latency import LatencyMetric, LatencyProfile


def test_latency_summary_and_score_single() -> None:
    metric = LatencyMetric()
    metric.record(LatencyProfile(100, 0, 400, 500))
    metric.record(LatencyProfile(200, 0, 600, 800))

    summary = metric.summarize()
    assert "total_ms" in summary
    assert summary["total_ms"]["mean"] > 0

    profile = LatencyProfile(150, 0, 450, 600)
    single = metric.score_single(profile)
    assert 0.0 <= single["score"] <= 1.0

