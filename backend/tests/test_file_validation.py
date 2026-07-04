import pytest

from app.core.errors import ValidationError
from app.storage.file_storage import validate_pdf


def test_pdf_validation_accepts_real_signature() -> None:
    validate_pdf("guideline.pdf", "application/pdf", b"%PDF-1.7")


@pytest.mark.parametrize(
    ("filename", "content_type", "header"),
    [
        ("notes.txt", "text/plain", b"hello"),
        ("fake.pdf", "application/pdf", b"not-a-pdf"),
        ("fake.pdf", "image/png", b"%PDF-1.4"),
    ],
)
def test_pdf_validation_rejects_invalid_inputs(
    filename: str, content_type: str, header: bytes
) -> None:
    with pytest.raises(ValidationError):
        validate_pdf(filename, content_type, header)

