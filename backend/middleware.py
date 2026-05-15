"""
Production middleware — request-ID injection, structured logging,
file-size guard. Rate limiting is wired in `main.py` via slowapi.
"""
from __future__ import annotations

import time
import uuid
import json
import os

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from loguru import logger


MAX_BYTES = int(os.getenv("MAX_FILE_SIZE_MB", "500")) * 1024 * 1024


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Stamps every request with a UUIDv4 in `X-Request-ID`. Logs latency."""

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex
        request.state.request_id = rid
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:  # last-chance log
            logger.bind(request_id=rid, path=request.url.path).exception(f"unhandled: {exc}")
            response = JSONResponse({"detail": "Internal server error", "request_id": rid}, status_code=500)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers["X-Request-ID"] = rid
        response.headers["X-Response-Time-ms"] = str(latency_ms)
        logger.bind(request_id=rid).info(
            f"{request.method} {request.url.path} → {response.status_code} ({latency_ms}ms)"
        )
        return response


class FileSizeGuard(BaseHTTPMiddleware):
    """Rejects uploads whose `Content-Length` exceeds `MAX_FILE_SIZE_MB`."""

    async def dispatch(self, request: Request, call_next):
        if request.method == "POST" and "/api/upload" in request.url.path:
            length = request.headers.get("content-length")
            if length and int(length) > MAX_BYTES:
                return JSONResponse(
                    {"detail": f"File too large. Max {MAX_BYTES // 1024 // 1024} MB."},
                    status_code=413,
                )
        return await call_next(request)


def configure_logging() -> None:
    """Switch loguru to JSON in production. Plain text in dev."""
    if os.getenv("APP_ENV", "development") == "production":
        logger.remove()
        logger.add(
            lambda msg: print(msg, end=""),
            serialize=True,
            level=os.getenv("LOG_LEVEL", "INFO"),
        )
