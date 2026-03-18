from __future__ import annotations

from pathlib import Path
from typing import Dict, Iterable, List

import chromadb

from app.core.chunker import Chunker, ChunkedDocument
from app.core.embedder import Embedder
from app.core.retriever import get_chroma_client
from app.processors.base import BaseProcessor, ProcessedChunk
from app.processors.image_processor import ImageProcessor
from app.processors.pdf_processor import PDFProcessor
from app.processors.text_processor import TextProcessor


class DocumentProcessor:
    """High-level pipeline to process, chunk, embed, and store documents."""

    def __init__(self, client: chromadb.ClientAPI | None = None) -> None:
        self._client = client or get_chroma_client()
        self._chunker = Chunker()
        self._embedder = Embedder()
        self._processors: Dict[str, BaseProcessor] = {
            ".pdf": PDFProcessor(),
            ".png": ImageProcessor(),
            ".jpg": ImageProcessor(),
            ".jpeg": ImageProcessor(),
            ".webp": ImageProcessor(),
            ".txt": TextProcessor(),
            ".md": TextProcessor(),
            ".csv": TextProcessor(),
        }

    def _get_processor(self, suffix: str) -> BaseProcessor:
        if suffix.lower() not in self._processors:
            raise ValueError(f"Unsupported file type: {suffix}")
        return self._processors[suffix.lower()]

    async def ingest_files(
        self,
        file_paths: Iterable[str],
        collection_name: str,
    ) -> int:
        """Ingest a list of files into the specified Chroma collection.

        Returns:
            Total number of chunks stored.
        """

        collection = self._client.get_or_create_collection(name=collection_name)
        total_chunks = 0

        for file_path in file_paths:
            total_chunks += await self._ingest_single(file_path, collection)

        return total_chunks

    async def _ingest_single(
        self,
        file_path: str,
        collection: chromadb.Collection,
    ) -> int:
        path = Path(file_path)
        processor = self._get_processor(path.suffix)

        processed: List[ProcessedChunk] = await processor.process(str(path))
        chunked: List[ChunkedDocument] = self._chunker.chunk_processed(processed)

        if not chunked:
            return 0

        embeddings = self._embedder.embed_batch([c.content for c in chunked])

        collection.add(
            ids=[c.id for c in chunked],
            documents=[c.content for c in chunked],
            metadatas=[c.metadata for c in chunked],
            embeddings=embeddings,
        )

        return len(chunked)
