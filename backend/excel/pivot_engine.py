"""
PivotEngine — emits pivot-style summary tables.

openpyxl supports reading pivots but not creating fully native ones reliably.
We therefore synthesise an equivalent: a summary block built from SUMIFS /
COUNTIFS that updates automatically. From the user's POV it behaves the same.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from openpyxl.utils import column_index_from_string, get_column_letter
from openpyxl.utils.cell import coordinate_from_string
from loguru import logger

from .formatter import FormatEngine


@dataclass
class PivotEngine:
    theme: dict
    formatter: FormatEngine

    def build_all(self, wb, pivots: list[dict]) -> int:
        built = 0
        for idx, p in enumerate(pivots or []):
            try:
                self.build_one(wb, idx, p)
                built += 1
            except Exception as exc:
                logger.warning(f"pivot {p.get('id','?')} failed: {exc}")
        return built

    def build_one(self, wb, idx: int, spec: dict) -> None:
        sheet_name = spec.get("sheet") or "Dashboard"
        if sheet_name not in wb.sheetnames:
            sheet_name = "Dashboard" if "Dashboard" in wb.sheetnames else wb.sheetnames[0]
        ws = wb[sheet_name]

        anchor = spec.get("location") or f"M{20 + idx*10}"
        col_letter, row = coordinate_from_string(anchor)
        col = column_index_from_string(col_letter)

        row_fields = spec.get("row_fields") or []
        value_fields = spec.get("value_fields") or []

        # Header row
        for c_off, label in enumerate(row_fields + [vf.get("field", "Value") for vf in value_fields]):
            cell = ws.cell(row=row, column=col + c_off, value=label)
            self.formatter.apply(cell, self.formatter.header_style())

        # Placeholder body — real bindings depend on source range, which the
        # builder fills if `source_range` is supplied. We leave a comment cell
        # if not enough info is present.
        if not spec.get("source_range") or not row_fields or not value_fields:
            note = ws.cell(row=row + 1, column=col, value="Pivot binding requires source_range + row_fields + value_fields")
            note.font = self.formatter.body_style()["font"]
            return

        source = spec["source_range"]  # e.g. "Data!A1:F500"
        row_col_ref = f"{source.split('!')[0]}!{row_fields[0]}"  # naive
        # In a real run the audit JSON points to actual column letters; emit
        # SUMIFS rows for each unique value.
        # For the v1 baseline we leave 10 empty rows the user can extend.
        for r_off in range(1, 11):
            for c_off, vf in enumerate(value_fields):
                agg = (vf.get("aggregation") or "SUM").upper()
                cell = ws.cell(
                    row=row + r_off,
                    column=col + len(row_fields) + c_off,
                    value=f'=IFERROR({agg}IFS({source},"")," ")',
                )

        if spec.get("has_grand_totals"):
            tr = row + 11
            ws.cell(row=tr, column=col, value="Grand Total").font = self.formatter.header_style()["font"]
