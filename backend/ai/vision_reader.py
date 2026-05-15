"""
VisionReader — runs the master audit prompt against any visual input.

Inputs: image path, list of image paths (video frames, multi-page PDF).
Output: structured audit JSON.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from loguru import logger

from .ai_router import AIRouter
from .audit_prompts import MASTER_AUDIT_PROMPT


@dataclass
class VisionReader:
    router: AIRouter

    def audit_image(self, image_path: str | Path) -> dict:
        path = Path(image_path)
        logger.info(f"VisionReader.audit_image | {path.name}")
        return self.router.vision_json([path], MASTER_AUDIT_PROMPT)

    def audit_frames(self, frames: Iterable[str | Path]) -> list[dict]:
        frames = list(frames)
        logger.info(f"VisionReader.audit_frames | {len(frames)} frames")
        results: list[dict] = []
        for idx, frame in enumerate(frames):
            try:
                results.append(self.router.vision_json([frame], MASTER_AUDIT_PROMPT))
            except Exception as exc:
                logger.warning(f"frame {idx} failed: {exc}")
        return results
