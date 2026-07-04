import os
import tempfile
from pathlib import Path

TEST_ROOT = Path(tempfile.mkdtemp(prefix="mediquery-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(TEST_ROOT / 'test.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(TEST_ROOT / "uploads")
os.environ["FAISS_INDEX_PATH"] = str(TEST_ROOT / "vectors" / "faiss.index")
os.environ["FAISS_METADATA_PATH"] = str(TEST_ROOT / "vectors" / "metadata.json")
os.environ["OPENAI_API_KEY"] = ""
os.environ["CHAT_MODEL"] = ""
os.environ["EMBEDDING_MODEL"] = ""

