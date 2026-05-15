"""
YAI-Excel — Universal AI Excel Dashboard Generator
FastAPI entry point.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from loguru import logger

from api.routes import upload, generate, enhance

load_dotenv()

STORAGE_PATH = Path(os.getenv("STORAGE_PATH", "./uploads"))
OUTPUT_PATH = Path(os.getenv("OUTPUT_PATH", "./outputs"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    STORAGE_PATH.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.mkdir(parents=True, exist_ok=True)
    logger.info(f"YAI-Excel starting | storage={STORAGE_PATH} outputs={OUTPUT_PATH}")
    yield
    logger.info("YAI-Excel shutting down.")


app = FastAPI(
    title="YAI-Excel API",
    description="Give us anything. Get a dashboard.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(generate.router, prefix="/api", tags=["generate"])
app.include_router(enhance.router, prefix="/api", tags=["enhance"])

app.mount("/files", StaticFiles(directory=str(OUTPUT_PATH)), name="files")


@app.get("/")
def root():
    return {
        "name": "YAI-Excel",
        "tagline": "Give us anything. Get a dashboard.",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/healthz")
def healthz():
    return {"status": "ok"}
