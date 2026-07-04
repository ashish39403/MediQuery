from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.db.models import Conversation


class ConversationService:
    """Conversation lifecycle operations kept outside HTTP route handlers."""

    @staticmethod
    def list_recent(db: Session, limit: int = 50) -> list[Conversation]:
        return list(
            db.scalars(
                select(Conversation).order_by(Conversation.created_at.desc()).limit(limit)
            ).all()
        )

    @staticmethod
    def delete(db: Session, conversation_id: int) -> None:
        conversation = db.get(Conversation, conversation_id)
        if conversation is None:
            raise NotFoundError("Conversation not found.")
        db.delete(conversation)
        db.commit()

