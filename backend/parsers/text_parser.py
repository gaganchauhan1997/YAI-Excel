"""
TextParser — handles natural-language prompts and pasted text blobs.

The AI router converts the prompt into an audit JSON; this class wraps that.
"""
from __future__ import annotations

from dataclasses import dataclass

from loguru import logger

try:
    from ai.ai_router import AIRouter
    from ai.audit_prompts import PROMPT_TO_AUDIT
except ImportError:  # support both `from backend.parsers...` and `from parsers...`
    from ..ai.ai_router import AIRouter  # type: ignore
    from ..ai.audit_prompts import PROMPT_TO_AUDIT  # type: ignore


@dataclass
class TextParser:
    router: AIRouter

    def prompt_to_audit(self, description: str) -> dict:
        if not (self.router and self.router.has_any()):
            return self._offline_fallback(description)
        prompt = PROMPT_TO_AUDIT.format(description=description.strip())
        try:
            audit = self.router.json(prompt)
            if audit and not audit.get("_raw"):
                logger.info(f"TextParser.prompt_to_audit | confidence={audit.get('confidence')}")
                return audit
        except Exception as exc:
            logger.warning(f"prompt_to_audit failed: {exc}")
        return self._offline_fallback(description)

    @staticmethod
    def _offline_fallback(description: str) -> dict:
        return {
            "confidence": 0.4,
            "detected_domain": "custom",
            "meta": {"complexity": "basic"},
            "kpi_strip": [],
            "charts": [],
            "interactive_controls": [],
            "data_tables": [],
            "formulas": [],
            "conditional_formatting": [],
            "named_ranges": [],
            "missing_elements": ["Vision API key recommended for richer audits"],
            "enhancement_suggestions": [],
            "counts": {"charts": 0, "pivots": 0, "kpis": 0, "formulas": 0,
                       "interactive_controls": 0, "conditional_formats": 0,
                       "named_ranges": 0, "slicers": 0},
            "_user_prompt": description,
        }
