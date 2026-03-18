from __future__ import annotations

import time
from typing import Any, List

import numpy as np
import structlog
from datetime import datetime, timezone

from app.core.rag_pipeline import RAGPipeline
from app.evaluation.datasets.schema import EvalDataset, EvalReport, EvalResultPerQuestion
from app.evaluation.metrics.faithfulness import FaithfulnessMetric
from app.evaluation.metrics.latency import LatencyMetric, LatencyProfile
from app.evaluation.metrics.relevance import AnswerRelevanceMetric
from app.evaluation.metrics.retrieval_precision import ContextPrecisionMetric
from app.evaluation.metrics.retrieval_recall import ContextRecallMetric

logger = structlog.get_logger()


class Evaluator:
    """Runs the full evaluation suite over a dataset using a RAG pipeline."""

    def __init__(self, pipeline: RAGPipeline, embedder: Any) -> None:
        self.pipeline = pipeline
        self.faithfulness = FaithfulnessMetric(generator=pipeline.generator)
        self.relevance = AnswerRelevanceMetric(
            generator=pipeline.generator,
            embedder=embedder,
        )
        self.precision = ContextPrecisionMetric()
        self.recall = ContextRecallMetric(generator=pipeline.generator, use_llm_judge=False)
        self.latency = LatencyMetric()

    async def run(
        self,
        dataset: EvalDataset,
        collection_name: str,
        model: str = "llama3",
        top_k: int = 5,
    ) -> EvalReport:
        """Run evaluation on all Q&A pairs in the dataset."""

        start_time = time.perf_counter()
        results: List[EvalResultPerQuestion] = []

        for idx, qa in enumerate(dataset.pairs):
            logger.info("eval_question", index=idx, total=len(dataset.pairs), question=qa.question[:80])
            try:
                result = await self._evaluate_single(qa, model=model, top_k=top_k)
                results.append(result)
            except Exception as exc:  # noqa: BLE001
                logger.error("eval_question_failed", index=idx, error=str(exc))
                results.append(
                    EvalResultPerQuestion(
                        qa_pair_id=qa.id,
                        question=qa.question,
                        generated_answer=f"ERROR: {exc}",
                        expected_answer=qa.expected_answer,
                        retrieved_chunk_ids=[],
                        metrics={
                            "faithfulness": 0.0,
                            "relevance": 0.0,
                            "context_precision": 0.0,
                            "context_recall": 0.0,
                            "latency": 0.0,
                        },
                        details={"error": str(exc)},
                    ),
                )

        duration = time.perf_counter() - start_time

        metric_names = [
            "faithfulness",
            "relevance",
            "context_precision",
            "context_recall",
            "latency",
        ]
        aggregate = {}
        for name in metric_names:
            scores = [r.metrics.get(name, 0.0) for r in results]
            aggregate[name] = round(float(np.mean(scores)), 4) if scores else 0.0

        return EvalReport(
            dataset_name=dataset.name,
            model_used=model,
            collection_name=collection_name,
            top_k=top_k,
            total_questions=len(dataset.pairs),
            aggregate_scores=aggregate,
            per_question_results=results,
            latency_summary=self.latency.summarize(),
            timestamp=datetime.now(timezone.utc).isoformat(),
            duration_seconds=round(duration, 2),
        )

    async def _evaluate_single(self, qa: Any, model: str, top_k: int) -> EvalResultPerQuestion:
        """Evaluate metrics for a single Q&A pair."""

        t_start = time.perf_counter()

        t_ret = time.perf_counter()
        chunks = await self.pipeline.retriever.retrieve(qa.question, top_k=top_k)
        retrieval_ms = (time.perf_counter() - t_ret) * 1000.0

        context = self.pipeline.build_context(chunks)
        prompt = self.pipeline.build_prompt(qa.question, context)

        t_gen = time.perf_counter()
        answer_text = await self.pipeline.generator.generate(prompt, model=model)
        generation_ms = (time.perf_counter() - t_gen) * 1000.0

        total_ms = (time.perf_counter() - t_start) * 1000.0

        profile = LatencyProfile(
            retrieval_ms=retrieval_ms,
            reranking_ms=0.0,
            generation_ms=generation_ms,
            total_ms=total_ms,
        )
        self.latency.record(profile)

        retrieved_ids = [self._get_chunk_id(c) for c in chunks]

        faithfulness_result = await self.faithfulness.score(
            qa.question,
            answer_text,
            qa.expected_answer,
            chunks,
            qa.relevant_chunk_ids,
        )
        relevance_result = await self.relevance.score(
            qa.question,
            answer_text,
            qa.expected_answer,
            chunks,
            qa.relevant_chunk_ids,
        )
        precision_result = await self.precision.score(
            qa.question,
            answer_text,
            qa.expected_answer,
            chunks,
            qa.relevant_chunk_ids,
        )
        recall_result = await self.recall.score(
            qa.question,
            answer_text,
            qa.expected_answer,
            chunks,
            qa.relevant_chunk_ids,
        )
        latency_result = self.latency.score_single(profile)

        return EvalResultPerQuestion(
            qa_pair_id=qa.id,
            question=qa.question,
            generated_answer=answer_text,
            expected_answer=qa.expected_answer,
            retrieved_chunk_ids=retrieved_ids,
            metrics={
                "faithfulness": faithfulness_result.score,
                "relevance": relevance_result.score,
                "context_precision": precision_result.score,
                "context_recall": recall_result.score,
                "latency": latency_result["score"],
            },
            details={
                "faithfulness": faithfulness_result.details,
                "relevance": relevance_result.details,
                "context_precision": precision_result.details,
                "context_recall": recall_result.details,
                "latency": latency_result,
            },
        )

    def _get_chunk_id(self, chunk: Any) -> str:
        if hasattr(chunk, "id"):
            return str(chunk.id)
        if getattr(chunk, "metadata", None) and "chunk_id" in chunk.metadata:
            return str(chunk.metadata["chunk_id"])
        return ""

