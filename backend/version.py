"""Project version + build metadata. Bumped on every release."""
from __future__ import annotations

import os

VERSION = "1.2.0"
BUILD_DATE = "2026-05-15"
GIT_SHA = os.getenv("GIT_SHA", "local")


def build_info() -> dict:
    return {
        "name": "YAI-Excel",
        "version": VERSION,
        "build_date": BUILD_DATE,
        "git_sha": GIT_SHA,
        "ecosystem": "YAHAVIS AI",
        "vendor": "Hackknow",
    }
