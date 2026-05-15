"""
YAI-Excel — Universal AI Excel Dashboard Generator
FastAPI entry point (v1.2 — production hardened).
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from loguru import logger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from api.routes import upload, generate, enhance
from middleware import RequestIDMiddleware, FileSizeGuard, configure_logging
from version import build_info, VERSION

load_dotenv()
configure_logging()

STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "./uploads"))
OUTPUT_PATH = Path(os.getenv("OUTPUT_PATH", "./outputs"))
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,https://yexcel.hackknow.com"
    ).split(",")
    if o.strip()
]

limiter = Limiter(key_func=get_remote_address, default_limits=[os.getenv("RATE_LIMIT", "120/minute")])


@asynccontextmanager
async def lifespan(app: FastAPI):
    STORAGE_PATH.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.mkdir(parents=True, exist_ok=True)
    logger.info(f"YAI-Excel v{VERSION} starting | storage={STORAGE_PATH} outputs={OUTPUT_PATH}")
    yield
    logger.info("YAI-Excel shutting down.")


app = FastAPI(
    title="YAI-Excel API",
    description="Give us anything. Get a dashboard.",
    version=VERSION,
    lifespan=lifespan,
    docs_url=os.getenv("DOCS_URL", "/docs"),
    redoc_url=None,
)

# ─── Middleware ───────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(FileSizeGuard)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Response-Time-ms"],
)

# ─── Routes ───────────────────────────────────────────────────────────
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(generate.router, prefix="/api", tags=["generate"])
app.include_router(enhance.router, prefix="/api", tags=["enhance"])
app.mount("/files", StaticFiles(directory=str(OUTPUT_PATH)), name="files")


@app.get("/", include_in_schema=False)
def root():
    return {
        "name": "YAI-Excel",
        "tagline": "Give us anything. Get a dashboard.",
        "version": VERSION,
        "docs": "/docs",
        "health": "/healthz",
    }


@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok"}


@app.get("/version", include_in_schema=False)
def version():
    return build_info()


@app.get("/metrics", include_in_schema=False, response_class=PlainTextResponse)
def metrics(request: Request):
    """Minimal Prometheus-style metrics. Replace with prometheus-fastapi-instrumentator
    in a heavier deploy; this hand-rolled endpoint keeps the container slim."""
    return (
        "# HELP yai_excel_version_info Build info\n"
        "# TYPE yai_excel_version_info gauge\n"
        f'yai_excel_version_info{{version="{VERSION}"}} 1\n'
    )
