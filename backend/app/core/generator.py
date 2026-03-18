from __future__ import annotations

from typing import Any, AsyncGenerator, Dict, Optional

import httpx
import json

from app.config import get_settings


class GenerationError(Exception):
    """Raised when generation via Ollama fails."""


class Generator:
    """Wrapper for calling Ollama chat/generation APIs."""

    def __init__(self, client: Optional[httpx.AsyncClient] = None) -> None:
        settings = get_settings().ollama
        self._base_url = settings.base_url.rstrip("/")
        self._default_model = settings.chat_model
        self._client = client

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> str:
        """Generate a response from the Ollama model."""

        payload: Dict[str, Any] = {
            "model": model or self._default_model,
            "prompt": prompt,
            "options": {
                "temperature": temperature,
            },
        }

        if self._client is not None:
            response = await self._client.post("/api/generate", json=payload)
        else:
            async with httpx.AsyncClient(base_url=self._base_url, timeout=60.0) as client:
                response = await client.post("/api/generate", json=payload)

        if response.status_code != 200:
            raise GenerationError(f"Ollama generation failed: {response.text}")

        # Streaming API returns multiple lines; here we assume non-streaming.
        data = response.json()
        return str(data.get("response", ""))

    async def stream(
        self,
        prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.2,
    ) -> AsyncGenerator[str, None]:
        """Yield tokens one by one from the Ollama streaming API."""

        if self._client is None:
            # Fallback: emulate streaming by calling generate once.
            text = await self.generate(prompt, model=model, temperature=temperature)
            for token in text.split():
                yield token + " "
            return

        payload: Dict[str, Any] = {
            "model": model or self._default_model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": temperature,
            },
        }

        async with self._client.stream("POST", "/api/generate", json=payload) as response:
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                token = data.get("response", "")
                if token:
                    yield str(token)
                if data.get("done"):
                    break


