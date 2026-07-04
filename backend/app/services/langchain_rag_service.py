import logging
from typing import Any

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import Settings
from app.core.errors import ConfigurationError, ExternalServiceError, NotFoundError
from app.db.models import (
    Conversation,
    Document,
    DocumentChunk,
    DocumentStatus,
    Message,
    MessageRole,
)
from app.schemas.chat import ChatRequest, ChatResponse, CitationResponse
from app.services.langchain_vector_store import LangChainFAISSVectorStore
from app.services.safety import BASE_NOTICE, HIGH_RISK_NOTICE, assess_medical_risk

logger = logging.getLogger(__name__)

INSUFFICIENT_CONTEXT = "I could not find enough information in the uploaded documents."

SYSTEM_PROMPT = """You are MediQuery RAG, a medical document question-answering assistant.

Your role is to answer the user’s question using only the retrieved context from the uploaded medical documents.

You must not use outside knowledge, assumptions, or general medical information unless it is explicitly present in the retrieved context.

Core rules:

1. Answer only from the retrieved context.
2. Do not invent, assume, or add medical facts that are not present in the context.
3. If the retrieved context does not contain enough information to answer, say exactly:
   “I could not find enough information in the uploaded documents.”
4. Every important claim must be supported by an inline citation such as [Source 1], [Source 2].
5. Do not provide direct diagnosis, dosage decisions, prescription guidance, emergency instructions, or treatment plans.
6. If the user asks about diagnosis, dosage, medication use, emergency symptoms, pregnancy, children, severe pain, or treatment decisions, include this warning:
   “Please consult a licensed medical professional before making any medical decision.”
7. Keep the answer clear, concise, and easy to understand.
8. Do not mention that you are using an AI model.
9. Do not apologize unless there is an actual error.
10. End every answer with:
    “This is based only on uploaded documents and is not medical advice.”

Answer format:

* Direct answer first.
* Then brief supporting explanation.
* Include inline citations next to the claims they support.
* If useful, use short bullet points.
* End with the required medical disclaimer.

Retrieved context format:
Each source will be provided with a label such as:
[Source 1]
Document: document_name.pdf
Page: 3
Content: ...

Use only these labeled sources for citations.

"""

HUMAN_PROMPT = """Retrieved context:

{context}

Question: {question}

Safety instruction: {safety_instruction}

Write a concise answer grounded only in the retrieved context."""


