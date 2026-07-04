from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_services
from app.db.models import Conversation, Document, DocumentChunk
from app.db.session import get_db
from app.schemas.document import (
    ChunkSummary,
    DashboardStats,
    DeleteResponse,
    DocumentDetail,
    DocumentResponse,
)
from app.services.container import ServiceContainer

router = APIRouter(prefix="/api", tags=["documents"])
DbSession = Annotated[Session, Depends(get_db)]
Services = Annotated[ServiceContainer, Depends(get_services)]


@router.post(
    "/documents/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    db: DbSession,
    services: Services,
    file: Annotated[UploadFile, File(description="A PDF document, maximum 50 MB")],
) -> Document:
    return await services.documents.ingest(db, file)


@router.get("/documents", response_model=list[DocumentResponse])
def list_documents(db: DbSession, services: Services) -> list[Document]:
    return services.documents.list_documents(db)


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def get_document(document_id: int, db: DbSession, services: Services) -> DocumentDetail:
    document = services.documents.get_document(db, document_id)
    return DocumentDetail(
        **DocumentResponse.model_validate(document).model_dump(),
        chunks=[
            ChunkSummary(
                chunk_index=chunk.chunk_index,
                page_number=chunk.page_number,
                preview=chunk.text[:240],
            )
            for chunk in sorted(document.chunks, key=lambda item: item.chunk_index)
        ],
    )


@router.delete("/documents/{document_id}", response_model=DeleteResponse)
def delete_document(document_id: int, db: DbSession, services: Services) -> DeleteResponse:
    services.documents.delete_document(db, document_id)
    return DeleteResponse(id=document_id)


@router.get("/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(db: DbSession) -> DashboardStats:
    return DashboardStats(
        total_documents=db.scalar(select(func.count(Document.id))) or 0,
        indexed_chunks=db.scalar(select(func.count(DocumentChunk.id))) or 0,
        conversations=db.scalar(select(func.count(Conversation.id))) or 0,
        average_response_time=0.0,
    )

