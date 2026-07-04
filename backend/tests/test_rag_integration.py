import fitz
from fastapi.testclient import TestClient
from langchain_core.embeddings import Embeddings
from langchain_core.messages import AIMessage

from app.main import app


class FakeEmbeddings(Embeddings):
    @staticmethod
    def embed_documents(texts: list[str]) -> list[list[float]]:
        return [
            [1.0, 0.0] if any(term in text.casefold() for term in ("diabetes", "thirst")) else [0.0, 1.0]
            for text in texts
        ]

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]


class FakeLLM:
    @staticmethod
    def invoke(_prompt_value: object) -> AIMessage:
        return AIMessage(
            content="The selected guideline lists increased thirst as a symptom [Source 1]."
        )


def _sample_pdf() -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text(
        (72, 72),
        "Diabetes guidance\nCommon symptoms include increased thirst and frequent urination.",
    )
    payload = document.tobytes()
    document.close()
    return payload


def test_upload_chat_citations_and_delete_flow() -> None:
    with TestClient(app) as client:
        services = app.state.services
        fake_embeddings = FakeEmbeddings()
        services.vector_store.embeddings = fake_embeddings
        services.rag.chat_model = FakeLLM()

        upload = client.post(
            "/api/documents/upload",
            files={"file": ("diabetes.pdf", _sample_pdf(), "application/pdf")},
        )
        assert upload.status_code == 201, upload.text
        document = upload.json()
        assert document["status"] == "indexed"
        assert document["chunk_count"] >= 1

        detail = client.get(f"/api/documents/{document['id']}")
        assert detail.status_code == 200
        assert detail.json()["chunks"][0]["page_number"] == 1

        chat = client.post(
            "/api/chat",
            json={
                "question": "Is increased thirst a diabetes symptom?",
                "document_ids": [document["id"]],
            },
        )
        assert chat.status_code == 200, chat.text
        payload = chat.json()
        assert payload["citations"]
        assert payload["citations"][0]["document_name"] == "diabetes.pdf"
        assert payload["citations"][0]["page_number"] == 1
        assert "not medical advice" in payload["answer"]

        deleted = client.delete(f"/api/documents/{document['id']}")
        assert deleted.status_code == 200
        assert services.vector_store.size == 0
