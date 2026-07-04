import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from typing import Any

import faiss
import numpy as np
from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_community.vectorstores import FAISS
from langchain_community.vectorstores.utils import DistanceStrategy
from langchain_core.documents import Document as LangChainDocument
from langchain_core.embeddings import Embeddings
from langchain_openai import OpenAIEmbeddings

from app.core.config import Settings
from app.core.errors import ConfigurationError, ExternalServiceError, ValidationError
from app.db.models import DocumentChunk

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LangChainSearchResult:
    document: LangChainDocument
    score: float


class ConfiguredOpenAIEmbeddings(Embeddings):
    """Lazy OpenAI-compatible LangChain embeddings client."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: OpenAIEmbeddings | None = None

    @property
    def client(self) -> OpenAIEmbeddings:
        if not self.settings.openai_api_key or not self.settings.embedding_model:
            raise ConfigurationError(
                "OPENAI_API_KEY and EMBEDDING_MODEL must be configured before indexing."
            )
        if self._client is None:
            self._client = OpenAIEmbeddings(
                model=self.settings.embedding_model,
                api_key=self.settings.openai_api_key,
                base_url=self.settings.openai_base_url,
                chunk_size=64,
                check_embedding_ctx_length=False,
            )
        return self._client

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        try:
            return self.client.embed_documents(texts)
        except ConfigurationError:
            raise
        except Exception as exc:
            logger.exception("LangChain embedding request failed")
            raise ExternalServiceError("The embedding provider request failed.") from exc

    def embed_query(self, text: str) -> list[float]:
        try:
            return self.client.embed_query(text)
        except ConfigurationError:
            raise
        except Exception as exc:
            logger.exception("LangChain query embedding request failed")
            raise ExternalServiceError("The embedding provider request failed.") from exc


class LangChainFAISSVectorStore:
    """LangChain FAISS with safe JSON docstore persistence and SQLite IDs in metadata."""

    def __init__(self, settings: Settings, embeddings: Embeddings | None = None) -> None:
        self.index_path = settings.faiss_index_path
        self.metadata_path = settings.faiss_metadata_path
        self.embeddings = embeddings or ConfiguredOpenAIEmbeddings(settings)
        self._store: FAISS | None = None
        self._legacy_index: faiss.Index | None = None
        self._legacy_mapping: list[int] = []
        self._lock = RLock()
        self._load()

    @property
    def size(self) -> int:
        return int(self._store.index.ntotal) if self._store is not None else 0

    @property
    def migration_required(self) -> bool:
        return self._legacy_index is not None

    def add_documents(
        self,
        documents: list[LangChainDocument],
        chunks: list[DocumentChunk],
    ) -> list[int]:
        if len(documents) != len(chunks):
            raise ValidationError("LangChain document and SQLite chunk counts do not match.")
        if not documents:
            return []
        ids = [str(chunk.id) for chunk in chunks]
        for document, chunk in zip(documents, chunks, strict=True):
            document.metadata.update(
                {
                    "chunk_id": chunk.id,
                    "document_id": chunk.document_id,
                    "page_number": chunk.page_number,
                    "chunk_index": chunk.chunk_index,
                }
            )

        try:
            with self._lock:
                if self._store is None:
                    self._store = FAISS.from_documents(
                        documents,
                        self.embeddings,
                        ids=ids,
                        normalize_L2=True,
                        distance_strategy=DistanceStrategy.EUCLIDEAN_DISTANCE,
                    )
                else:
                    self._store.add_documents(documents, ids=ids)
                self._persist()
                position_by_id = {
                    docstore_id: position
                    for position, docstore_id in self._store.index_to_docstore_id.items()
                }
                return [position_by_id[doc_id] for doc_id in ids]
        except (ConfigurationError, ValidationError):
            raise
        except Exception as exc:
            logger.exception("Could not add documents to LangChain FAISS")
            # Restore the last atomically persisted state if an add/persist step failed.
            self._store = None
            self._load()
            raise ExternalServiceError("Could not update the vector index.") from exc

    def search(
        self,
        question: str,
        document_ids: set[int],
        *,
        top_k: int,
        score_threshold: float,
    ) -> list[LangChainSearchResult]:
        with self._lock:
            if self._store is None or self._store.index.ntotal == 0:
                return []
            try:
                matches = self._store.similarity_search_with_score(
                    question,
                    k=min(top_k, int(self._store.index.ntotal)),
                    fetch_k=int(self._store.index.ntotal),
                    filter=lambda metadata: int(metadata.get("document_id", -1))
                    in document_ids,
                )
            except ConfigurationError:
                raise
            except Exception as exc:
                logger.exception("LangChain FAISS retrieval failed")
                raise ExternalServiceError("Vector retrieval failed.") from exc

        results: list[LangChainSearchResult] = []
        for document, squared_l2_distance in matches:
            # Vectors are L2-normalized: cosine = 1 - squared_L2 / 2.
            cosine_score = max(-1.0, min(1.0, 1.0 - float(squared_l2_distance) / 2.0))
            if cosine_score >= score_threshold:
                results.append(LangChainSearchResult(document, cosine_score))
        return results

    def remove_document(self, document_id: int) -> None:
        with self._lock:
            if self._store is None:
                return
            ids = [
                docstore_id
                for docstore_id in self._store.index_to_docstore_id.values()
                if self._document_for_id(docstore_id).metadata.get("document_id") == document_id
            ]
            if ids:
                self._store.delete(ids=ids)
                if self._store.index.ntotal == 0:
                    self._store = None
                self._persist()

    def rebuild(self, chunks: list[DocumentChunk]) -> None:
        with self._lock:
            if not chunks:
                self._store = None
                self._persist()
                return
            desired_ids = {str(chunk.id) for chunk in chunks}
            if self._store is not None:
                current_ids = set(self._store.index_to_docstore_id.values())
                # LangChain FAISS.delete reconstructs the index from retained vectors.
                # This avoids a provider call during normal document deletion.
                if desired_ids.issubset(current_ids):
                    ids_to_remove = list(current_ids - desired_ids)
                    if ids_to_remove:
                        self._store.delete(ids=ids_to_remove)
                    position_by_id = {
                        docstore_id: position
                        for position, docstore_id in self._store.index_to_docstore_id.items()
                    }
                    for chunk in chunks:
                        chunk.vector_id = position_by_id[str(chunk.id)]
                    self._persist()
                    return

            # Recovery path for a missing/inconsistent index: embed authoritative rows again.
            documents = [self._langchain_document(chunk) for chunk in chunks]
            ids = [str(chunk.id) for chunk in chunks]
            try:
                self._store = FAISS.from_documents(
                    documents,
                    self.embeddings,
                    ids=ids,
                    normalize_L2=True,
                    distance_strategy=DistanceStrategy.EUCLIDEAN_DISTANCE,
                )
            except ConfigurationError:
                raise
            except Exception as exc:
                logger.exception("LangChain FAISS rebuild failed")
                raise ExternalServiceError("Could not rebuild the vector index.") from exc
            for position, chunk in enumerate(chunks):
                chunk.vector_id = position
            self._persist()

    def migrate_legacy(self, chunks: list[DocumentChunk]) -> bool:
        """Convert the previous raw FAISS+JSON format without re-embedding documents."""
        with self._lock:
            if self._legacy_index is None:
                return False
            chunks_by_id = {chunk.id: chunk for chunk in chunks}
            retained: list[tuple[np.ndarray, DocumentChunk]] = []
            for position, chunk_id in enumerate(self._legacy_mapping):
                chunk = chunks_by_id.get(chunk_id)
                if chunk is not None and position < self._legacy_index.ntotal:
                    vector = np.asarray(self._legacy_index.reconstruct(position), dtype=np.float32)
                    norm = np.linalg.norm(vector)
                    if norm:
                        retained.append((vector / norm, chunk))

            if not retained:
                self._legacy_index = None
                self._legacy_mapping = []
                self._store = None
                self._persist()
                return True

            matrix = np.ascontiguousarray(np.vstack([item[0] for item in retained]))
            index = faiss.IndexFlatL2(matrix.shape[1])
            index.add(matrix)
            documents = {
                str(chunk.id): self._langchain_document(chunk) for _, chunk in retained
            }
            mapping = {position: str(chunk.id) for position, (_, chunk) in enumerate(retained)}
            self._store = FAISS(
                self.embeddings,
                index,
                InMemoryDocstore(documents),
                mapping,
                normalize_L2=True,
                distance_strategy=DistanceStrategy.EUCLIDEAN_DISTANCE,
            )
            for position, (_, chunk) in enumerate(retained):
                chunk.vector_id = position
            self._legacy_index = None
            self._legacy_mapping = []
            self._persist()
            logger.info("Migrated %s existing vectors into LangChain FAISS", len(retained))
            return True

    def _load(self) -> None:
        if not self.index_path.exists() or not self.metadata_path.exists():
            return
        try:
            index = faiss.read_index(str(self.index_path))
            payload = json.loads(self.metadata_path.read_text(encoding="utf-8"))
            if payload.get("version") != 2:
                mapping = [int(value) for value in payload.get("vector_to_chunk", [])]
                if len(mapping) != index.ntotal:
                    raise ValueError("Legacy FAISS mapping count does not match its index")
                self._legacy_index = index
                self._legacy_mapping = mapping
                return

            documents = {
                docstore_id: LangChainDocument(
                    page_content=value["page_content"], metadata=value["metadata"]
                )
                for docstore_id, value in payload["documents"].items()
            }
            index_mapping = {
                int(position): docstore_id
                for position, docstore_id in payload["index_to_docstore_id"].items()
            }
            if index.ntotal != len(index_mapping):
                raise ValueError("FAISS index count does not match LangChain metadata")
            self._store = FAISS(
                self.embeddings,
                index,
                InMemoryDocstore(documents),
                index_mapping,
                normalize_L2=True,
                distance_strategy=DistanceStrategy.EUCLIDEAN_DISTANCE,
            )
            logger.info("Loaded LangChain FAISS index with %s vectors", index.ntotal)
        except Exception:
            logger.exception("Could not load the LangChain FAISS index; starting empty")
            self._store = None

    def _persist(self) -> None:
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        self.metadata_path.parent.mkdir(parents=True, exist_ok=True)
        if self._store is None:
            self.index_path.unlink(missing_ok=True)
            self.metadata_path.unlink(missing_ok=True)
            return

        index_temp = Path(f"{self.index_path}.tmp")
        metadata_temp = Path(f"{self.metadata_path}.tmp")
        faiss.write_index(self._store.index, str(index_temp))
        documents: dict[str, dict[str, Any]] = {}
        for docstore_id in self._store.index_to_docstore_id.values():
            document = self._document_for_id(docstore_id)
            documents[docstore_id] = {
                "page_content": document.page_content,
                "metadata": document.metadata,
            }
        metadata_temp.write_text(
            json.dumps(
                {
                    "version": 2,
                    "index_to_docstore_id": {
                        str(position): docstore_id
                        for position, docstore_id in self._store.index_to_docstore_id.items()
                    },
                    "documents": documents,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        os.replace(index_temp, self.index_path)
        os.replace(metadata_temp, self.metadata_path)

    def _document_for_id(self, docstore_id: str) -> LangChainDocument:
        if self._store is None:
            raise ValidationError("The vector store is not initialized.")
        document = self._store.docstore.search(docstore_id)
        if not isinstance(document, LangChainDocument):
            raise ValidationError("LangChain FAISS metadata is inconsistent.")
        return document

    @staticmethod
    def _langchain_document(chunk: DocumentChunk) -> LangChainDocument:
        return LangChainDocument(
            page_content=chunk.text,
            metadata={
                "chunk_id": chunk.id,
                "document_id": chunk.document_id,
                "document_name": chunk.document.original_filename,
                "page_number": chunk.page_number,
                "chunk_index": chunk.chunk_index,
            },
        )
