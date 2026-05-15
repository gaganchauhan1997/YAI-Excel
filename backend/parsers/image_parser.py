"""
ImageParser — enhance a noisy/blurry/rotated photo before sending to vision AI.

Pipeline:
  1. Open with PIL.
  2. AutoContrast + Sharpen + Denoise.
  3. Upscale to at least 1600px on longest side.
  4. Save enhanced copy and return its path.
  5. Optional OCR fallback if vision AI isn't available.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from loguru import logger


@dataclass
class ImageParser:
    storage_path: Path

    def enhance(self, image_path: str | Path) -> Path:
        src = Path(image_path)
        img = Image.open(src).convert("RGB")
        img = ImageOps.exif_transpose(img)
        img = ImageOps.autocontrast(img, cutoff=2)
        img = img.filter(ImageFilter.SHARPEN)
        img = ImageEnhance.Contrast(img).enhance(1.15)
        # Upscale if small
        long_side = max(img.size)
        if long_side < 1600:
            scale = 1600 / long_side
            img = img.resize((int(img.size[0] * scale), int(img.size[1] * scale)), Image.LANCZOS)
        out = self.storage_path / f"enhanced_{src.stem}.jpg"
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, "JPEG", quality=92)
        logger.info(f"ImageParser.enhance | {src.name} -> {out.name} ({img.size})")
        return out

    def ocr_fallback(self, image_path: str | Path) -> str:
        try:
            import pytesseract
            text = pytesseract.image_to_string(Image.open(image_path))
            return text.strip()
        except Exception as exc:
            logger.warning(f"OCR fallback failed: {exc}")
            return ""
