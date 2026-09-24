import json
from pathlib import Path
from fastapi.testclient import TestClient
from app.alexandria.allowlist import Work
from app.alexandria.service import refresh_work
from app.db import connect, migrate
from app.lexicon import load_lexicon
from app.main import create_app

PROSE = ("Le vieux marin regardait la mer. Les vagues grises montaient lentement vers la plage, et les mouettes criaient au-dessus des rochers. "
         "Il pensait aux voyages anciens, aux tempêtes et aux ports lointains où les hommes chantaient le soir. ")

WORKS = {"version": 1, "works": [
    {"id": "verne", "title": "Vingt mille lieues sous les mers", "author": "Jules Verne", "author_death": 1905, "translator": None, "translator_death": None,
     "source": "wikisource", "pages": ["Vingt_mille_lieues_sous_les_mers/Partie_1/Chapitre_1", "Vingt_mille_lieues_sous_les_mers/Partie_1/Chapitre_2"], "level_hint": "9H", "note": ""},
    {"id": "missing", "title": "Absent", "author": "X", "author_death": 1800, "translator": None, "translator_death": None,
     "source": "wikisource", "pages": ["Nope"], "level_hint": "8H", "note": ""},
    {"id": "gut", "title": "Test Gutenberg", "author": "Y", "author_death": 1800, "translator": None, "translator_death": None,
     "source": "gutenberg", "pages": [], "ebook_id": 99999, "level_hint": "8H", "note": ""}]}


def make_client(settings):
    (settings.content_dir / "alexandria" / "works.json").write_text(json.dumps(WORKS), encoding="utf-8")
    return TestClient(create_app(settings))


def test_works_listing_and_refresh_partial_and_error(settings):
    with make_client(settings) as client:
        works = client.get("/api/alexandria/works").json()
        assert [w["id"] for w in works] == ["verne", "missing", "gut"] and works[0]["status"] == "never" and works[0]["credits"] == "Jules Verne, Vingt mille lieues sous les mers"
        r = client.post("/api/alexandria/works/verne/refresh")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "ok" and d["chunk_count"] >= 2 and d["rejected"].get("digits", 0) >= 1
        assert "1 page" in d["error"]                           # partial: Chapitre_2 has no fixture → note, not failure
        r = client.post("/api/alexandria/works/missing/refresh")
        assert r.status_code == 200 and r.json()["status"] == "error" and r.json()["chunk_count"] == 0
        assert "inaccessible" in r.json()["error"]
        r = client.post("/api/alexandria/works/gut/refresh")
        assert r.status_code == 200 and r.json()["status"] == "ok" and r.json()["chunk_count"] >= 1
        assert client.post("/api/alexandria/works/unknown/refresh").status_code == 404
        works = {w["id"]: w for w in client.get("/api/alexandria/works").json()}
        assert works["verne"]["status"] == "ok" and works["missing"]["status"] == "error" and works["verne"]["chunk_count"] >= 2


def test_chunks_and_adopt(settings):
    with make_client(settings) as client:
        client.post("/api/alexandria/works/verne/refresh")
        chunks = client.get("/api/alexandria/works/verne/chunks").json()
        assert chunks == sorted(chunks, key=lambda c: -c["score"])
        c = chunks[0]
        assert 80 <= c["word_count"] <= 200 and c["level"] in ("9H", "10H", "11H") and c["text_id"] is None and len(c["preview"]) <= 140
        assert all(ch["level"] == "9H" for ch in client.get("/api/alexandria/works/verne/chunks?level=9H").json())
        p = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H"}).json()
        r = client.post(f"/api/alexandria/chunks/{c['id']}/adopt", json={"profile_id": p["id"]})
        assert r.status_code == 201, r.text
        t = r.json()
        assert t["source"] == "online" and t["author"] == "Jules Verne" and t["title"].startswith("Vingt mille lieues") and t["level"] == c["level"]
        assert t["annotation"]["version"] == 2 and t["added_by_profile_id"] == p["id"]
        again = client.post(f"/api/alexandria/chunks/{c['id']}/adopt", json={"profile_id": p["id"]})
        assert again.status_code == 200 and again.json()["id"] == t["id"]
        assert client.get("/api/alexandria/works/verne/chunks").json()[0]["text_id"] == t["id"]
        assert client.post("/api/alexandria/chunks/999999/adopt", json={"profile_id": p["id"]}).status_code == 404
        # « Recopier à nouveau » keeps the adopted scroll linked to its library text (no duplicate adoption)
        assert client.post("/api/alexandria/works/verne/refresh").json()["status"] == "ok"
        relinked = [ch for ch in client.get("/api/alexandria/works/verne/chunks").json() if ch["text_id"] is not None]
        assert [ch["text_id"] for ch in relinked] == [t["id"]]


def test_refresh_annotates_at_most_max_chunks(tmp_path, settings):
    # 60 clean paragraphs of ~100 words → dozens of candidate chunks; only the first `max_chunks` are annotated and cached
    class ManyPages:
        def wikisource_page(self, title):
            return '<div class="mw-parser-output">' + f"<p>{PROSE * 2}</p>" * 60 + "</div>"

    calls = []

    def annotate_fn(body):
        calls.append(body)
        return {"version": 2, "tokens": [], "chains": [], "sentences": []}

    conn = connect(tmp_path / "cap.sqlite3")
    migrate(conn)
    work = Work(id="w", title="T", author="A", author_death=1900, translator=None, translator_death=None,
                source="wikisource", pages=("P",), ebook_id=None, level_hint="8H", note="")
    result = refresh_work(conn, work, ManyPages(), annotate_fn, load_lexicon(settings.content_dir), max_chunks=7)
    assert result["status"] == "ok" and result["chunk_count"] == 7 and len(calls) == 7
    assert "7 rouleaux" in result["error"]
    assert conn.execute("SELECT COUNT(*) FROM online_chunk WHERE work_id = 'w'").fetchone()[0] == 7
    assert json.loads(conn.execute("SELECT stats_json FROM online_work WHERE id = 'w'").fetchone()[0])["truncated"] >= 20
