import shutil
from pathlib import Path
from app.db import connect, migrate
from app.seed import import_seed

FIXTURES = Path(__file__).parent / "fixtures" / "seed"


def fake_annotate(text):
    return {"version": 1, "model": "fake", "tokens": [], "sentences": []}


def test_import_seed_is_idempotent(tmp_path):
    content = tmp_path / "content"
    shutil.copytree(FIXTURES, content / "seed")
    conn = connect(tmp_path / "db.sqlite3"); migrate(conn)
    assert import_seed(conn, content, fake_annotate) == 2
    assert import_seed(conn, content, fake_annotate) == 0
    rows = conn.execute("SELECT seed_key, source, credits, level FROM text ORDER BY seed_key").fetchall()
    assert [r["seed_key"] for r in rows] == ["001-test-fees", "002-test-loup"]
    assert rows[0]["source"] == "seed" and rows[0]["credits"] == "Les Muses de la Discorde, Textes originaux"
    assert rows[0]["level"] == "7H"


def test_startup_imports_seed(tmp_path, settings):
    from fastapi.testclient import TestClient
    from app.main import create_app
    from dataclasses import replace
    shutil.copytree(FIXTURES, settings.content_dir / "seed")
    shutil.copy(Path(__file__).resolve().parents[2] / "content" / "homophones.json", settings.content_dir)
    s = replace(settings, seed_on_startup=True)
    with TestClient(create_app(s)) as c:
        titles = [t["title"] for t in c.get("/api/texts").json()]
    assert "Les fées de la clairière" in titles
