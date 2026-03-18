from __future__ import annotations

import json
from pathlib import Path

from app.evaluation.datasets.schema import EvalReport


class ReportGenerator:
    """Generates evaluation reports in JSON and Markdown formats."""

    @staticmethod
    def to_json(report: EvalReport, output_path: str) -> str:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        data = report.model_dump()
        path.write_text(json.dumps(data, indent=2, default=str))
        return str(path)

    @staticmethod
    def to_markdown(report: EvalReport, output_path: str) -> str:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        lines: list[str] = [
            "# RAG Evaluation Report",
            "",
            f"**Dataset:** {report.dataset_name}",
            f"**Model:** {report.model_used}",
            f"**Collection:** {report.collection_name}",
            f"**Questions:** {report.total_questions}",
            f"**Top-K:** {report.top_k}",
            f"**Duration:** {report.duration_seconds}s",
            f"**Timestamp:** {report.timestamp}",
            "",
            "---",
            "",
            "## Aggregate Scores",
            "",
            "| Metric | Score |",
            "|--------|-------|",
        ]

        for metric, score in report.aggregate_scores.items():
            label = metric.replace("_", " ").title()
            emoji = "🟢" if score >= 0.7 else ("🟡" if score >= 0.4 else "🔴")
            lines.append(f"| {emoji} {label} | **{score:.2%}** |")

        lines += [
            "",
            "---",
            "",
            "## Latency Summary",
            "",
            "| Stage | Mean | P50 | P95 | P99 |",
            "|-------|------|-----|-----|-----|",
        ]

        for stage, stats in report.latency_summary.items():
            if isinstance(stats, dict) and "mean" in stats:
                lines.append(
                    f"| {stage} | {stats['mean']}ms | {stats['p50']}ms | "
                    f"{stats['p95']}ms | {stats['p99']}ms |"
                )

        lines += [
            "",
            "---",
            "",
            "## Per-Question Results",
            "",
            "| # | Question | Faith. | Relev. | Prec. | Recall |",
            "|---|----------|--------|--------|-------|--------|",
        ]

        for idx, result in enumerate(report.per_question_results):
            short_q = result.question[:50] + ("..." if len(result.question) > 50 else "")
            m = result.metrics
            lines.append(
                f"| {idx + 1} | {short_q} | "
                f"{m.get('faithfulness', 0):.2f} | "
                f"{m.get('relevance', 0):.2f} | "
                f"{m.get('context_precision', 0):.2f} | "
                f"{m.get('context_recall', 0):.2f} |"
            )

        path.write_text("\n".join(lines))
        return str(path)

