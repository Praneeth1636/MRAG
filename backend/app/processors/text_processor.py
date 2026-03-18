from __future__ import annotations

from pathlib import Path
from typing import List

from app.processors.base import BaseProcessor, ProcessedChunk


class TextProcessor(BaseProcessor):
    """Processor for plain text-like files (.txt, .md, .csv)."""

    async def process(self, file_path: str) -> List[ProcessedChunk]:
        """Process text, markdown, or CSV files into processed chunks."""

        path = Path(file_path)
        suffix = path.suffix.lower()
        text = path.read_text(encoding="utf-8", errors="ignore")

        if suffix == ".csv":
            content = self._csv_to_natural_language(text)
            content_type = "table"
        else:
            content = text
            content_type = "text"

        return [
            ProcessedChunk(
                content=content,
                metadata={
                    "source_file": str(path.name),
                    "page_num": None,
                    "chunk_type": content_type,
                },
                content_type=content_type,
            ),
        ]

    def _csv_to_natural_language(self, csv_text: str) -> str:
        """Convert CSV text into a natural language description."""

        lines = [line for line in csv_text.splitlines() if line.strip()]
        if not lines:
            return ""

        headers = [h.strip() for h in lines[0].split(",")]
        rows = [line.split(",") for line in lines[1:]]
        description_lines = [
            f"The table contains {len(rows)} rows and {len(headers)} columns.",
            f"The columns are: {', '.join(headers)}.",
        ]

        preview_rows = rows[:3]
        for idx, row in enumerate(preview_rows):
            cells = ", ".join(f"{h}={v.strip()}" for h, v in zip(headers, row))
            description_lines.append(f"Row {idx + 1}: {cells}.")

        return "\n".join(description_lines)

