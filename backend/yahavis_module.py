"""
YAI-Excel × YAHAVIS AI integration shim.

This module exposes a clean Python API + a YAHAVIS-compatible manifest so
YAHAVIS can mount YAI-Excel as a callable subsystem.

Drop this file (or the whole `backend/` package) into your YAHAVIS repo and:

    from backend.yahavis_module import YAIExcelModule

    module = YAIExcelModule()
    module.register(yahavis_core)

After registration:
    • Voice trigger        — "Yahavi, build a dashboard from this CSV"
    • Hotword              — "dashboard / sheet / report / pivot"
    • Tool name            — "yai_excel.build"
    • Returns              — {path, audit, quality} payload
"""
from __future__ import annotations

import io
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

try:
    import pandas as pd
except ImportError:  # optional — manifest still loadable without pandas
    pd = None  # type: ignore

# These imports work whether the file lives inside ``backend/`` or beside it.
try:
    from excel import YAIExcelBuilder
    from excel.themes import list_themes, get_theme
    from ai import AIRouter, VisionReader, AuditMerger, DataAnalyzer
    from parsers import (
        ImageParser, VideoParser, PDFParser, ExcelParser,
        CSVParser, TextParser, detect_input_type,
    )
except ImportError:  # support being imported as backend.yahavis_module
    from .excel import YAIExcelBuilder  # type: ignore
    from .excel.themes import list_themes, get_theme  # type: ignore
    from .ai import AIRouter, VisionReader, AuditMerger, DataAnalyzer  # type: ignore
    from .parsers import (  # type: ignore
        ImageParser, VideoParser, PDFParser, ExcelParser,
        CSVParser, TextParser, detect_input_type,
    )


MANIFEST: dict[str, Any] = {
    "id": "yai_excel",
    "name": "YAI-Excel",
    "version": "1.1.0",
    "vendor": "Hackknow",
    "ecosystem": "YAHAVIS AI",
    "tagline": "Give us anything. Get a dashboard.",
    "voice_triggers": [
        "build a dashboard",
        "make a sheet",
        "generate a report",
        "create a pivot",
        "excel banao",  # Hindi: "make an excel"
        "dashboard banao",  # Hindi: "make a dashboard"
    ],
    "hotwords": ["dashboard", "sheet", "report", "pivot", "excel", "xlsx"],
    "input_modes": [
        "image", "video", "pdf", "excel", "csv", "tsv",
        "json", "xml", "sheets_url", "prompt", "mixed",
    ],
    "themes": list_themes(),
    "commands": [
        {"name": "yai_excel.build", "description": "Build a workbook from any input"},
        {"name": "yai_excel.themes", "description": "List available themes"},
        {"name": "yai_excel.audit", "description": "Run only the audit (no build)"},
    ],
    "output_type": "file/xlsx",
    "free_tier_only": True,
}


