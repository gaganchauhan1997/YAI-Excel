"""
VideoParser — extract, dedupe, and prepare keyframes for vision audit.

Pipeline:
  1. Open video with OpenCV.
  2. Extract one frame every N seconds (default 2).
  3. Always include first / middle / last frame.
  4. Drop blurry frames (Laplacian variance < threshold).
  5. Dedupe near-identical frames via perceptual hash.
  6. Target output: 8–15 frames.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from loguru import logger


@dataclass
class VideoParser:
    storage_path: Path
    interval_sec: float = 2.0
    target_frames: int = 12
    blur_threshold: float = 60.0
    hash_distance: int = 5

    def extract_keyframes(self, video_path: str | Path) -> list[Path]:
        import cv2
        import imagehash
        from PIL import Image

        src = Path(video_path)
        cap = cv2.VideoCapture(str(src))
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video: {src}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration = total / fps if fps else 0
        logger.info(f"VideoParser | {src.name} | fps={fps:.1f} duration={duration:.1f}s")

        frames_dir = self.storage_path / f"frames_{src.stem}"
        frames_dir.mkdir(parents=True, exist_ok=True)

        sample_indices: list[int] = []
        # every interval_sec
        step = max(int(fps * self.interval_sec), 1)
        sample_indices.extend(range(0, total, step))
        # plus first / mid / last
        for special in [0, total // 2, max(total - 1, 0)]:
            if special not in sample_indices:
                sample_indices.append(special)
        sample_indices = sorted(set(sample_indices))

        kept: list[tuple[Path, "imagehash.ImageHash"]] = []
        for idx in sample_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            # Blur check
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            variance = cv2.Laplacian(gray, cv2.CV_64F).var()
            if variance < self.blur_threshold:
                continue
            # Save
            out = frames_dir / f"frame_{idx:06d}.jpg"
            cv2.imwrite(str(out), frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
            # Hash for dedupe
            phash = imagehash.phash(Image.open(out))
            if any((phash - h) < self.hash_distance for _, h in kept):
                out.unlink(missing_ok=True)
                continue
            kept.append((out, phash))

        cap.release()

        # Cap to target_frames by evenly sampling
        if len(kept) > self.target_frames:
            step = len(kept) / self.target_frames
            kept = [kept[int(i * step)] for i in range(self.target_frames)]

        result = [p for p, _ in kept]
        logger.info(f"VideoParser.extract_keyframes | kept {len(result)} unique frames")
        return result
