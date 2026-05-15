"""
DataAnalyzer — inspects a pandas DataFrame and produces a draft audit JSON.

Used when input is raw tabular data (CSV, Excel data sheet, paste from DB).
Detects domain hints, column types, suggests KPIs/charts. Optionally asks the
AIRouter to refine the draft into the full audit schema.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from loguru import logger

from .ai_router import AIRouter
from .audit_prompts import DATA_TO_AUDIT


@dataclass
class DataAnalyzer:
    router: AIRouter | None = None

    DOMAIN_HINTS = {
        "sales": ["revenue", "sales", "orders", "leads", "conversion", "customer"],
        "finance": ["profit", "cost", "expense", "margin", "ebitda", "cash"],
        "hr": ["employee", "headcount", "attrition", "salary", "hire"],
        "marketing": ["campaign", "ctr", "impressions", "clicks", "spend", "roas"],
        "inventory": ["stock", "sku", "warehouse", "reorder"],
        "logistics": ["delivery", "shipment", "route", "fleet"],
        "healthcare": ["patient", "diagnosis", "admission", "discharge"],
        "education": ["student", "grade", "score", "course"],
        "real_estate": ["property", "rent", "listing", "occupancy"],
    }

    def detect_domain(self, columns: list[str]) -> str:
        lc = " ".join(c.lower() for c in columns)
        best = ("custom", 0)
        for domain, keywords in self.DOMAIN_HINTS.items():
            hits = sum(1 for k in keywords if k in lc)
            if hits > best[1]:
                best = (domain, hits)
        return best[0]

    def column_types(self, df: pd.DataFrame) -> dict[str, str]:
        out: dict[str, str] = {}
        for col in df.columns:
            s = df[col]
            if pd.api.types.is_datetime64_any_dtype(s):
                out[col] = "date"
            elif pd.api.types.is_numeric_dtype(s):
                out[col] = "number"
            elif s.nunique(dropna=True) <= max(20, int(len(s) * 0.05)):
                out[col] = "category"
            else:
                out[col] = "text"
        return out

    def draft_audit(self, df: pd.DataFrame) -> dict:
        """A heuristic audit built without AI — works fully offline."""
        df = df.copy()
        columns = [str(c) for c in df.columns]
        types = self.column_types(df)
        domain = self.detect_domain(columns)

        numeric_cols = [c for c, t in types.items() if t == "number"]
        category_cols = [c for c, t in types.items() if t == "category"]
        date_cols = [c for c, t in types.items() if t == "date"]

        kpis: list[dict] = []
        for i, col in enumerate(numeric_cols[:4]):
            kpis.append({
                "id": f"kpi_{i+1}",
                "label": col,
                "formula": f"=SUM(Data!{self._col_letter(columns.index(col)+1)}2:{self._col_letter(columns.index(col)+1)}{len(df)+1})",
                "trend": "neutral",
                "icon": "",
                "location": f"{self._col_letter(2 + i*3)}3",
                "bg_color": "#1e3a5f",
                "text_color": "#ffffff",
            })

        charts: list[dict] = []
        if numeric_cols and (category_cols or date_cols):
            cat = (date_cols + category_cols)[0]
            charts.append({
                "id": "chart_1",
                "type": "bar" if cat in category_cols else "line",
                "title": f"{numeric_cols[0]} by {cat}",
                "location": "B10",
                "data_source": "Data",
                "series": [{
                    "name": numeric_cols[0],
                    "values_range": f"Data!{self._col_letter(columns.index(numeric_cols[0])+1)}2:{self._col_letter(columns.index(numeric_cols[0])+1)}{len(df)+1}",
                    "categories_range": f"Data!{self._col_letter(columns.index(cat)+1)}2:{self._col_letter(columns.index(cat)+1)}{len(df)+1}",
                    "color": "#6366f1",
                    "chart_type": "bar",
                }],
                "has_legend": True,
                "has_data_labels": False,
                "axis_x_title": cat,
                "axis_y_title": numeric_cols[0],
                "is_dynamic": True,
            })

        return {
            "confidence": 0.6,
            "detected_domain": domain,
            "meta": {
                "total_sheets": 2,
                "total_rows": len(df) + 2,
                "total_columns": len(columns),
                "primary_color": "#1e3a5f",
                "accent_color": "#ffc000",
                "complexity": "standard" if len(df) > 100 else "basic",
            },
            "kpi_strip": kpis,
            "charts": charts,
            "data_tables": [{
                "id": "table_1",
                "location": "A1",
                "headers": columns,
                "row_count": len(df),
                "has_totals_row": True,
                "table_style": "TableStyleMedium9",
                "has_conditional_format": True,
            }],
            "interactive_controls": [{
                "type": "dropdown",
                "location": "B1",
                "linked_cell": "B1",
                "options": [],
                "drives": ["all_kpis", "all_charts"],
            }] if date_cols else [],
            "conditional_formatting": [{
                "range": f"Data!{self._col_letter(columns.index(numeric_cols[0])+1)}2:{self._col_letter(columns.index(numeric_cols[0])+1)}{len(df)+1}",
                "rule_type": "color_scale",
                "format": {},
            }] if numeric_cols else [],
            "formulas": [],
            "named_ranges": [],
            "missing_elements": [],
            "enhancement_suggestions": [],
            "counts": {
                "charts": len(charts),
                "pivots": 0,
                "kpis": len(kpis),
                "formulas": 0,
                "interactive_controls": 1 if date_cols else 0,
                "conditional_formats": 1 if numeric_cols else 0,
                "named_ranges": 0,
                "slicers": 0,
            },
        }

    def refine_with_ai(self, df: pd.DataFrame, draft: dict) -> dict:
        if not (self.router and self.router.has_any()):
            return draft
        try:
            sample = df.head(8).to_csv(index=False)
            prompt = DATA_TO_AUDIT.format(
                columns=", ".join(str(c) for c in df.columns),
                sample=sample,
                types=self.column_types(df),
            )
            refined = self.router.json(prompt)
            if refined and not refined.get("_raw"):
                return refined
        except Exception as exc:
            logger.warning(f"DataAnalyzer.refine_with_ai failed: {exc}")
        return draft

    @staticmethod
    def _col_letter(idx: int) -> str:
        from openpyxl.utils import get_column_letter
        return get_column_letter(idx)
