from __future__ import annotations

from fastapi import HTTPException, status


class CollectionNotFoundError(HTTPException):
    """Raised when a requested Chroma collection does not exist."""

    def __init__(self, name: str) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Collection '{name}' not found",
        )


class IngestionJobNotFoundError(HTTPException):
    """Raised when an ingestion job cannot be found."""

    def __init__(self, job_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingestion job '{job_id}' not found",
        )


class OllamaConnectionError(HTTPException):
    """Raised when the Ollama service is unavailable."""

    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama service is unavailable",
        )


class FileTooLargeError(HTTPException):
    """Raised when an uploaded file exceeds the configured size limit."""

    def __init__(self, max_mb: int) -> None:
        super().__init__(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size of {max_mb}MB",
        )


class UnsupportedFileTypeError(HTTPException):
    """Raised when an uploaded file has an unsupported type."""

    def __init__(self, filename: str) -> None:
        super().__init__(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type: {filename}. Supported: "
                ".pdf, .txt, .md, .png, .jpg, .jpeg, .webp, .csv"
            ),
        )

