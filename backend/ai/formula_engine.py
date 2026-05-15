"""
FormulaEngine — auto-detects data type and emits the right Excel formulas.

This is the bridge between the audit JSON and the actual cells written by
the builder. It generates universal formula sets (financial / sales / time)
plus the dynamic chart-title and trend-arrow formulas every dashboard ships
with.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass
class FormulaSet:
    formulas: list[dict]  # [{cell, formula, type}]
    named_ranges: list[dict]
    data_validation: list[dict]


class FormulaEngine:
    """Stateless helper — just call the static methods."""

    # ---------- universal building blocks ----------
    @staticmethod
    def sum_range(rng: str) -> str:
        return f"=SUM({rng})"

    @staticmethod
    def avg_range(rng: str) -> str:
        return f"=AVERAGE({rng})"

    @staticmethod
    def sumifs(value_range: str, *conditions: tuple[str, str]) -> str:
        parts = [value_range]
        for col, criterion in conditions:
            parts.append(f"{col},{criterion}")
        return f"=SUMIFS({','.join(parts)})"

    @staticmethod
    def profit_margin(rev_cell: str, cost_cell: str) -> str:
        return f"=IFERROR(({rev_cell}-{cost_cell})/{rev_cell},0)"

    @staticmethod
    def mom_growth(current: str, previous: str) -> str:
        return f"=IFERROR(({current}-{previous})/{previous},0)"

    @staticmethod
    def ytd(month_col: str, current_month: str, value_col: str) -> str:
        return f"=SUMIF({month_col},\"<=\"&{current_month},{value_col})"

    @staticmethod
    def running_total(start: str, end: str) -> str:
        return f"=SUM({start}:{end})"

    @staticmethod
    def variance(actual: str, plan: str) -> str:
        return f"={actual}-{plan}"

    @staticmethod
    def variance_pct(actual: str, plan: str) -> str:
        return f"=IFERROR(({actual}-{plan})/{plan},0)"

    # ---------- sales ----------
    @staticmethod
    def conversion(sales: str, leads: str) -> str:
        return f"=IFERROR({sales}/{leads},0)"

    @staticmethod
    def avg_order(revenue: str, orders: str) -> str:
        return f"=IFERROR({revenue}/{orders},0)"

    @staticmethod
    def rank(value: str, value_range: str, ascending: bool = False) -> str:
        order = 1 if ascending else 0
        return f"=RANK({value},{value_range},{order})"

    # ---------- time series ----------
    @staticmethod
    def moving_average(cell: str, periods: int) -> str:
        return f"=AVERAGE(OFFSET({cell},-{periods-1},0,{periods},1))"

    @staticmethod
    def forecast_linear(x: str, known_y_range: str, known_x_range: str) -> str:
        return f"=FORECAST.LINEAR({x},{known_y_range},{known_x_range})"

    # ---------- dashboard universals ----------
    @staticmethod
    def dynamic_title(prefix: str, control_cell: str, fmt: str = "MMM YYYY") -> str:
        return f'="{prefix} — "&TEXT({control_cell},"{fmt}")'

    @staticmethod
    def trend_arrow(current: str, previous: str) -> str:
        return (
            f'=IF({current}>{previous},'
            f'"▲ "&TEXT(({current}-{previous})/{previous},"0.0%"),'
            f'"▼ "&TEXT(ABS(({current}-{previous})/{previous}),"0.0%"))'
        )

    @staticmethod
    def iferror_wrap(inner: str, fallback: str = "0") -> str:
        # If inner already starts with =, strip for embedding.
        body = inner[1:] if inner.startswith("=") else inner
        return f"=IFERROR({body},{fallback})"

    # ---------- bulk generator ----------
    @classmethod
    def universal_pack(cls, control_cell: str = "$B$1") -> list[dict]:
        """Standard formulas every dashboard ships with."""
        return [
            {"cell": "A1", "formula": '="YAI-Excel Dashboard — "&TEXT(TODAY(),"DD MMM YYYY")', "type": "text"},
            {"cell": "Z1", "formula": "=NOW()", "type": "date"},
        ]
