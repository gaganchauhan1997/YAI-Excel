"""
Input-type detector. Returns one of:
  image | video | pdf | excel | csv | tsv | json | xml | text | prompt | sheets_url
"""
from __future__ import annotations

from pathlib import Path

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".bmp", ".tif", ".tiff"}
VIDEO_EXT = {".mp4", ".mov", ".avi", ".webm", ".mkv"}
EXCEL_EXT = {".xlsx", ".xls", ".xlsm", ".xlsb"}
CSV_EXT = {".csv"}
TSV_EXT = {".tsv"}
JSON_EXT = {".json"}
XML_EXT = {".xml"}
PDF_EXT = {".pdf"}
TEXT_EXT = {".txt", ".md", ".log"}


def detect_input_type(path_or_url: str | None, raw_text: str | None = None) -> str:
    if raw_text and not path_or_url:
        if raw_text.strip().startswith("http") and "docs.google.com/spreadsheets" in raw_text:
            return "sheets_url"
        return "prompt"
    if not path_or_url:
        return "prompt"
    p = Path(path_or_url)
    ext = p.suffix.lower()
    if ext in IMAGE_EXT:
        return "image"
    if ext in VIDEO_EXT:
        return "video"
    if ext in PDF_EXT:
        return "pdf"
    if ext in EXCEL_EXT:
        return "excel"
    if ext in CSV_EXT:
        return "csv"
    if ext in TSV_EXT:
        return "tsv"
    if ext in JSON_EXT:
        return "json"
    if ext in XML_EXT:
        return "xml"
    if ext in TEXT_EXT:
        return "text"
    return "text"
