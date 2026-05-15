"""
/api/enhance — accept an audit JSON directly and run enhancement +
quality-gate scoring. Useful for inspecting / iterating without
re-uploading.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from excel.enhancer import EnhancementEngine
from excel.themes import get_theme, list_themes

router = APIRouter()


class EnhanceRequest(BaseModel):
    audit: dict[str, Any] = Field(default_factory=dict)
    theme: str = "midnight"


@router.post("/enhance")
def enhance(req: EnhanceRequest) -> dict[str, Any]:
    enhancer = EnhancementEngine(get_theme(req.theme))
    audit = enhancer.enhance(req.audit)
    return {
        "audit": audit,
        "counts": audit.get("counts", {}),
        "available_themes": list_themes(),
    }
