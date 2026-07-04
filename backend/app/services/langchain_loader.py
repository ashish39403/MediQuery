import logging
import re
from pathlib import Path

from langchain_community.document_loaders import PyMuPDFLoader
from langchain_core.documents import Document as LangChainDocument

from app.core.errors import ValidationError

logger = logging.getLogger(__name__)


class LangChainPDFLoader:
    """Load one LangChain ``Document`` per PDF page with stable metadata."""

    @staticmethod
    def load(
        pdf_path: str | Path,
        *,
        document_id: int,
        document_name: str,
    ) -> list[LangChainDocument]:
        try:
            pages = PyMuPDFLoader(str(pdf_path), mode="page").load()
        except Exception as exc:
            logger.exception("LangChain could not load PDF %s", pdf_path)
            raise ValidationError(
                "The PDF could not be opened, is encrypted, or is corrupted."
            ) from exc

        loaded: list[LangChainDocument] = []
        for fallback_page, page in enumerate(pages, start=1):
            text = LangChainPDFLoader._clean_text(page.page_content)
            if not text:
                continue
            zero_based_page = page.metadata.get("page")
            page_number = (
                int(zero_based_page) + 1
                if isinstance(zero_based_page, (int, float))
                else fallback_page
            )
            loaded.append(
                LangChainDocument(
                    page_content=text,
                    metadata={
                        "document_id": document_id,
                        "document_name": document_name,
                        "page_number": page_number,
                        "source": str(pdf_path),
                    },
                )
            )

        if not loaded:
            raise ValidationError(
                "No readable text was found. Scanned PDFs require an OCR pipeline."
            )
        return loaded

    @staticmethod
    def _clean_text(text: str) -> str:
        text = text.replace("\x00", " ").replace("\u00ad", "")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

