from __future__ import annotations

from typing import Any, Dict, List

from pydantic import BaseModel, Field


class EvalQAPair(BaseModel):
    """Single evaluation question/answer specification."""

    id: str
    question: str
    expected_answer: str
    relevant_chunk_ids: List[str] = Field(
        default_factory=list,
        description="IDs of ground-truth relevant chunks",
    )
    relevant_keywords: List[str] = Field(
        default_factory=list,
        description="Key phrases that must appear in a correct answer",
    )
    source_documents: List[str] = Field(
        default_factory=list,
        description="Filenames that contain the answer",
    )
    difficulty: str = Field(default="medium", description="easy | medium | hard | adversarial")
    category: str = Field(
        default="factual",
        description="factual | multi_hop | image_based | unanswerable | comparative",
    )


class EvalDataset(BaseModel):
    """Collection of evaluation Q&A pairs."""

    name: str
    description: str
    pairs: List[EvalQAPair]


class EvalResultPerQuestion(BaseModel):
    """Evaluation results for a single question."""

    qa_pair_id: str
    question: str
    generated_answer: str
    expected_answer: str
    retrieved_chunk_ids: List[str]
    metrics: Dict[str, float]
    details: Dict[str, Any]


class EvalReport(BaseModel):
    """Aggregate evaluation report."""

    dataset_name: str
    model_used: str
    collection_name: str
    top_k: int
    total_questions: int
    aggregate_scores: Dict[str, float]
    per_question_results: List[EvalResultPerQuestion]
    latency_summary: Dict[str, Any]
    timestamp: str
    duration_seconds: float

