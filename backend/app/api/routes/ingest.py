from __future__ import annotations

import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    UploadFile,
    status,
)
import structlog

from app.api.deps import ServiceContainer, get_services
from app.api.exceptions import FileTooLargeError, UnsupportedFileTypeError
from app.config import get_settings
from app.models.schemas import IngestJobDetail, IngestResponse, JobStatus

logger = structlog.get_logger()
router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".csv", ".png", ".jpg", ".jpeg", ".webp"}


def _validate_file(upload: UploadFile) -> None:
    settings = get_settings()
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise UnsupportedFileTypeError(upload.filename or "unknown")
    # `UploadFile` does not expose size reliably; size checks can be enforced at proxy.
    # Here we only guard based on extension.


async def _run_ingestion(
    job_id: str,
    file_paths: List[str],
    collection_name: str,
    services: ServiceContainer,
) -> None:
    """Background task to ingest files via the DocumentProcessor."""

    job = services.job_store[job_id]
    job["status"] = JobStatus.PROCESSING

    try:
        assert services.document_processor is not None
        total_chunks = await services.document_processor.ingest_files(
            file_paths=file_paths,
            collection_name=collection_name,
        )
        job["total_chunks"] = total_chunks
        job["processed_files"] = len(file_paths)
        job["status"] = JobStatus.COMPLETED
        job["completed_at"] = datetime.now(timezone.utc)
        logger.info("ingestion_complete", job_id=job_id, total_chunks=total_chunks)
    except Exception as exc:  # noqa: BLE001
        job["status"] = JobStatus.FAILED
        job["error"] = str(exc)
        logger.error("ingestion_failed", job_id=job_id, error=str(exc))
    finally:
        for path in file_paths:
            try:
                os.remove(path)
            except OSError:
                continue


@router.post(
    "/ingest",
    response_model=IngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    collection_name: str = Form(...),
    services: ServiceContainer = Depends(get_services),
) -> IngestResponse:
    """Upload and ingest documents into a collection, returning a job ID."""

    settings = get_settings()
    for upload in files:
        _validate_file(upload)

    job_id = str(uuid.uuid4())
    upload_dir = Path(settings.upload_dir) / job_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_paths: List[str] = []
    filenames: List[str] = []

    for upload in files:
        dest = upload_dir / (upload.filename or f"file_{len(file_paths)}")
        with dest.open("wb") as buf:
            shutil.copyfileobj(upload.file, buf)
        file_paths.append(str(dest))
        filenames.append(upload.filename or dest.name)

    services.job_store[job_id] = {
        "job_id": job_id,
        "status": JobStatus.PENDING,
        "collection_name": collection_name,
        "files": filenames,
        "total_chunks": 0,
        "processed_files": 0,
        "total_files": len(files),
        "error": None,
        "created_at": datetime.now(timezone.utc),
        "completed_at": None,
    }

    background_tasks.add_task(_run_ingestion, job_id, file_paths, collection_name, services)

    return IngestResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        message=f"Ingestion started for {len(files)} file(s) into '{collection_name}'",
    )


@router.get("/ingest/{job_id}", response_model=IngestJobDetail)
async def get_ingestion_status(
    job_id: str,
    services: ServiceContainer = Depends(get_services),
) -> IngestJobDetail:
    """Return the status and progress of an ingestion job."""

    from app.api.exceptions import IngestionJobNotFoundError

    job = services.job_store.get(job_id)
    if not job:
        raise IngestionJobNotFoundError(job_id)
    return IngestJobDetail(**job)

