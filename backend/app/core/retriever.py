from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import chromadb
from chromadb import Collection

from app.config import get_settings
from app.core.embedder import Embedder


@dataclass
class RetrievedChunk:
    """Represents a retrieved chunk with a relevance score."""

    id: str
    content: str
    metadata: Dict[str, Any]
    score: float


class Retriever:
    """Performs dense (and optional hybrid) retrieval with re-ranking."""

    def __init__(self, collection: Collection, embedder: Embedder) -> None:
        self.collection = collection
        self.embedder = embedder
        self._settings = get_settings().retrieval

    async def retrieve(
        self,
        query: str,
        top_k: int | None = None,
        final_k: int | None = None,
        where: Optional[Dict[str, Any]] = None,
    ) -> List[RetrievedChunk]:
        """Retrieve relevant chunks for a query with optional metadata filters."""

        top_k = top_k or self._settings.top_k
        final_k = final_k or self._settings.final_k

        query_embedding = self.embedder.embed(query)

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where,
        )

        ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0] or results.get("embeddings", [[]])[0]

        retrieved: List[RetrievedChunk] = []
        for idx, doc_id in enumerate(ids):
            distance = distances[idx] if idx < len(distances) else 0.0
            score = float(1.0 / (1.0 + distance)) if isinstance(distance, (int, float)) else 0.0
            retrieved.append(
                RetrievedChunk(
                    id=str(doc_id),
                    content=str(documents[idx]),
                    metadata=metadatas[idx] or {},
                    score=score,
                ),
            )

        # Simple score-based re-ranking (placeholder for cross-encoder).
        retrieved.sort(key=lambda x: x.score, reverse=True)

        return retrieved[:final_k]


def get_chroma_client() -> chromadb.ClientAPI:
    """Return a configured Chroma client."""

    settings = get_settings().chroma
    client = chromadb.PersistentClient(path=settings.persist_directory)
    return client

