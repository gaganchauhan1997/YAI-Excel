"""
CSVParser — load CSV / TSV / JSON / XML into a DataFrame with light cleaning.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd
from loguru import logger


@dataclass
class CSVParser:
    def read(self, path: str | Path, sep: str = ",") -> pd.DataFrame:
        df = pd.read_csv(path, sep=sep)
        return self._clean(df)

    def read_tsv(self, path: str | Path) -> pd.DataFrame:
        return self.read(path, sep="\t")

    def read_json(self, path: str | Path) -> pd.DataFrame:
        return self._clean(pd.read_json(path))

    def read_xml(self, path: str | Path) -> pd.DataFrame:
        return self._clean(pd.read_xml(path))

    def read_pasted(self, blob: str) -> pd.DataFrame:
        from io import StringIO
        sep = "\t" if "\t" in blob.splitlines()[0] else ","
        return self._clean(pd.read_csv(StringIO(blob), sep=sep))

    @staticmethod
    def _clean(df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df.columns = [str(c).strip() for c in df.columns]
        df = df.dropna(axis=1, how="all")
        df = df.drop_duplicates()
        for col in df.columns:
            if df[col].dtype == object:
                df[col] = df[col].astype(str).str.strip().replace({"nan": pd.NA})
            # try numeric coerce
            coerced = pd.to_numeric(df[col], errors="ignore")
            if coerced.dtype != df[col].dtype:
                df[col] = coerced
        logger.info(f"CSVParser cleaned | rows={len(df)} cols={len(df.columns)}")
        return df
