import re
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import Settings
from app.core.errors import ValidationError

PDF_SIGNATURE = b"%PDF-"
SAFE_NAME_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")


@dataclass(frozen=True)
class StoredFile:
    filename: str
    original_filename: str
    path: Path
    size: int


def validate_pdf(filename: str | None, content_type: str | None, header: bytes) -> None:
    """Validate extension, MIME type, and the PDF magic bytes."""
    if not filename or not filename.lower().endswith(".pdf"):
        raise ValidationError("Only PDF files are supported.")
    allowed_types = {"application/pdf", "application/octet-stream", None, ""}
    if content_type not in allowed_types:
        raise ValidationError("The uploaded file must use the PDF content type.")
    if not header.startswith(PDF_SIGNATURE):
        raise ValidationError("The file content is not a valid PDF.")


class FileStorage:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.settings.upload_dir.mkdir(parents=True, exist_ok=True)

    async def save_pdf(self, upload: UploadFile) -> StoredFile:
        original_name = Path(upload.filename or "document.pdf").name
        safe_name = SAFE_NAME_PATTERN.sub("_", original_name).strip("._") or "document.pdf"
        if not safe_name.lower().endswith(".pdf"):
            safe_name += ".pdf"
        stored_name = f"{uuid4().hex}_{safe_name}"
        destination = self.settings.upload_dir / stored_name
        max_bytes = self.settings.max_upload_size_mb * 1024 * 1024
        total = 0

        first = await upload.read(8)
        validate_pdf(original_name, upload.content_type, first)

        try:
            with destination.open("wb") as output:
                output.write(first)
                total += len(first)
                while chunk := await upload.read(1024 * 1024):
                    total += len(chunk)
                    if total > max_bytes:
                        raise ValidationError(
                            f"PDF exceeds the {self.settings.max_upload_size_mb} MB upload limit."
                        )
                    output.write(chunk)
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        finally:
            await upload.close()

        return StoredFile(stored_name, original_name, destination, total)

    @staticmethod
    def delete(path: str | Path) -> None:
        Path(path).unlink(missing_ok=True)

