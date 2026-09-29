import json
from app.db import connect, migrate
from app.nlp.annotate import ANNOTATION_VERSION
from app.reannotate import reannotate_outdated

INSERT = "INSERT INTO text(title, body, source, level, annotation_json, created_at) VALUES (?, ?, 'custom', '8H', ?, 'now')"


def test_reannotates_only_outdated_rows(tmp_path):
    conn = connect(tmp_path / "db.sqlite3")
    migrate(conn)
    conn.execute(INSERT, ("old", "Les fées dansent.", '{"version": 1}'))
    conn.execute(INSERT, ("new", "Il dort.", '{"version": 2}'))
    conn.execute(INSERT, ("empty", "Il dort.", "{}"))
    conn.commit()
    calls = []

    def fake(body):
        calls.append(body)
        return {"version": 2, "tokens": [], "sentences": [], "chains": []}

    assert reannotate_outdated(conn, fake, version=2) == 2
    assert sorted(calls) == ["Il dort.", "Les fées dansent."]
    assert json.loads(conn.execute("SELECT annotation_json FROM text WHERE title = 'old'").fetchone()[0])["version"] == 2
    assert reannotate_outdated(conn, fake, version=2) == 0


def test_reannotation_survives_the_connection(tmp_path):
    # The update must be committed: the app reopens the database per request.
    path = tmp_path / "db.sqlite3"
    conn = connect(path)
    migrate(conn)
    conn.execute(INSERT, ("old", "Les fées dansent.", '{"version": 1}'))
    conn.commit()
    reannotate_outdated(conn, lambda body: {"version": 2, "body": body}, version=2)
    conn.close()
    again = connect(path)
    stored = json.loads(again.execute("SELECT annotation_json FROM text WHERE title = 'old'").fetchone()[0])
    assert stored == {"version": 2, "body": "Les fées dansent."}


def test_startup_reannotates_outdated_texts(settings):
    from dataclasses import replace
    from fastapi.testclient import TestClient
    from app.db import DB_FILENAME
    from app.main import create_app
    conn = connect(settings.data_dir / DB_FILENAME)
    migrate(conn)
    conn.execute(INSERT, ("old", "Il dort.", '{"version": 1, "tokens": [], "sentences": []}'))
    conn.commit()
    conn.close()
    with TestClient(create_app(replace(settings, seed_on_startup=True))):
        pass
    again = connect(settings.data_dir / DB_FILENAME)
    stored = json.loads(again.execute("SELECT annotation_json FROM text WHERE title = 'old'").fetchone()[0])
    assert stored["version"] == ANNOTATION_VERSION and stored["chains"] is not None and stored["tokens"][0]["text"] == "Il"
