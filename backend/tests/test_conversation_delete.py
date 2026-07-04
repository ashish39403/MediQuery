from sqlalchemy import func, select

from fastapi.testclient import TestClient

from app.db.models import Message
from app.db.session import SessionLocal
from app.main import app


def test_delete_conversation_removes_chat_and_messages() -> None:
    with TestClient(app) as client:
        chat_response = client.post(
            "/api/chat",
            json={
                "question": "What does the selected document say?",
                "document_ids": [999_999],
                "conversation_id": None,
            },
        )
        assert chat_response.status_code == 200
        conversation_id = chat_response.json()["conversation_id"]

        conversations = client.get("/api/conversations")
        assert conversations.status_code == 200
        assert conversation_id in {item["id"] for item in conversations.json()}

        with SessionLocal() as db:
            message_count = db.scalar(
                select(func.count(Message.id)).where(
                    Message.conversation_id == conversation_id
                )
            )
        assert message_count == 2

        deleted = client.delete(f"/api/conversations/{conversation_id}")
        assert deleted.status_code == 200
        assert deleted.json() == {"id": conversation_id, "deleted": True}

        conversations = client.get("/api/conversations")
        assert conversation_id not in {item["id"] for item in conversations.json()}

        with SessionLocal() as db:
            remaining_messages = db.scalar(
                select(func.count(Message.id)).where(
                    Message.conversation_id == conversation_id
                )
            )
        assert remaining_messages == 0

        missing = client.delete(f"/api/conversations/{conversation_id}")
        assert missing.status_code == 404
        assert missing.json()["detail"] == "Conversation not found."
