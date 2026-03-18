from __future__ import annotations

from pathlib import Path
from typing import List

import base64
import fitz  # PyMuPDF
import httpx
import pytesseract
from PIL import Image

from app.config import get_settings
from app.processors.base import BaseProcessor, ProcessedChunk


class PDFProcessor(BaseProcessor):
    """Processor for PDF documents including text, images, and tables."""

    async def process(self, file_path: str) -> List[ProcessedChunk]:
        """Process a PDF file into text, image captions, and table-like chunks."""

        path = Path(file_path)
        chunks: List[ProcessedChunk] = []

        doc = fitz.open(str(path))
        has_text = False

        for page_index in range(len(doc)):
            page = doc.load_page(page_index)
            text = page.get_text("text")
            page_num = page_index + 1

            if text.strip():
                has_text = True
                text_chunks = self._split_text_blocks(text)
                for block_index, block in enumerate(text_chunks):
                    content_type = "table" if self._looks_like_table(block) else "text"
                    chunks.append(
                        ProcessedChunk(
                            content=block,
                            metadata={
                                "source_file": str(path.name),
                                "page_num": page_num,
                                "chunk_type": content_type,
                            },
                            content_type=content_type,
                        ),
                    )

            # Extract embedded images for captioning.
            for image_index, image_info in enumerate(page.get_images(full=True)):
                xref = image_info[0]
                pix = fitz.Pixmap(doc, xref)
                if pix.n >= 5:  # CMYK
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                image_path = path.with_suffix(f".page{page_num}_img{image_index}.png")
                pix.save(str(image_path))
                caption = await self._caption_image(str(image_path))
                chunks.append(
                    ProcessedChunk(
                        content=caption,
                        metadata={
                            "source_file": str(path.name),
                            "page_num": page_num,
                            "chunk_type": "image_caption",
                        },
                        content_type="image_caption",
                    ),
                )
                try:
                    image_path.unlink()
                except OSError:
                    pass

        # Fallback to OCR if no extractable text.
        if not has_text:
            ocr_text = await self._ocr_pdf(path)
            chunks.append(
                ProcessedChunk(
                    content=ocr_text,
                    metadata={
                        "source_file": str(path.name),
                        "page_num": None,
                        "chunk_type": "text",
                    },
                    content_type="text",
                ),
            )

        return chunks

    def _split_text_blocks(self, text: str) -> List[str]:
        """Split page text into logical blocks."""

        blocks = [block.strip() for block in text.split("\n\n") if block.strip()]
        return blocks or [text]

    def _looks_like_table(self, block: str) -> bool:
        """Heuristic to detect table-like structures."""

        lines = block.splitlines()
        if len(lines) < 2:
            return False
        separators = sum(1 for line in lines if "," in line or "\t" in line or "|" in line)
        return separators >= max(2, len(lines) // 3)

    async def _caption_image(self, image_path: str) -> str:
        """Call LLaVA via Ollama to caption an image."""

        settings = get_settings().ollama
        base_url = settings.base_url.rstrip("/")
        prompt = (
            "Describe this image in detail, including any text, diagrams, charts, "
            "or data visible."
        )
        image_bytes = Path(image_path).read_bytes()
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "model": settings.image_model,
            "prompt": prompt,
            "images": [image_b64],
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(f"{base_url}/api/generate", json=payload)
        response.raise_for_status()
        data = response.json()
        return str(data.get("response", "")).strip()

    async def _ocr_pdf(self, path: Path) -> str:
        """Perform OCR on each page of a scanned PDF."""

        doc = fitz.open(str(path))
        texts: List[str] = []
        for page_index in range(len(doc)):
            page = doc.load_page(page_index)
            pix = page.get_pixmap()
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            text = pytesseract.image_to_string(image)
            if text.strip():
                texts.append(text.strip())
        return "\n\n".join(texts)

