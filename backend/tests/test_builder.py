"""
Smoke tests for the Excel build pipeline.
Run from `backend/` with: `pytest -q`.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure backend/ is on sys.path so package imports resolve when pytest is
# invoked from anywhere.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import json
import pandas as pd
import pytest

from excel import YAIExcelBuilder
from excel.indian_formatter import indian_grouping, to_short, rupees
from excel.themes import list_themes


def _sample_df() -> pd.DataFrame:
    return pd.DataFrame({
        "Region": ["Delhi", "Mumbai", "Bangalore", "Chennai"],
        "Revenue": [1_250_000, 1_840_000, 1_620_000, 950_000],
        "Cost":    [820_000,   1_120_000, 990_000,   640_000],
    })


def test_indian_grouping_examples():
    assert indian_grouping(1_234) == "1,234"
    assert indian_grouping(1_23_456) == "1,23,456"
    assert indian_grouping(1_23_45_678) == "1,23,45,678"


def test_indian_short_form():
    assert to_short(1_500) == "₹1.5 K"
    assert to_short(1_50_000) == "₹1.5 L"
    assert to_short(1_50_00_000) == "₹1.5 Cr"


def test_rupees_full_format():
    assert rupees(1_23_45_678) == "₹1,23,45,678"


@pytest.mark.parametrize("theme", list_themes())
def test_every_theme_builds(theme, tmp_path):
    """Every built-in theme produces a non-empty workbook."""
    out = tmp_path / f"test_{theme}.xlsx"
    YAIExcelBuilder(theme_name=theme, raw_data=_sample_df(), audit={}).save_to_path(out)
    assert out.exists()
    assert out.stat().st_size > 4_000  # any real workbook is at least 4 KB


def test_quality_gates_pass_on_sample(tmp_path):
    """The bundled sample_audit.json must pass every quality gate."""
    examples = ROOT.parent / "examples"
    audit = json.loads((examples / "sample_audit.json").read_text())
    df = pd.read_csv(examples / "sample_sales.csv")
    builder = YAIExcelBuilder(theme_name="midnight", raw_data=df, audit=audit)
    result = builder.build()
    for gate, ok in result.quality.items():
        if gate == "all_passed":
            continue
        assert ok, f"quality gate {gate} failed: {result.quality}"


def test_pivot_engine_emits_sumifs(tmp_path):
    """v1.1+ pivot engine must emit real SUMIFS formulas, not placeholders."""
    examples = ROOT.parent / "examples"
    audit = json.loads((examples / "sample_audit.json").read_text())
    df = pd.read_csv(examples / "sample_sales.csv")
    wb = YAIExcelBuilder(theme_name="ocean", raw_data=df, audit=audit).build().workbook
    sumifs_cells = [
        cell.value for row in wb["Dashboard"].iter_rows()
        for cell in row if cell.value and "SUMIFS" in str(cell.value)
    ]
    assert len(sumifs_cells) >= 8, f"expected ≥ 8 SUMIFS cells, got {len(sumifs_cells)}"


def test_enhancer_fills_empty_audit(tmp_path):
    """EnhancementEngine must inject defaults so an empty audit still ships a usable dashboard."""
    builder = YAIExcelBuilder(theme_name="emerald", raw_data=_sample_df(), audit={})
    result = builder.build()
    audit = result.audit
    assert len(audit["kpi_strip"]) >= 4
    assert len(audit["charts"]) >= 2
    assert len(audit["interactive_controls"]) >= 1
