"""
/api/generate — main entry point. Takes an upload token + theme choice,
runs the full pipeline (detect → audit → enhance → build), saves the .xlsx
to /outputs, and returns metadata + a download URL.
"""
from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from loguru import logger
from pydantic import BaseModel, Field

from ai import AIRouter, VisionReader, AuditMerger, DataAnalyzer
from parsers import (
    CSVParser,
    ExcelParser,
    ImageParser,
    PDFParser,
    TextParser,
    VideoParser,
    detect_input_type,
)
from excel import YAIExcelBuilder
from excel.themes import list_themes

router = APIRouter()
STORAGE = Path(os.getenv("STORAGE_PATH", "./uploads"))
OUTPUTS = Path(os.getenv("OUTPUT_PATH", "./outputs"))


class GenerateRequest(BaseModel):
    token: str = Field(..., description="Upload session token from /api/upload")
    theme: str = Field(default="midnight", description="One of: " + ", ".join(list_themes()))
    mode: str = Field(default="enhance", description="rebrand | enhance | redesign (for Excel input)")
    user_prompt: Optional[str] = Field(default=None, description="Optional extra instructions to merge in")


@router.post("/generate")
def generate(req: GenerateRequest) -> dict[str, Any]:
    session_dir = STORAGE / req.token
    if not session_dir.exists():
        raise HTTPException(status_code=404, detail="Unknown token — call /api/upload first.")

    router_ai = AIRouter()
    audit: dict[str, Any] = {}
    raw_df = None
    input_type = "prompt"
    primary_file = next((p for p in session_dir.iterdir() if p.is_file()), None)

    # ------------------------------------------------------------------
    # Dispatch by input type
    # ------------------------------------------------------------------
    if primary_file:
        input_type = detect_input_type(str(primary_file))
        logger.info(f"generate | token={req.token} type={input_type} file={primary_file.name}")

        if input_type == "image":
            ip = ImageParser(storage_path=session_dir)
            enhanced = ip.enhance(primary_file)
            audit = VisionReader(router_ai).audit_image(enhanced) if router_ai.has_vision() else {}

        elif input_type == "video":
            vp = VideoParser(storage_path=session_dir)
            frames = vp.extract_keyframes(primary_file)
            if router_ai.has_vision() and frames:
                per_frame = VisionReader(router_ai).audit_frames(frames)
                audit = AuditMerger().merge(per_frame)

        elif input_type == "pdf":
            pdfp = PDFParser(storage_path=session_dir)
            pages = pdfp.to_images(primary_file)
            if router_ai.has_vision() and pages:
                per_page = VisionReader(router_ai).audit_frames(pages)
                audit = AuditMerger().merge(per_page)
            # also try table extraction
            tables = pdfp.extract_tables(primary_file)
            if tables and raw_df is None:
                raw_df = tables[0]

        elif input_type == "excel":
            ep = ExcelParser()
            raw_df = ep.read(primary_file)
            analyzer = DataAnalyzer(router_ai)
            audit = analyzer.refine_with_ai(raw_df, analyzer.draft_audit(raw_df))

        elif input_type in {"csv", "tsv", "json", "xml"}:
            cp = CSVParser()
            if input_type == "csv":
                raw_df = cp.read(primary_file)
            elif input_type == "tsv":
                raw_df = cp.read_tsv(primary_file)
            elif input_type == "json":
                raw_df = cp.read_json(primary_file)
            else:
                raw_df = cp.read_xml(primary_file)
            analyzer = DataAnalyzer(router_ai)
            audit = analyzer.refine_with_ai(raw_df, analyzer.draft_audit(raw_df))

        else:
            # plain text file
            text = primary_file.read_text(errors="ignore")
            audit = TextParser(router_ai).prompt_to_audit(text)

    if req.user_prompt:
        prompt_audit = TextParser(router_ai).prompt_to_audit(req.user_prompt)
        if not audit:
            audit = prompt_audit
        else:
            audit.setdefault("enhancement_suggestions", []).extend(
                prompt_audit.get("enhancement_suggestions", [])
            )

    if not audit and not raw_df is not None:
        # Pure prompt mode
        audit = TextParser(router_ai).prompt_to_audit(req.user_prompt or "Generate a default business KPI dashboard.")

    # ------------------------------------------------------------------
    # Build .xlsx
    # ------------------------------------------------------------------
    builder = YAIExcelBuilder(theme_name=req.theme, raw_data=raw_df, audit=audit)
    out_name = f"YAI-Excel_{req.token[:8]}_{req.theme}.xlsx"
    OUTPUTS.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUTS / out_name
    builder.save_to_path(out_path)

    return {
        "token": req.token,
        "type": input_type,
        "theme": req.theme,
        "download_url": f"/files/{out_name}",
        "filename": out_name,
        "audit": {
            "domain": audit.get("detected_domain"),
            "counts": audit.get("counts", {}),
            "confidence": audit.get("confidence"),
            "enhancement_suggestions": audit.get("enhancement_suggestions", []),
        },
    }


@router.get("/themes")
def themes() -> dict[str, list[str]]:
    return {"themes": list_themes()}
