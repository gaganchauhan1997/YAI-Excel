"""
IndianFormatter — Indian numbering system formatting.

  1,234       → "1,234"
  12,345      → "12,345"
  1,23,456    → "1,23,456"        (lakh grouping)
  12,34,567   → "12,34,567"
  1,23,45,678 → "1,23,45,678"     (crore grouping)

Short forms:
  1_50_000      → "1.5 L"
  1_00_00_000   → "1 Cr"
  15_75_00_000  → "15.75 Cr"

Excel `number_format` strings that match Indian grouping are also exposed —
attach them directly to cells via `cell.number_format`.
"""
from __future__ import annotations

from decimal import Decimal

# Indian-grouping Excel number formats. Excel doesn't have a native 2-3-3
# grouping, but these custom masks render correctly in MS Excel + LibreOffice.
INR_FORMAT = '[>=10000000]"₹"##\\,##\\,##\\,##0;[>=100000]"₹"##\\,##\\,##0;"₹"##,##0'
INR_FORMAT_LAKH = '"₹"##\\,##\\,##0.00'
INR_FORMAT_CRORE = '"₹"##\\,##\\,##\\,##0.00'
INR_SHORT_FORMAT = (
    '[>=10000000]"₹"0.00,,,"Cr";'
    '[>=100000]"₹"0.00,,"L";'
    '"₹"#,##0'
)


def indian_grouping(value: float | int) -> str:
    """Format `value` with Indian comma grouping (2-3 split)."""
    negative = value < 0
    raw = f"{abs(int(value)):d}"
    if len(raw) <= 3:
        out = raw
    else:
        last3, rest = raw[-3:], raw[:-3]
        chunks: list[str] = []
        while len(rest) > 2:
            chunks.append(rest[-2:])
            rest = rest[:-2]
        if rest:
            chunks.append(rest)
        out = ",".join(reversed(chunks)) + "," + last3
    return ("-" + out) if negative else out


def to_short(value: float | int, currency: bool = True) -> str:
    """Compact form: 1_50_000 → '₹1.5L', 1_00_00_000 → '₹1Cr'."""
    abs_v = abs(value)
    prefix = "₹" if currency else ""
    sign = "-" if value < 0 else ""

    if abs_v >= 1_00_00_000:
        return f"{sign}{prefix}{_trim(abs_v / 1_00_00_000)} Cr"
    if abs_v >= 1_00_000:
        return f"{sign}{prefix}{_trim(abs_v / 1_00_000)} L"
    if abs_v >= 1_000:
        return f"{sign}{prefix}{_trim(abs_v / 1_000)} K"
    return f"{sign}{prefix}{int(abs_v)}"


def _trim(x: float) -> str:
    """Render a float with up to 2 decimal places but no trailing zeros."""
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return s or "0"


def rupees(value: float | int) -> str:
    """Full formatted: '₹1,23,45,678'."""
    return "₹" + indian_grouping(value)


def excel_number_format(mode: str = "full") -> str:
    """Return an Excel number-format string for cells.

    Modes:
      - "full"  → ₹1,23,45,678 across the whole range
      - "smart" → ₹X, ₹X L, ₹X Cr depending on magnitude
      - "lakh"  → forces lakh grouping with two decimals
      - "crore" → forces crore grouping
    """
    return {
        "full": INR_FORMAT,
        "smart": INR_SHORT_FORMAT,
        "lakh": INR_FORMAT_LAKH,
        "crore": INR_FORMAT_CRORE,
    }.get(mode, INR_FORMAT)
