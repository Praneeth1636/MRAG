from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Dict

from fastapi import APIRouter, BackgroundTasks, Depends, status
from fastapi.responses import JSONResponse
import structlog

from app.api.deps import ServiceContainer, get_embedder, get_services
from app.api.exceptions import CollectionNotFoundError
from app.evaluation.datasets.schema import EvalDataset
from app.evaluation.evaluator import Evaluator
from app.evaluation.report import ReportGenerator
from app.models.schemas import EvalRequest
from app.core.rag_pipeline import RAGPipeline
from app.core.retriever import Retriever

router = APIRouter()
logger = structlog.get_logger()

_eval_jobs: Dict[str, Dict[str, object]] = {}


@router.post("/evaluate", status_code=status.HTTP_202_ACCEPTED)
async def run_evaluation(
    request: EvalRequest,
    background_tasks: BackgroundTasks,
    services: ServiceContainer = Depends(get_services),
    embedder=Depends(get_embedder),
) -> Dict[str, object]:
    """Launch evaluation suite against a collection and return a job ID."""

    try:
        assert services.chroma_client is not None
        collection = services.chroma_client.get_collection(name=request.collection_name)
    except Exception as exc:  # noqa: BLE001
        raise CollectionNotFoundError(request.collection_name) from exc

    if request.dataset_path:
        dataset_path = Path(request.dataset_path)
    else:
        dataset_path = Path("app/evaluation/datasets/sample_qa.json")

    if not dataset_path.exists():
        return JSONResponse(
            status_code=400,
            content={"detail": f"Dataset not found at {dataset_path}"},
        )

    dataset_data = json.loads(dataset_path.read_text())
    dataset = EvalDataset(**dataset_data)

    retriever = Retriever(collection=collection, embedder=embedder)
    assert services.generator is not None
    pipeline = RAGPipeline(retriever=retriever, generator=services.generator)

    job_id = str(uuid.uuid4())
    _eval_jobs[job_id] = {"status": "running", "report": None, "error": None}

    background_tasks.add_task(
        _run_eval_background,
        job_id,
        pipeline,
        dataset,
        request.collection_name,
        request.model,
        request.top_k,
        embedder,
    )

    return {
        "job_id": job_id,
        "status": "running",
        "message": f"Evaluation started with {len(dataset.pairs)} questions",
    }


async def _run_eval_background(
    job_id: str,
    pipeline: RAGPipeline,
    dataset: EvalDataset,
    collection_name: str,
    model: str,
    top_k: int,
    embedder,
) -> None:
    """Background task: run evaluation and write reports."""

    try:
        evaluator = Evaluator(pipeline=pipeline, embedder=embedder)
        report = await evaluator.run(
            dataset=dataset,
            collection_name=collection_name,
            model=model,
            top_k=top_k,
        )

        ReportGenerator.to_json(report, f"./eval_reports/{job_id}/report.json")
        ReportGenerator.to_markdown(report, f"./eval_reports/{job_id}/report.md")

        _eval_jobs[job_id]["status"] = "completed"
        _eval_jobs[job_id]["report"] = report.model_dump()
        logger.info("eval_complete", job_id=job_id, aggregate=report.aggregate_scores)
    except Exception as exc:  # noqa: BLE001
        _eval_jobs[job_id]["status"] = "failed"
        _eval_jobs[job_id]["error"] = str(exc)
        logger.error("eval_failed", job_id=job_id, error=str(exc))


@router.get("/evaluate/{job_id}")
async def get_eval_status(job_id: str) -> Dict[str, object]:
    """Return evaluation job status and report (if completed)."""

    job = _eval_jobs.get(job_id)
    if not job:
        return JSONResponse(
            status_code=404,
            content={"detail": f"Eval job '{job_id}' not found"},
        )
    return job

