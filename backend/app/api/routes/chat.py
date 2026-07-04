from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_services
from app.db.models import Conversation
from app.db.session import get_db
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationResponse,
    DeleteConversationResponse,
)
from app.services.container import ServiceContainer

router = APIRouter(prefix="/api", tags=["chat"])
DbSession = Annotated[Session, Depends(get_db)]
Services = Annotated[ServiceContainer, Depends(get_services)]


@router.post("/chat", response_model=ChatResponse)
def ask_question(
    payload: ChatRequest,
    db: DbSession,
    services: Services,
) -> ChatResponse:
    return services.rag.answer(db, payload)


@router.get("/conversations", response_model=list[ConversationResponse])
def list_conversations(db: DbSession, services: Services) -> list[Conversation]:
    return services.conversations.list_recent(db)


@router.delete(
    "/conversations/{conversation_id}", response_model=DeleteConversationResponse
)
def delete_conversation(
    conversation_id: int,
    db: DbSession,
    services: Services,
) -> DeleteConversationResponse:
    services.conversations.delete(db, conversation_id)
    return DeleteConversationResponse(id=conversation_id)
