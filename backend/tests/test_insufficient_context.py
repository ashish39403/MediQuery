from fastapi.testclient import TestClient

from app.main import app
from app.services.langchain_rag_service import INSUFFICIENT_CONTEXT


def test_chat_returns_grounded_fallback_without_documents() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/chat",
            json={
                "question": "What are the symptoms of diabetes?",
                "document_ids": [999],
                "conversation_id": None,
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert INSUFFICIENT_CONTEXT in payload["answer"]
    assert payload["citations"] == []
    assert payload["conversation_id"] > 0
    assert "not medical advice" in payload["safety_notice"]
