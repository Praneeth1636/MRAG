from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Sequence, Tuple

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.config import get_settings
from app.processors.base import ProcessedChunk


@dataclass
class ChunkedDocument:
    """Represents a chunked document ready for embedding."""

    id: str
    content: str
    metadata: Dict[str, Any]


class Chunker:
    """Implements hybrid semantic + recursive character chunking."""

    def __init__(self) -> None:
        settings = get_settings().chunking
        self._similarity_threshold = settings.semantic_similarity_threshold
        self._max_tokens = settings.max_tokens
        self._overlap_ratio = settings.overlap_ratio

    def _sentence_tokenize(self, text: str) -> List[str]:
        """Naive sentence tokenizer; can be improved later."""

        # Simple split on period/question/exclamation followed by space.
        sentences: List[str] = []
        buffer = ""
        for ch in text:
            buffer += ch
            if ch in {".", "?", "!"}:
                if buffer.strip():
                    sentences.append(buffer.strip())
                buffer = ""
        if buffer.strip():
            sentences.append(buffer.strip())
        return sentences

    def _semantic_groups(
        self,
        sentences: Sequence[str],
        sentence_embeddings: np.ndarray,
    ) -> List[List[str]]:
        """Group consecutive sentences based on cosine similarity threshold."""

        if not sentences:
            return []

        groups: List[List[str]] = []
        current_group: List[str] = [sentences[0]]

        for idx in range(1, len(sentences)):
            prev_emb = sentence_embeddings[idx - 1 : idx]
            curr_emb = sentence_embeddings[idx : idx + 1]
            sim = float(cosine_similarity(prev_emb, curr_emb)[0][0])
            if sim >= self._similarity_threshold:
                current_group.append(sentences[idx])
            else:
                groups.append(current_group)
                current_group = [sentences[idx]]
        if current_group:
            groups.append(current_group)
        return groups

    def _approx_token_length(self, text: str) -> int:
        """Approximate token length by whitespace splitting."""

        return len(text.split())

    def _recursive_split(self, text: str) -> List[str]:
        """Recursively split text to respect max token limit."""

        if self._approx_token_length(text) <= self._max_tokens:
            return [text]

        for sep in ["\n\n", "\n", ". ", " "]:
            if sep in text:
                parts = text.split(sep)
                chunks: List[str] = []
                buffer = ""
                for part in parts:
                    candidate = (buffer + sep + part) if buffer else part
                    if self._approx_token_length(candidate) > self._max_tokens:
                        if buffer:
                            chunks.append(buffer.strip())
                        buffer = part
                    else:
                        buffer = candidate
                if buffer.strip():
                    chunks.append(buffer.strip())
                # If we still have chunks that are too large, recurse further.
                final_chunks: List[str] = []
                for c in chunks:
                    if self._approx_token_length(c) > self._max_tokens:
                        final_chunks.extend(self._recursive_split(c))
                    else:
                        final_chunks.append(c)
                return final_chunks

        # Fallback, split blindly by words.
        words = text.split()
        chunks = [
            " ".join(words[i : i + self._max_tokens])
            for i in range(0, len(words), self._max_tokens)
        ]
        return chunks

    def _apply_overlap(self, chunks: List[str]) -> List[str]:
        """Apply fixed-ratio overlap between chunks."""

        if not chunks or self._overlap_ratio <= 0:
            return chunks

        overlapped: List[str] = []
        overlap_tokens = int(self._max_tokens * self._overlap_ratio)

        for idx, chunk in enumerate(chunks):
            if idx == 0:
                overlapped.append(chunk)
                continue

            prev = overlapped[-1]
            prev_tokens = prev.split()
            current_tokens = chunk.split()
            prefix = prev_tokens[-overlap_tokens:] if overlap_tokens < len(prev_tokens) else prev_tokens
            merged = " ".join(prefix + current_tokens)
            overlapped.append(merged)

        return overlapped

    def chunk_processed(
        self,
        processed_chunks: Iterable[ProcessedChunk],
        sentence_embeddings: Iterable[np.ndarray] | None = None,
    ) -> List[ChunkedDocument]:
        """Chunk a sequence of processed chunks into ChunkedDocument instances.

        Args:
            processed_chunks: Iterable of processed chunks from processors.
            sentence_embeddings: Optional precomputed sentence embeddings. If
                provided, it must match the flattened list of sentences.

        Returns:
            List of ChunkedDocument instances ready for embedding.
        """

        documents: List[ChunkedDocument] = []
        sent_emb_list: List[np.ndarray] = list(sentence_embeddings or [])
        emb_index = 0

        for base_index, processed in enumerate(processed_chunks):
            sentences = self._sentence_tokenize(processed.content)
            if not sentences:
                continue

            if sent_emb_list:
                needed = len(sentences)
                emb_slice = np.vstack(sent_emb_list[emb_index : emb_index + needed])
                emb_index += needed
            else:
                # If no embeddings provided, approximate with identity-like vectors.
                emb_slice = np.eye(len(sentences), dtype=np.float32)

            groups = self._semantic_groups(sentences, emb_slice)
            for group_index, group in enumerate(groups):
                group_text = " ".join(group)
                split_chunks = self._recursive_split(group_text)
                split_chunks = self._apply_overlap(split_chunks)

                for local_idx, chunk_text in enumerate(split_chunks):
                    doc_id = f"{processed.metadata.get('source_file','unknown')}_chunk_{base_index}_{group_index}_{local_idx}"
                    metadata: Dict[str, Any] = {
                        **processed.metadata,
                        "chunk_index": local_idx,
                        "base_index": base_index,
                        "group_index": group_index,
                    }
                    documents.append(
                        ChunkedDocument(
                            id=doc_id,
                            content=chunk_text,
                            metadata=metadata,
                        ),
                    )

        return documents

