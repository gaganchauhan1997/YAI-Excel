"""
PDFParser — convert PDF pages to images (for vision audit) and pull tables
where possible (Camelot).
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from loguru import logger


@dataclass
class PDFParser:
    storage_path: Path
    dpi: int = 200

    def to_images(self, pdf_path: str | Path) -> list[Path]:
        from pdf2image import convert_from_path

        src = Path(pdf_path)
        out_dir = self.storage_path / f"pdfpages_{src.stem}"
        out_dir.mkdir(parents=True, exist_ok=True)
        pages = convert_from_path(str(src), dpi=self.dpi)
        out_paths: list[Path] = []
        for i, page in enumerate(pages, start=1):
            out = out_dir / f"page_{i:03d}.jpg"
            page.save(out, "JPEG", quality=92)
            out_paths.append(out)
        logger.info(f"PDFParser.to_images | {src.name} -> {len(out_paths)} pages")
        return out_paths

    def extract_tables(self, pdf_path: str | Path) -> list[pd.DataFrame]:
        try:
            import camelot  # type: ignore
        except Exception as exc:
            logger.warning(f"Camelot unavailable: {exc}")
            return []
        try:
            tables = camelot.read_pdf(str(pdf_path), pages="all", flavor="lattice")
            dfs = [t.df for t in tables]
            if not dfs:
                tables = camelot.read_pdf(str(pdf_path), pages="all", flavor="stream")
                dfs = [t.df for t in tables]
            return dfs
        except Exception as exc:
            logger.warning(f"PDF table extract failed: {exc}")
            return []
