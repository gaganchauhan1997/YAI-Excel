"""
/api/upload — accept any input type, detect it, and return a short token
plus a preview of what was detected.

POST /api/upload
  multipart: file (optional)
  form:      text  (optional natural-language prompt or pasted blob)
             url   (optional Google Sheets / public URL)
Returns: { token, type, summary }
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from loguru import logger

from parsers import detect_input_type

router = APIRouter()
STORAGE = Path(os.getenv("STORAGE_PATH", "./uploads"))


@router.post("/upload")
async def upload(
    file: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
    url: str | None = Form(default=None),
):
    if not (file or text or url):
        raise HTTPException(status_code=400, detail="Provide a file, text, or url.")

    token = uuid.uuid4().hex
    session_dir = STORAGE / token
    session_dir.mkdir(parents=True, exist_ok=True)

    saved_path: Path | None = None
    if file:
        saved_path = session_dir / file.filename
        async with aiofiles.open(saved_path, "wb") as fh:
            while chunk := await file.read(1024 * 1024):
                await fh.write(chunk)
        logger.info(f"upload | saved {saved_path}")

    detected = detect_input_type(str(saved_path) if saved_path else url, raw_text=text)
    summary_messages = {
        "image": "📷 Image received — running visual audit",
        "video": "🎬 Video received — extracting keyframes",
        "pdf": "📄 PDF received — paginating + OCR",
        "excel": "📊 Excel file received — choose mode (Rebrand / Enhance / Redesign)",
        "csv": "📋 CSV received — detecting schema",
        "tsv": "📋 TSV received — detecting schema",
        "json": "📋 JSON received — flattening",
        "xml": "📋 XML received — flattening",
        "text": "📝 Text received — parsing tabular data",
        "prompt": "💬 Prompt received — generating dashboard structure",
        "sheets_url": "🔗 Google Sheets URL received — fetching",
    }

    return {
        "token": token,
        "type": detected,
        "summary": summary_messages.get(detected, "Input received"),
        "file": str(saved_path.name) if saved_path else None,
        "url": url,
        "text_preview": (text or "")[:200],
    }
