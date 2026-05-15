"""Theme registry — load any theme by name."""
from __future__ import annotations

from .midnight import THEME as MIDNIGHT
from .emerald import THEME as EMERALD
from .crimson import THEME as CRIMSON
from .slate import THEME as SLATE
from .amber import THEME as AMBER
from .ocean import THEME as OCEAN
from .violet import THEME as VIOLET
from .rose import THEME as ROSE
from .carbon import THEME as CARBON
from .arctic import THEME as ARCTIC

THEMES: dict[str, dict] = {
    "midnight": MIDNIGHT,
    "emerald": EMERALD,
    "crimson": CRIMSON,
    "slate": SLATE,
    "amber": AMBER,
    "ocean": OCEAN,
    "violet": VIOLET,
    "rose": ROSE,
    "carbon": CARBON,
    "arctic": ARCTIC,
}

DEFAULT_THEME = "midnight"


def get_theme(name: str | None) -> dict:
    return THEMES.get((name or DEFAULT_THEME).lower(), THEMES[DEFAULT_THEME])


def list_themes() -> list[str]:
    return list(THEMES.keys())
