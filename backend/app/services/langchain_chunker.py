from langchain_core.documents import Document as LangChainDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter


class LangChainChunker:
    """Page-aware splitting powered by LangChain's recursive splitter."""

    def __init__(self, chunk_size: int = 900, overlap: int = 180) -> None:
        if chunk_size < 100:
            raise ValueError("chunk_size must be at least 100 characters")
        if overlap < 0 or overlap >= chunk_size:
            raise ValueError("overlap must be non-negative and smaller than chunk_size")
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=overlap,
            length_function=len,
            add_start_index=True,
            separators=["\n\n", "\n", ". ", "; ", " ", ""],
        )

    def split(self, pages: list[LangChainDocument]) -> list[LangChainDocument]:
        # split_documents processes each page Document independently and copies metadata.
        chunks = self.splitter.split_documents(pages)
        for chunk_index, chunk in enumerate(chunks):
            chunk.metadata["chunk_index"] = chunk_index
        return chunks

