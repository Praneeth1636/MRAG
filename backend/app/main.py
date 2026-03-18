from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

from app.api.deps import init_services, shutdown_services
from app.api.routes import collections, evaluate, health, ingest, query
from app.config import get_settings
from app.logging_config import setup_logging

logger = structlog.get_logger()


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware that logs basic request/response information."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000.0
        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round(duration_ms, 2),
        )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup, clean up on shutdown."""

    await init_services(app)
    yield
    await shutdown_services(app)


setup_logging()
settings = get_settings()

app = FastAPI(
    title="MultiModal RAG API",
    version="0.1.0",
    description="Production-grade multi-modal RAG pipeline with evaluation framework",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_exception", path=str(request.url.path), error=str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": type(exc).__name__},
    )


app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(ingest.router, prefix="/api/v1", tags=["ingestion"])
app.include_router(query.router, prefix="/api/v1", tags=["query"])
app.include_router(evaluate.router, prefix="/api/v1", tags=["evaluation"])
app.include_router(collections.router, prefix="/api/v1", tags=["collections"])

