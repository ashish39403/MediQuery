from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables or ``.env``."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "MediQuery RAG API"
    environment: str = "development"
    log_level: str = "INFO"

    database_url: str = "sqlite:///./medical_rag.db"
    upload_dir: Path = Path("uploads")
    faiss_index_path: Path = Path("vector_store/faiss.index")
    faiss_metadata_path: Path = Path("vector_store/faiss_metadata.json")
    frontend_origin: str = "http://localhost:5173,http://127.0.0.1:5173 ,https://medi-query-silk.vercel.app/ "

    openai_api_key: str = Field(default="", validation_alias="OPENAI_API_KEY")
    openai_base_url: str = Field(default="https://aicredits.in/v1", validation_alias="OPENAI_BASE_URL")
    chat_model: str = Field(default="gpt-4o-mini", validation_alias="CHAT_MODEL")
    embedding_model: str = Field(default="text-embedding-3-small", validation_alias="EMBEDDING_MODEL")

    max_upload_size_mb: int = 50
    chunk_size: int = Field(default=900, ge=400, le=2_000)
    chunk_overlap: int = Field(default=180, ge=0, le=500)
    retrieval_top_k: int = Field(default=5, ge=1, le=20)
    retrieval_score_threshold: float = Field(default=0.20, ge=-1.0, le=1.0)

    def ensure_directories(self) -> None:
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.faiss_index_path.parent.mkdir(parents=True, exist_ok=True)
        self.faiss_metadata_path.parent.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.ensure_directories()
    return settings
