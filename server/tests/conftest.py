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
    # The corrupt engine's reform safety net (never plant an accepted spelling) must be exercised too.
    shutil.copy(REPO_CONTENT / "reform1990.json", content / "reform1990.json")
    (content / "lexique").mkdir()
    shutil.copy(REPO_CONTENT / "lexique" / "lexique383-trimmed.tsv.gz", content / "lexique" / "lexique383-trimmed.tsv.gz")
    (content / "alexandria").mkdir()
    shutil.copy(REPO_CONTENT / "alexandria" / "works.json", content / "alexandria" / "works.json")
    return Settings(data_dir=tmp_path / "data", content_dir=content,
                    static_dir=tmp_path / "static", spacy_model="fr_core_news_sm",
                    seed_on_startup=False,
                    alexandria_offline_dir=Path(__file__).parent / "fixtures" / "alexandria")


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as c:
        yield c


@pytest.fixture(scope="session")
def nlp():
    from app.nlp.model import get_nlp
    return get_nlp("fr_core_news_sm")


@pytest.fixture(scope="session")
def lexicon():
    from app.lexicon import load_lexicon
    return load_lexicon(REPO_CONTENT)
