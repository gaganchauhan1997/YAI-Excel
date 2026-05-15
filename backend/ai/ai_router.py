"""
AI Router — rotating free-tier API pool.

Priority order:
    1. Gemini (vision-capable, generous free tier)
    2. Groq (text-only, ultra-fast)
    3. OpenAI GPT-4o-mini (vision capable, paid fallback)
    4. Anthropic Claude Sonnet (vision capable, paid fallback)

Every call retries with exponential backoff and rotates on rate-limit / 5xx.
This embodies Hackknow's principle: free intelligence, infinite capability.
"""
from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

try:
    import google.generativeai as genai
except Exception:  # pragma: no cover - optional dep
    genai = None

try:
    from groq import Groq
except Exception:  # pragma: no cover
    Groq = None

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None

try:
    from anthropic import Anthropic
except Exception:  # pragma: no cover
    Anthropic = None


@dataclass
class Provider:
    name: str
    available: bool
    handler: Any
    supports_vision: bool = False
    model: str = ""


@dataclass
class AIRouter:
    """Multi-provider rotating router with automatic fallback."""

    providers: list[Provider] = field(default_factory=list)

    def __post_init__(self) -> None:
        self._init_gemini()
        self._init_groq()
        self._init_openai()
        self._init_anthropic()
        available = [p.name for p in self.providers if p.available]
        logger.info(f"AIRouter ready | providers={available or ['NONE — set keys in .env']}")

    # ------------------------------------------------------------------
    # Provider init
    # ------------------------------------------------------------------
    def _init_gemini(self) -> None:
        key = os.getenv("GEMINI_API_KEY")
        if key and genai is not None:
            genai.configure(api_key=key)
            handler = genai.GenerativeModel(os.getenv("VISION_MODEL", "gemini-2.5-flash"))
            self.providers.append(
                Provider("gemini", True, handler, supports_vision=True, model=os.getenv("VISION_MODEL", "gemini-2.5-flash"))
            )

    def _init_groq(self) -> None:
        key = os.getenv("GROQ_API_KEY")
        if key and Groq is not None:
            self.providers.append(
                Provider("groq", True, Groq(api_key=key), supports_vision=False, model="llama-3.1-70b-versatile")
            )

    def _init_openai(self) -> None:
        key = os.getenv("OPENAI_API_KEY")
        if key and OpenAI is not None:
            self.providers.append(
                Provider("openai", True, OpenAI(api_key=key), supports_vision=True, model="gpt-4o-mini")
            )

    def _init_anthropic(self) -> None:
        key = os.getenv("ANTHROPIC_API_KEY")
        if key and Anthropic is not None:
            self.providers.append(
                Provider("anthropic", True, Anthropic(api_key=key), supports_vision=True, model="claude-3-5-sonnet-20241022")
            )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def has_vision(self) -> bool:
        return any(p.supports_vision and p.available for p in self.providers)

    def has_any(self) -> bool:
        return any(p.available for p in self.providers)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1.5, min=1, max=15))
    def text(self, prompt: str, system: str | None = None) -> str:
        """Send a text-only prompt. Rotates through providers on failure."""
        last_err: Exception | None = None
        for p in self.providers:
            if not p.available:
                continue
            try:
                return self._dispatch_text(p, prompt, system)
            except Exception as exc:  # rate-limit, network, parse
                logger.warning(f"{p.name} text failed: {exc}")
                last_err = exc
                continue
        if last_err:
            raise last_err
        raise RuntimeError("No AI provider available. Set GEMINI_API_KEY or another key in .env.")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1.5, min=1, max=15))
    def vision(self, image_paths: Iterable[str | Path], prompt: str) -> str:
        """Send images + prompt. Only providers with supports_vision are used."""
        paths = [Path(p) for p in image_paths]
        last_err: Exception | None = None
        for p in self.providers:
            if not (p.available and p.supports_vision):
                continue
            try:
                return self._dispatch_vision(p, paths, prompt)
            except Exception as exc:
                logger.warning(f"{p.name} vision failed: {exc}")
                last_err = exc
                continue
        if last_err:
            raise last_err
        raise RuntimeError("No vision-capable provider available.")

    def json(self, prompt: str, system: str | None = None) -> dict:
        """Send a prompt and expect strict JSON back."""
        raw = self.text(prompt, system=system)
        return self._extract_json(raw)

    def vision_json(self, image_paths: Iterable[str | Path], prompt: str) -> dict:
        raw = self.vision(image_paths, prompt)
        return self._extract_json(raw)

    # ------------------------------------------------------------------
    # Dispatchers
    # ------------------------------------------------------------------
    def _dispatch_text(self, p: Provider, prompt: str, system: str | None) -> str:
        if p.name == "gemini":
            payload = (system + "\n\n" + prompt) if system else prompt
            resp = p.handler.generate_content(payload)
            return resp.text or ""
        if p.name == "groq":
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            resp = p.handler.chat.completions.create(model=p.model, messages=messages)
            return resp.choices[0].message.content or ""
        if p.name == "openai":
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})
            resp = p.handler.chat.completions.create(model=p.model, messages=messages)
            return resp.choices[0].message.content or ""
        if p.name == "anthropic":
            kwargs: dict[str, Any] = dict(model=p.model, max_tokens=4096, messages=[{"role": "user", "content": prompt}])
            if system:
                kwargs["system"] = system
            resp = p.handler.messages.create(**kwargs)
            return resp.content[0].text if resp.content else ""
        raise RuntimeError(f"Unknown provider {p.name}")

    def _dispatch_vision(self, p: Provider, paths: list[Path], prompt: str) -> str:
        if p.name == "gemini":
            from PIL import Image
            images = [Image.open(path) for path in paths]
            resp = p.handler.generate_content([prompt, *images])
            return resp.text or ""
        if p.name == "openai":
            content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
            for path in paths:
                b64 = base64.b64encode(path.read_bytes()).decode()
                content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
            resp = p.handler.chat.completions.create(
                model=p.model,
                messages=[{"role": "user", "content": content}],
            )
            return resp.choices[0].message.content or ""
        if p.name == "anthropic":
            content: list[dict[str, Any]] = []
            for path in paths:
                b64 = base64.b64encode(path.read_bytes()).decode()
                content.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
                })
            content.append({"type": "text", "text": prompt})
            resp = p.handler.messages.create(
                model=p.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": content}],
            )
            return resp.content[0].text if resp.content else ""
        raise RuntimeError(f"Vision unsupported on {p.name}")

    # ------------------------------------------------------------------
    # JSON parsing — tolerant of markdown fences
    # ------------------------------------------------------------------
    @staticmethod
    def _extract_json(raw: str) -> dict:
        text = (raw or "").strip()
        if not text:
            return {}
        # strip ```json fences
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
            text = text.strip("`").strip()
        # find first { ... last }
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            return {"_raw": raw}
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            logger.warning(f"JSON parse failed: {exc}")
            return {"_raw": raw}
