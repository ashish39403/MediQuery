import logging

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError, NotFoundError
from app.db.models import Document, DocumentChunk, DocumentStatus
from app.services.langchain_chunker import LangChainChunker
from app.services.langchain_loader import LangChainPDFLoader
from app.services.langchain_vector_store import LangChainFAISSVectorStore
from app.storage.file_storage import FileStorage

logger = logging.getLogger(__name__)


class DocumentService:
    def __init__(
        self,
        file_storage: FileStorage,
        loader: LangChainPDFLoader,
        chunker: LangChainChunker,
        vector_store: LangChainFAISSVectorStore,
    ) -> None:
        self.file_storage = file_storage
        self.loader = loader
        self.chunker = chunker
        self.vector_store = vector_store

    async def ingest(self, db: Session, upload: UploadFile) -> Document:
        stored = await self.file_storage.save_pdf(upload)
        document = Document(
            filename=stored.filename,
            original_filename=stored.original_filename,
            file_path=str(stored.path),
            status=DocumentStatus.PROCESSING,
        )
        db.add(document)
        db.commit()
        db.refresh(document)
        vectors_added = False

        try:
            pages = self.loader.load(
                stored.path,
                document_id=document.id,
                document_name=document.original_filename,
            )
            text_chunks = self.chunker.split(pages)
            if not text_chunks:
                raise AppError("No indexable text chunks were produced from the PDF.")

            chunks = [
                DocumentChunk(
                    document_id=document.id,
                    chunk_index=int(chunk.metadata["chunk_index"]),
                    text=chunk.page_content,
                    page_number=int(chunk.metadata["page_number"]),
                )
                for chunk in text_chunks
            ]
            db.add_all(chunks)
            db.flush()

            vector_ids = self.vector_store.add_documents(text_chunks, chunks)
            vectors_added = True
            for chunk, vector_id in zip(chunks, vector_ids, strict=True):
                chunk.vector_id = vector_id

            document.status = DocumentStatus.INDEXED
            document.chunk_count = len(chunks)
            document.error_message = None
            db.commit()
            db.refresh(document)
            logger.info("Indexed document %s into %s chunks", document.id, len(chunks))
            return document
        except Exception as exc:
            db.rollback()
            if vectors_added:
                try:
                    self.vector_store.remove_document(document.id)
                except Exception:
                    logger.critical("FAISS rollback recovery failed", exc_info=True)
            failed = db.get(Document, document.id)
            if failed is not None:
                failed.status = DocumentStatus.FAILED
                failed.chunk_count = 0
                failed.error_message = (
                    exc.message if isinstance(exc, AppError) else "Document processing failed."
                )
                db.commit()
            logger.exception("Document %s ingestion failed", document.id)
            raise

    @staticmethod
    def list_documents(db: Session) -> list[Document]:
        return list(db.scalars(select(Document).order_by(Document.created_at.desc())).all())

    @staticmethod
    def get_document(db: Session, document_id: int) -> Document:
        document = db.scalar(
            select(Document)
            .options(selectinload(Document.chunks))
            .where(Document.id == document_id)
        )
        if document is None:
            raise NotFoundError("Document not found.")
        return document

    def delete_document(self, db: Session, document_id: int) -> None:
        document = self.get_document(db, document_id)
        file_path = document.file_path
        remaining_chunks = list(
            db.scalars(
                select(DocumentChunk)
                .where(DocumentChunk.document_id != document_id)
                .order_by(DocumentChunk.vector_id)
            ).all()
        )

        # Rebuild LangChain FAISS from the retained authoritative SQLite chunks.
        self.vector_store.rebuild(remaining_chunks)
        db.delete(document)
        db.commit()
        try:
            self.file_storage.delete(file_path)
        except OSError:
            logger.warning("Could not remove PDF file %s", file_path, exc_info=True)
