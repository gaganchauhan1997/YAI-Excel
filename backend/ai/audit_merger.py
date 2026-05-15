"""
AuditMerger — merges multiple per-frame audits into one master audit JSON.

Used by the video pipeline (and any multi-page PDF) where each frame contributes
partial detection. Deduplicates by id and content, takes the highest-confidence
version on conflicts.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any


class AuditMerger:
    LIST_FIELDS = [
        "interactive_controls",
        "kpi_strip",
        "charts",
        "pivot_tables",
        "data_tables",
        "conditional_formatting",
        "formulas",
        "slicers",
        "named_ranges",
        "data_validation",
        "layout_bands",
        "enhancement_suggestions",
        "missing_elements",
    ]

    def merge(self, audits: list[dict]) -> dict:
        if not audits:
            return {}
        if len(audits) == 1:
            return audits[0]

        merged: dict[str, Any] = {
            "confidence": max((a.get("confidence", 0) or 0) for a in audits),
            "detected_domain": self._mode(a.get("detected_domain") for a in audits),
            "meta": self._merge_meta([a.get("meta", {}) for a in audits]),
        }

        for field in self.LIST_FIELDS:
            merged[field] = self._dedupe_concat([a.get(field, []) or [] for a in audits])

        merged["counts"] = self._recount(merged)
        return merged

    @staticmethod
    def _mode(values):
        seen = defaultdict(int)
        for v in values:
            if v:
                seen[v] += 1
        if not seen:
            return ""
        return max(seen.items(), key=lambda kv: kv[1])[0]

    def _merge_meta(self, metas: list[dict]) -> dict:
        out: dict[str, Any] = {}
        for m in metas:
            for k, v in (m or {}).items():
                if v in (None, "", 0, [], False):
                    continue
                if k not in out or self._better(v, out[k]):
                    out[k] = v
        return out

    @staticmethod
    def _better(new, old) -> bool:
        if isinstance(new, (int, float)) and isinstance(old, (int, float)):
            return new > old
        if isinstance(new, list) and isinstance(old, list):
            return len(new) > len(old)
        return bool(new)

    def _dedupe_concat(self, lists: list[list[dict]]) -> list[dict]:
        seen: dict[str, dict] = {}
        for items in lists:
            for item in items:
                key = self._key_for(item)
                if key not in seen:
                    seen[key] = item
        return list(seen.values())

    @staticmethod
    def _key_for(item: dict) -> str:
        if "id" in item:
            return f"id:{item['id']}"
        if "label" in item:
            return f"label:{item.get('label')}|{item.get('location','')}"
        if "title" in item:
            return f"title:{item.get('title')}|{item.get('location','')}"
        if "range" in item:
            return f"range:{item['range']}"
        if "name" in item:
            return f"name:{item['name']}"
        if "cell" in item:
            return f"cell:{item['cell']}"
        return repr(sorted(item.items()))

    @staticmethod
    def _recount(merged: dict) -> dict:
        return {
            "charts": len(merged.get("charts", [])),
            "pivots": len(merged.get("pivot_tables", [])),
            "kpis": len(merged.get("kpi_strip", [])),
            "formulas": len(merged.get("formulas", [])),
            "interactive_controls": len(merged.get("interactive_controls", [])),
            "conditional_formats": len(merged.get("conditional_formatting", [])),
            "named_ranges": len(merged.get("named_ranges", [])),
            "slicers": len(merged.get("slicers", [])),
        }
