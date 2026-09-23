import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app


@pytest.fixture
def settings(tmp_path):
    return Settings(data_dir=tmp_path / "data", content_dir=tmp_path / "content",
                    static_dir=tmp_path / "static", spacy_model="fr_core_news_sm",
                    seed_on_startup=False)


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c
