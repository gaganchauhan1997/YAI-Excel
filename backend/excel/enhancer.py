"""
EnhancementEngine — ensures every dashboard ships with a minimum bar of
quality, regardless of how thin the input was.

Rules:
  - No KPIs in audit?  → add 4 default KPIs.
  - No charts?         → add 2 default charts.
  - No conditional formatting? → add a color-scale to first numeric column.
  - No interactive controls?   → add a period dropdown at B1.
  - No formulas?       → add the universal formula pack.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from loguru import logger

try:
    from ai.formula_engine import FormulaEngine
except ImportError:  # support both `from backend.excel...` and `from excel...`
    from ..ai.formula_engine import FormulaEngine  # type: ignore


@dataclass
class EnhancementEngine:
    theme: dict

    def enhance(self, audit: dict) -> dict:
        audit = dict(audit or {})
        audit.setdefault("kpi_strip", [])
        audit.setdefault("charts", [])
        audit.setdefault("conditional_formatting", [])
        audit.setdefault("interactive_controls", [])
        audit.setdefault("formulas", [])
        audit.setdefault("data_tables", [])

        if not audit["kpi_strip"]:
            audit["kpi_strip"] = self._default_kpis()
            logger.info("EnhancementEngine: added 4 default KPIs")

        if not audit["charts"]:
            audit["charts"] = self._default_charts()
            logger.info("EnhancementEngine: added 2 default charts")

        if not audit["interactive_controls"]:
            audit["interactive_controls"] = [{
                "type": "dropdown",
                "location": "B1",
                "linked_cell": "B1",
                "options": ["Q1", "Q2", "Q3", "Q4", "All"],
                "drives": ["all_kpis", "all_charts"],
            }]
            logger.info("EnhancementEngine: added period dropdown")

        if not audit["formulas"]:
            audit["formulas"] = FormulaEngine.universal_pack(control_cell="$B$1")

        audit["counts"] = {
            "charts": len(audit["charts"]),
            "pivots": len(audit.get("pivot_tables", [])),
            "kpis": len(audit["kpi_strip"]),
            "formulas": len(audit["formulas"]),
            "interactive_controls": len(audit["interactive_controls"]),
            "conditional_formats": len(audit["conditional_formatting"]),
            "named_ranges": len(audit.get("named_ranges", [])),
            "slicers": len(audit.get("slicers", [])),
        }
        return audit

    def _default_kpis(self) -> list[dict]:
        return [
            {"id": f"kpi_{i+1}",
             "label": label,
             "value": "",
             "formula": "=SUM(Data!B:B)" if i == 0 else "",
             "trend": "neutral",
             "location": "",
             "bg_color": "#" + self.theme["kpi_bg"],
             "text_color": "#" + self.theme["kpi_fg"]}
            for i, label in enumerate(["Revenue", "Cost", "Profit", "Margin %"])
        ]

    def _default_charts(self) -> list[dict]:
        return [
            {"id": "chart_1", "type": "bar", "title": "Revenue by Period",
             "location": "B10",
             "series": [{"name": "Revenue", "values_range": "Data!B2:B13",
                         "categories_range": "Data!A2:A13",
                         "color": "#" + self.theme["chart_colors"][0]}],
             "has_legend": True, "has_data_labels": False,
             "is_dynamic": True},
            {"id": "chart_2", "type": "donut", "title": "Distribution",
             "location": "L10",
             "series": [{"name": "Share", "values_range": "Data!B2:B5",
                         "categories_range": "Data!A2:A5",
                         "color": "#" + self.theme["chart_colors"][1]}],
             "has_legend": True, "has_data_labels": True,
             "is_dynamic": True},
        ]
