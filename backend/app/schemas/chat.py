from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=4_000)
    document_ids: list[int] = Field(min_length=1)
    conversation_id: int | None = None

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        clean = " ".join(value.split())
        if not clean:
            raise ValueError("Question cannot be empty.")
        return clean

    @field_validator("document_ids")
    @classmethod
    def unique_document_ids(cls, value: list[int]) -> list[int]:
        return list(dict.fromkeys(value))


class CitationResponse(BaseModel):
    document_id: int
    document_name: str
    page_number: int | None
    chunk_index: int
    chunk_text: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    conversation_id: int
    citations: list[CitationResponse]
    safety_notice: str


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime


class DeleteConversationResponse(BaseModel):
    id: int
    deleted: bool = True
