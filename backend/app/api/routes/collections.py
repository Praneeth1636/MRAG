from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.api.deps import get_chroma
from app.api.exceptions import CollectionNotFoundError
from app.models.schemas import CollectionInfo, CollectionListResponse
import chromadb

router = APIRouter()


@router.get("/collections", response_model=CollectionListResponse)
async def list_collections(chroma: chromadb.ClientAPI = Depends(get_chroma)) -> CollectionListResponse:
    """List all collections with document counts."""

    collections = chroma.list_collections()
    infos: list[CollectionInfo] = []
    for col in collections:
        collection = chroma.get_collection(col.name)
        infos.append(
            CollectionInfo(
                name=col.name,
                document_count=collection.count(),
                metadata=col.metadata,
            ),
        )
    return CollectionListResponse(collections=infos)


@router.delete("/collections/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(name: str, chroma: chromadb.ClientAPI = Depends(get_chroma)) -> None:
    """Delete a collection and all associated documents."""

    try:
        chroma.delete_collection(name)
    except Exception:
        raise CollectionNotFoundError(name)

