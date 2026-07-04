from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import DocumentStatus


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    original_filename: str
    status: DocumentStatus
    chunk_count: int
    created_at: datetime
    updated_at: datetime
    error_message: str | None = None


class ChunkSummary(BaseModel):
    chunk_index: int
    page_number: int | None
    preview: str


class DocumentDetail(DocumentResponse):
    chunks: list[ChunkSummary]


class DeleteResponse(BaseModel):
    id: int
    deleted: bool = True


class DashboardStats(BaseModel):
    total_documents: int
    indexed_chunks: int
    conversations: int
    average_response_time: float = 0.0

