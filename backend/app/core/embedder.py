from __future__ import annotations

from typing import Iterable, List

import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import get_settings


class Embedder:
    """Wrapper around a sentence-transformers model for embeddings."""

    def __init__(self) -> None:
        settings = get_settings()
        self._model = SentenceTransformer(settings.embeddings.model_name)
        self._batch_size = settings.embeddings.batch_size

    def embed(self, text: str) -> List[float]:
        """Embed a single text string into a vector."""

        embedding = self._model.encode(text, convert_to_numpy=True)
        return embedding.astype(np.float32).tolist()

    def embed_batch(self, texts: Iterable[str]) -> List[List[float]]:
        """Embed a batch of text strings into vectors."""

        embeddings = self._model.encode(
            list(texts),
            batch_size=self._batch_size,
            convert_to_numpy=True,
        )
        return embeddings.astype(np.float32).tolist()

