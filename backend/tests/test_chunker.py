from langchain_core.documents import Document

from app.services.langchain_chunker import LangChainChunker


def test_chunker_is_page_aware_and_overlapping() -> None:
    page_one = " ".join(f"word-{index}" for index in range(220))
    page_two = "Second page contains a concise medical summary."
    chunker = LangChainChunker(chunk_size=500, overlap=100)

    chunks = chunker.split(
        [
            Document(page_content=page_one, metadata={"page_number": 1}),
            Document(page_content=page_two, metadata={"page_number": 2}),
        ]
    )

    assert len(chunks) > 2
    assert [chunk.metadata["chunk_index"] for chunk in chunks] == list(range(len(chunks)))
    assert all(chunk.metadata["page_number"] in {1, 2} for chunk in chunks)
    assert chunks[-1].metadata["page_number"] == 2
    assert chunks[-1].page_content == page_two


def test_chunker_rejects_invalid_overlap() -> None:
    try:
        LangChainChunker(chunk_size=200, overlap=200)
    except ValueError as exc:
        assert "overlap" in str(exc)
    else:
        raise AssertionError("Expected invalid overlap to fail")
