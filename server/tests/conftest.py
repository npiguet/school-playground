import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app

REPO_CONTENT = Path(__file__).resolve().parents[2] / "content"


@pytest.fixture
def settings(tmp_path):
    content = tmp_path / "content"
    content.mkdir()
    shutil.copy(REPO_CONTENT / "homophones.json", content / "homophones.json")
    return Settings(data_dir=tmp_path / "data", content_dir=content,
                    static_dir=tmp_path / "static", spacy_model="fr_core_news_sm",
                    seed_on_startup=False)


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture(scope="session")
def nlp():
    from app.nlp.model import get_nlp
    return get_nlp("fr_core_news_sm")