class LangChainRAGService:
    """Retrieval and generation orchestrated with LangChain primitives."""

    def __init__(self, settings: Settings, vector_store: LangChainFAISSVectorStore) -> None:
        self.settings = settings
        self.vector_store = vector_store
        self.prompt = ChatPromptTemplate.from_messages(
            [("system", SYSTEM_PROMPT), ("human", HUMAN_PROMPT)]
        )
        self.chat_model: Any | None = None

    def answer(self, db: Session, request: ChatRequest) -> ChatResponse:
        safety = assess_medical_risk(request.question)
        valid_document_ids = set(
            db.scalars(
                select(Document.id).where(
                    Document.id.in_(request.document_ids),
                    Document.status == DocumentStatus.INDEXED,
                )
            ).all()
        )

        matches = self.vector_store.search(
            request.question,
            valid_document_ids,
            top_k=self.settings.retrieval_top_k,
            score_threshold=self.settings.retrieval_score_threshold,
        ) if valid_document_ids else []

        chunk_ids = [
            int(match.document.metadata["chunk_id"])
            for match in matches
            if "chunk_id" in match.document.metadata
        ]
        chunks_by_id: dict[int, DocumentChunk] = {}
        if chunk_ids:
            chunks = db.scalars(
                select(DocumentChunk)
                .options(joinedload(DocumentChunk.document))
                .where(DocumentChunk.id.in_(chunk_ids))
            ).all()
            chunks_by_id = {chunk.id: chunk for chunk in chunks}

        retrieved = [
            (chunks_by_id[int(match.document.metadata["chunk_id"])], match.score)
            for match in matches
            if int(match.document.metadata.get("chunk_id", -1)) in chunks_by_id
        ]
        if not retrieved:
            answer = f"{INSUFFICIENT_CONTEXT}\n\n{BASE_NOTICE}"
            conversation_id = self._save_exchange(db, request, answer)
            return ChatResponse(
                answer=answer,
                conversation_id=conversation_id,
                citations=[],
                safety_notice=safety.notice,
            )

        context = self._build_context(retrieved)
        safety_instruction = (
            f"Include this warning verbatim: {HIGH_RISK_NOTICE}"
            if safety.high_risk
            else "No additional high-risk warning is required."
        )
        try:
            prompt_value = self.prompt.invoke(
                {
                    "context": context,
                    "question": request.question,
                    "safety_instruction": safety_instruction,
                }
            )
            response = self._get_chat_model().invoke(prompt_value)
            answer = self._message_text(response.content)
        except ConfigurationError:
            raise
        except Exception as exc:
            logger.exception("LangChain ChatOpenAI invocation failed")
            raise ExternalServiceError("The language model provider request failed.") from exc

        if not answer:
            raise ExternalServiceError("The language model returned an empty answer.")
        if safety.high_risk and HIGH_RISK_NOTICE not in answer:
            answer = f"{answer}\n\n{HIGH_RISK_NOTICE}"
        if "not medical advice" not in answer.casefold():
            answer = f"{answer}\n\n{BASE_NOTICE}"

        citations = [
            CitationResponse(
                document_id=chunk.document_id,
                document_name=chunk.document.original_filename,
                page_number=chunk.page_number,
                chunk_index=chunk.chunk_index,
                chunk_text=chunk.text[:700],
                score=round(score, 4),
            )
            for chunk, score in retrieved
        ]
        conversation_id = self._save_exchange(db, request, answer)
        return ChatResponse(
            answer=answer,
            conversation_id=conversation_id,
            citations=citations,
            safety_notice=safety.notice,
        )

    def _get_chat_model(self) -> Any:
        if self.chat_model is not None:
            return self.chat_model
        if not self.settings.openai_api_key or not self.settings.chat_model:
            raise ConfigurationError(
                "OPENAI_API_KEY and CHAT_MODEL must be configured before asking questions."
            )
        self.chat_model = ChatOpenAI(
            model=self.settings.chat_model,
            api_key=self.settings.openai_api_key,
            base_url=self.settings.openai_base_url,
            temperature=0,
            max_retries=2,
        )
        return self.chat_model

    @staticmethod
    def _build_context(retrieved: list[tuple[DocumentChunk, float]]) -> str:
        return "\n\n".join(
            f"[Source {index} | document={chunk.document.original_filename} | "
            f"page={chunk.page_number or 'unknown'} | chunk={chunk.chunk_index}]\n{chunk.text}"
            for index, (chunk, _score) in enumerate(retrieved, start=1)
        )

    @staticmethod
    def _message_text(content: Any) -> str:
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            return "\n".join(
                str(block.get("text", "")) if isinstance(block, dict) else str(block)
                for block in content
            ).strip()
        return str(content).strip()

    @staticmethod
    def _save_exchange(db: Session, request: ChatRequest, answer: str) -> int:
        if request.conversation_id is None:
            conversation = Conversation(title=request.question[:120])
            db.add(conversation)
            db.flush()
        else:
            conversation = db.get(Conversation, request.conversation_id)
            if conversation is None:
                raise NotFoundError("Conversation not found.")

        db.add_all(
            [
                Message(
                    conversation_id=conversation.id,
                    role=MessageRole.USER,
                    content=request.question,
                ),
                Message(
                    conversation_id=conversation.id,
                    role=MessageRole.ASSISTANT,
                    content=answer,
                ),
            ]
        )
        db.commit()
        return conversation.id

