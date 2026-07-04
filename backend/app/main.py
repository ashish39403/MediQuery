import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import chat, documents, health
from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.db.base import Base
from app.db.models import DocumentChunk
from app.db.session import SessionLocal, engine
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.services.container import build_container

settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.ensure_directories()
    Base.metadata.create_all(bind=engine)
    app.state.services = build_container(settings)
    if app.state.services.vector_store.migration_required:
        with SessionLocal() as db:
            chunks = list(
                db.scalars(
                    select(DocumentChunk)
                    .options(joinedload(DocumentChunk.document))
                    .order_by(DocumentChunk.vector_id)
                ).all()
            )
            if app.state.services.vector_store.migrate_legacy(chunks):
                db.commit()
    logger.info("%s started in %s mode", settings.app_name, settings.environment)
    yield


app = FastAPI(
    title="MediQuery RAG API",
    version="1.0.0",
    description="Medical document ingestion and citation-backed retrieval augmented generation.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.frontend_origin.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)


@app.exception_handler(Exception)
async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled request error", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred.", "code": "internal_error"},
    )


app.include_router(health.router)
app.include_router(documents.router)
app.include_router(chat.router)


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"service": settings.app_name, "docs": "/docs"}