@dataclass
class YAIExcelModule:
    """YAHAVIS-compatible YAI-Excel adapter."""

    storage_path: Path = field(default_factory=lambda: Path("./uploads"))
    output_path: Path = field(default_factory=lambda: Path("./outputs"))
    router: AIRouter = field(default_factory=AIRouter)

    # --------------------------------------------------------------
    # Registration
    # --------------------------------------------------------------
    def register(self, yahavis_core: Any) -> dict[str, Any]:
        """Register with a YAHAVIS core. The core is expected to expose
        ``register_module(manifest, callable)``."""
        if hasattr(yahavis_core, "register_module"):
            yahavis_core.register_module(MANIFEST, self.invoke)
        return MANIFEST

    def manifest(self) -> dict[str, Any]:
        return MANIFEST

    # --------------------------------------------------------------
    # Top-level invocation
    # --------------------------------------------------------------
    def invoke(self, command: str, **kwargs) -> dict[str, Any]:
        if command == "yai_excel.themes":
            return {"themes": list_themes()}
        if command == "yai_excel.audit":
            return {"audit": self._audit(**kwargs)}
        if command == "yai_excel.build":
            return self.build(**kwargs)
        raise ValueError(f"Unknown command: {command}")

    # --------------------------------------------------------------
    # Core build
    # --------------------------------------------------------------
    def build(
        self,
        *,
        file_path: str | Path | None = None,
        prompt: str | None = None,
        sheets_url: str | None = None,
        theme: str = "midnight",
        output_name: str | None = None,
        indian_format: bool = False,
    ) -> dict[str, Any]:
        """Universal entry point. Accepts file_path / prompt / sheets_url and
        returns a dict with the built workbook path + audit metadata."""
        audit, raw_df = self._collect(file_path=file_path, prompt=prompt, sheets_url=sheets_url)
        builder = YAIExcelBuilder(theme_name=theme, raw_data=raw_df, audit=audit)
        if indian_format:
            self._apply_indian_format(builder)
        name = output_name or f"yai_excel_{theme}.xlsx"
        out = self.output_path / name
        out.parent.mkdir(parents=True, exist_ok=True)
        result = builder.build()
        result.workbook.save(out)
        return {
            "ok": True,
            "path": str(out),
            "audit": {
                "domain": audit.get("detected_domain"),
                "counts": audit.get("counts", {}),
                "confidence": audit.get("confidence"),
            },
            "quality": result.quality,
            "theme": theme,
        }

    # --------------------------------------------------------------
    # Voice handlers (optional plug-ins for YAHAVIS voice core)
    # --------------------------------------------------------------
    def voice_handler(self, transcript: str, attachments: Iterable[str] | None = None) -> dict[str, Any]:
        """Called when the wake-word + a YAI-Excel hotword fire together.

        Picks the best input mode based on transcript + attachments and runs
        ``build``. Returns the same payload as ``build``.
        """
        attachments = list(attachments or [])
        theme = self._detect_theme_in_text(transcript) or "midnight"
        indian_format = any(kw in transcript.lower() for kw in ("inr", "rupees", "lakhs", "crores", "indian"))

        if attachments:
            return self.build(file_path=attachments[0], theme=theme, indian_format=indian_format)
        return self.build(prompt=transcript, theme=theme, indian_format=indian_format)

    # --------------------------------------------------------------
    # Internal helpers
    # --------------------------------------------------------------
    def _audit(self, *, file_path: str | Path | None = None, prompt: str | None = None,
               sheets_url: str | None = None) -> dict:
        audit, _ = self._collect(file_path=file_path, prompt=prompt, sheets_url=sheets_url)
        return audit

    def _collect(self, *, file_path=None, prompt=None, sheets_url=None):
        if file_path:
            kind = detect_input_type(str(file_path))
            if kind == "image":
                p = ImageParser(self.storage_path).enhance(file_path)
                audit = VisionReader(self.router).audit_image(p) if self.router.has_vision() else {}
                return audit, None
            if kind == "video":
                frames = VideoParser(self.storage_path).extract_keyframes(file_path)
                per = VisionReader(self.router).audit_frames(frames) if self.router.has_vision() else []
                return AuditMerger().merge(per), None
            if kind == "pdf":
                pages = PDFParser(self.storage_path).to_images(file_path)
                per = VisionReader(self.router).audit_frames(pages) if self.router.has_vision() else []
                return AuditMerger().merge(per), None
            if kind == "excel":
                df = ExcelParser().read(file_path)
                an = DataAnalyzer(self.router)
                return an.refine_with_ai(df, an.draft_audit(df)), df
            if kind in {"csv", "tsv", "json", "xml"}:
                cp = CSVParser()
                df = (cp.read(file_path) if kind == "csv"
                      else cp.read_tsv(file_path) if kind == "tsv"
                      else cp.read_json(file_path) if kind == "json"
                      else cp.read_xml(file_path))
                an = DataAnalyzer(self.router)
                return an.refine_with_ai(df, an.draft_audit(df)), df
        if prompt:
            return TextParser(self.router).prompt_to_audit(prompt), None
        return {}, None

    @staticmethod
    def _detect_theme_in_text(text: str) -> str | None:
        if not text:
            return None
        lower = text.lower()
        for t in list_themes():
            if t in lower:
                return t
        return None

    @staticmethod
    def _apply_indian_format(builder: YAIExcelBuilder) -> None:
        """Force INR number formats on all KPI value cells."""
        from .excel.indian_formatter import excel_number_format  # type: ignore
        builder.audit.setdefault("_indian_format", True)
        # The KPIEngine consults `_indian_format` if present (see kpi_engine.py)
