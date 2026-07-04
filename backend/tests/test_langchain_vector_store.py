import json

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

from app.core.config import Settings
from app.db.models import DocumentChunk
from app.services.langchain_vector_store import LangChainFAISSVectorStore


class TopicEmbeddings(Embeddings):
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self.embed_query(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return [1.0, 0.0] if "diabetes" in text.casefold() else [0.0, 1.0]


def test_langchain_faiss_persists_and_filters_sqlite_metadata(tmp_path) -> None:
    settings = Settings(
        faiss_index_path=tmp_path / "faiss.index",
        faiss_metadata_path=tmp_path / "faiss_metadata.json",
    )
    embeddings = TopicEmbeddings()
    store = LangChainFAISSVectorStore(settings, embeddings=embeddings)
    documents = [
        Document(page_content="Diabetes symptoms include thirst.", metadata={}),
        Document(page_content="Cardiac risk factors are described.", metadata={}),
    ]
    chunks = [
        DocumentChunk(id=101, document_id=1, chunk_index=0, text=documents[0].page_content, page_number=2),
        DocumentChunk(id=202, document_id=2, chunk_index=0, text=documents[1].page_content, page_number=7),
    ]

    vector_ids = store.add_documents(documents, chunks)

    assert vector_ids == [0, 1]
    payload = json.loads(settings.faiss_metadata_path.read_text(encoding="utf-8"))
    assert payload["version"] == 2
    assert payload["documents"]["101"]["metadata"]["page_number"] == 2

    reloaded = LangChainFAISSVectorStore(settings, embeddings=embeddings)
    results = reloaded.search(
        "diabetes",
        {1},
        top_k=5,
        score_threshold=0.2,
    )

    assert len(results) == 1
    assert results[0].document.metadata["chunk_id"] == 101
    assert results[0].document.metadata["document_id"] == 1
    assert results[0].score == 1.0

