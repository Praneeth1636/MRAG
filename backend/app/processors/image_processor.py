from __future__ import annotations

from pathlib import Path
from typing import List

import httpx

from app.config import get_settings
from app.processors.base import BaseProcessor, ProcessedChunk


class ImageProcessor(BaseProcessor):
    """Processor for image files using LLaVA via Ollama."""

    async def process(self, file_path: str) -> List[ProcessedChunk]:
        """Generate a detailed caption for an image using LLaVA."""

        path = Path(file_path)
        settings = get_settings().ollama
        base_url = settings.base_url.rstrip("/")

        prompt = (
            "Describe this image in detail, including any text, diagrams, charts, "
            "or data visible."
        )

        # Ollama's image API expects base64 or path; here we send the file path.
        payload = {
            "model": settings.image_model,
            "prompt": prompt,
            "images": [str(path)],
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(f"{base_url}/api/generate", json=payload)
        response.raise_for_status()
        data = response.json()
        caption = str(data.get("response", "")).strip()

        return [
            ProcessedChunk(
                content=caption,
                metadata={
                    "source_file": str(path.name),
                    "page_num": None,
                    "chunk_type": "image_caption",
                },
                content_type="image_caption",
            ),
        ]

