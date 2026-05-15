"""
FormulaWriter — writes raw formulas to cells from the audit JSON.
"""
from __future__ import annotations

from dataclasses import dataclass

from openpyxl.utils.cell import coordinate_from_string
from loguru import logger


@dataclass
class FormulaWriter:
    def write_all(self, wb, formulas: list[dict]) -> int:
        written = 0
        for f in formulas or []:
            cell_ref = f.get("cell")
            formula = f.get("formula")
            sheet_name = f.get("sheet") or "Dashboard"
            if not cell_ref or not formula:
                continue
            ws = wb[sheet_name] if sheet_name in wb.sheetnames else wb.active
            try:
                if not formula.startswith("="):
                    formula = "=" + formula
                ws[cell_ref] = formula
                written += 1
            except Exception as exc:
                logger.warning(f"formula {cell_ref} failed: {exc}")
        return written
