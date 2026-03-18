from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List


@dataclass
class ProcessedChunk:
    """Represents a processed piece of content extracted from a document."""

    content: str
    metadata: Dict[str, Any]
    content_type: str  # "text" | "image_caption" | "table"


class BaseProcessor(ABC):
    """Abstract base class for document processors."""

    @abstractmethod
    async def process(self, file_path: str) -> List[ProcessedChunk]:
        """Process the given file path into a list of processed chunks."""

        raise NotImplementedError

