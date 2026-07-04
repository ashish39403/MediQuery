from dataclasses import dataclass

from app.core.config import Settings
from app.services.conversation_service import ConversationService
from app.services.document_service import DocumentService
from app.services.langchain_chunker import LangChainChunker
from app.services.langchain_loader import LangChainPDFLoader
from app.services.langchain_rag_service import LangChainRAGService
from app.services.langchain_vector_store import LangChainFAISSVectorStore
from app.storage.file_storage import FileStorage


@dataclass
class ServiceContainer:
    settings: Settings
    file_storage: FileStorage
    loader: LangChainPDFLoader
    chunker: LangChainChunker
    vector_store: LangChainFAISSVectorStore
    conversations: ConversationService
    documents: DocumentService
    rag: LangChainRAGService


def build_container(settings: Settings) -> ServiceContainer:
    file_storage = FileStorage(settings)
    loader = LangChainPDFLoader()
    chunker = LangChainChunker(settings.chunk_size, settings.chunk_overlap)
    vector_store = LangChainFAISSVectorStore(settings)
    conversations = ConversationService()
    documents = DocumentService(file_storage, loader, chunker, vector_store)
    rag = LangChainRAGService(settings, vector_store)
    return ServiceContainer(
        settings,
        file_storage,
        loader,
        chunker,
        vector_store,
        conversations,
        documents,
        rag,
    )
