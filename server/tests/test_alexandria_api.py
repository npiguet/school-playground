import json
import threading
from pathlib import Path
from fastapi.testclient import TestClient
from app.alexandria.allowlist import Work
from app.alexandria.service import adopt_chunk, refresh_work
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
        # partial: Chapitre_2 has no fixture → note, not failure; a real plural, never « page(s) »
        assert "Les scribes n'ont pas pu lire une page." in d["error"] and "(s)" not in d["error"]
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
        assert t["annotation"]["version"] == 3 and t["added_by_profile_id"] == p["id"]
        again = client.post(f"/api/alexandria/chunks/{c['id']}/adopt", json={"profile_id": p["id"]})
        assert again.status_code == 200 and again.json()["id"] == t["id"]
        assert client.get("/api/alexandria/works/verne/chunks").json()[0]["text_id"] == t["id"]
        assert client.post("/api/alexandria/chunks/999999/adopt", json={"profile_id": p["id"]}).status_code == 404
        # « Demander une nouvelle copie » keeps the adopted scroll linked to its library text (no duplicate adoption)
        assert client.post("/api/alexandria/works/verne/refresh").json()["status"] == "ok"
        relinked = [ch for ch in client.get("/api/alexandria/works/verne/chunks").json() if ch["text_id"] is not None]
        assert [ch["text_id"] for ch in relinked] == [t["id"]]


def test_chunk_id_survives_a_refresh_so_a_concurrent_adopt_still_resolves(settings):
    # Fix round 3 (UI3a Task 2 review): refresh_work used to DELETE every online_chunk row for a
    # work and re-INSERT fresh ones, churning every chunk's autoincrement id on every refresh -
    # harmless for one client alone, but two concurrent refreshes of the same work (two players,
    # or two e2e workers, both hitting « Demander une nouvelle copie » on "Vingt mille lieues" at once, a real scenario)
    # could invalidate a chunk_id a third in-flight adopt() already held: /chunks/{id}/adopt then
    # 404s ("Rouleau inconnu") even though nothing was wrong with the player's request. Refreshing
    # now upserts by (work_id, seq) instead, so a chunk's id is stable across a refresh (re-fetching
    # a static external source reproduces the same seq order) and a concurrent adopt still resolves.
    with make_client(settings) as client:
        client.post("/api/alexandria/works/verne/refresh")
        before = client.get("/api/alexandria/works/verne/chunks").json()
        chunk_id = before[0]["id"]
        # Simulates a second client's concurrent refresh landing between this chunk_id being read
        # by the first client and it being adopted.
        assert client.post("/api/alexandria/works/verne/refresh").json()["status"] == "ok"
        after = client.get("/api/alexandria/works/verne/chunks").json()
        assert after[0]["id"] == chunk_id
        p = client.post("/api/profiles", json={"name": "Concurrent", "avatar": "chouette", "level": "10H"}).json()
        r = client.post(f"/api/alexandria/chunks/{chunk_id}/adopt", json={"profile_id": p["id"]})
        assert r.status_code == 201, r.text


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


# --- Fix round 6: a total fetch budget, so a slow (never erroring) source can't hold a refresh for
# as long as it likes. A fake clock: no real sleeping, and deterministic regardless of host speed.

class _FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


class _SlowPages:
    """Each fetch "takes" `seconds_per_page` (advances the fake clock) before returning a fixture."""

    def __init__(self, clock, seconds_per_page):
        self.clock = clock
        self.seconds_per_page = seconds_per_page
        self.calls = 0

    def wikisource_page(self, title):
        self.calls += 1
        self.clock.advance(self.seconds_per_page)
        return '<div class="mw-parser-output">' + f"<p>{PROSE}</p>" * 3 + "</div>"


def test_refresh_stops_fetching_once_the_total_budget_is_spent(settings):
    # 5 pages at 35 s each: after 3 (105 s elapsed), the budget (90 s) is spent before a 4th fetch is
    # even attempted - the pages already read are kept, the rest simply never fetched.
    clock = _FakeClock()
    fetcher = _SlowPages(clock, seconds_per_page=35.0)
    work = Work(id="w", title="T", author="A", author_death=1900, translator=None, translator_death=None,
                source="wikisource", pages=("P1", "P2", "P3", "P4", "P5"), ebook_id=None, level_hint="8H", note="")
    conn = connect(settings.data_dir / "budget.sqlite3")
    migrate(conn)
    result = refresh_work(conn, work, fetcher, _fake_annotate, load_lexicon(settings.content_dir),
                           fetch_budget_s=90.0, clock=clock)
    assert fetcher.calls == 3
    assert result["status"] == "ok"
    assert "posé leurs calames" in result["error"]
    stats = json.loads(conn.execute("SELECT stats_json FROM online_work WHERE id = 'w'").fetchone()[0])
    assert stats["pages_ok"] == 3 and stats["stopped_early"] is True


def test_refresh_reports_a_timeout_when_the_budget_is_spent_before_any_page(settings):
    # The budget is exhausted before even the first page is attempted: no chunks, a clear (not
    # "(None)") error, and the fetcher is never called.
    clock = _FakeClock()
    fetcher = _SlowPages(clock, seconds_per_page=1.0)
    work = Work(id="w", title="T", author="A", author_death=1900, translator=None, translator_death=None,
                source="wikisource", pages=("P1",), ebook_id=None, level_hint="8H", note="")
    conn = connect(settings.data_dir / "budget2.sqlite3")
    migrate(conn)
    result = refresh_work(conn, work, fetcher, _fake_annotate, load_lexicon(settings.content_dir),
                           fetch_budget_s=0.0, clock=clock)
    assert fetcher.calls == 0
    assert result["status"] == "error" and result["chunk_count"] == 0
    assert "délai dépassé" in result["error"]


# --- Fix round 4: adopt/refresh are atomic against each other (two players, or two e2e workers) ---

class _ThreeChunks:
    def wikisource_page(self, title):
        return '<div class="mw-parser-output">' + f"<p>{PROSE * 2}</p>" * 3 + "</div>"


def _fake_annotate(body):
    return {"version": 3, "tokens": [], "chains": [], "sentences": []}


_WORK = Work(id="w", title="T", author="A", author_death=1900, translator=None, translator_death=None,
             source="wikisource", pages=("P",), ebook_id=None, level_hint="8H", note="")


class _Rows(list):
    def fetchone(self):
        return self[0] if self else None


class _Interleave:
    """Proxy for a sqlite3.Connection: right after the first statement containing `marker` has read
    its rows, runs `other` in a second thread (on its own connection) and gives it `grace` seconds
    to finish before handing the rows back - a deterministic stand-in for another request landing
    between this one's read and its write."""

    def __init__(self, conn, marker, other, grace=0.5):
        self._conn, self._marker, self._other, self._grace = conn, marker, other, grace
        self.thread = None

    def execute(self, sql, params=()):
        cur = self._conn.execute(sql, params)
        if self.thread is not None or self._marker not in sql:
            return cur
        rows = cur.fetchall()
        self.thread = threading.Thread(target=self._other)
        self.thread.start()
        self.thread.join(self._grace)
        return _Rows(rows)

    def __getattr__(self, name):
        return getattr(self._conn, name)


def _db_with_chunks(tmp_path, settings):
    path = tmp_path / "race.sqlite3"
    conn = connect(path)
    migrate(conn)
    lexicon = load_lexicon(settings.content_dir)
    assert refresh_work(conn, _WORK, _ThreeChunks(), _fake_annotate, lexicon)["chunk_count"] >= 1
    conn.execute("INSERT INTO profile(name, level, created_at) VALUES ('P', '8H', 'now')")
    conn.commit()
    return path, conn, lexicon


def test_two_concurrent_adopts_of_one_chunk_create_a_single_text(tmp_path, settings):
    # Two players adopting the same scroll at once used to both read text_id NULL, both INSERT a
    # text and both get 201: a duplicate adoption (the passage offered twice), and one of the two
    # texts silently unlinked from its scroll. The read now happens under the write lock.
    path, conn, _ = _db_with_chunks(tmp_path, settings)
    chunk_id = conn.execute("SELECT id FROM online_chunk ORDER BY seq LIMIT 1").fetchone()[0]
    results = []

    def other():
        c = connect(path)
        row, created = adopt_chunk(c, chunk_id, 1, [_WORK])
        results.append((row["id"], created))
        c.close()

    spy = _Interleave(conn, "SELECT * FROM online_chunk WHERE id", other)
    row, created = adopt_chunk(spy, chunk_id, 1, [_WORK])
    spy.thread.join(10)
    results.append((row["id"], created))
    assert sorted(c for _, c in results) == [False, True]
    assert len({text_id for text_id, _ in results}) == 1
    assert conn.execute("SELECT COUNT(*) FROM text").fetchone()[0] == 1


def test_an_adopt_during_a_refresh_keeps_its_link(tmp_path, settings):
    # refresh_work read the adopted links, then rewrote every chunk row from that snapshot: an adopt
    # (or a text deletion) landing in between was silently undone (link reset to NULL, the passage
    # offered again) or wrote back a deleted text's id (foreign key failure, a 500 on refresh). The
    # snapshot is now read under the write lock.
    path, conn, lexicon = _db_with_chunks(tmp_path, settings)
    chunk_id = conn.execute("SELECT id FROM online_chunk ORDER BY seq LIMIT 1").fetchone()[0]
    adopted = []

    def other():
        c = connect(path)
        row, created = adopt_chunk(c, chunk_id, 1, [_WORK])
        adopted.append((row["id"], created))
        c.close()

    spy = _Interleave(conn, "SELECT body, text_id FROM online_chunk", other)
    assert refresh_work(spy, _WORK, _ThreeChunks(), _fake_annotate, lexicon)["status"] == "ok"
    spy.thread.join(10)
    assert adopted and adopted[0][1] is True
    assert conn.execute("SELECT text_id FROM online_chunk WHERE id = ?", (chunk_id,)).fetchone()[0] == adopted[0][0]


def test_a_text_deleted_during_a_refresh_does_not_break_it(tmp_path, settings):
    path, conn, lexicon = _db_with_chunks(tmp_path, settings)
    chunk_id = conn.execute("SELECT id FROM online_chunk ORDER BY seq LIMIT 1").fetchone()[0]
    text_id = adopt_chunk(conn, chunk_id, 1, [_WORK])[0]["id"]

    def other():
        c = connect(path)
        c.execute("DELETE FROM text WHERE id = ?", (text_id,))
        c.commit()
        c.close()

    spy = _Interleave(conn, "SELECT body, text_id FROM online_chunk", other)
    assert refresh_work(spy, _WORK, _ThreeChunks(), _fake_annotate, lexicon)["status"] == "ok"
    spy.thread.join(10)
    assert conn.execute("SELECT text_id FROM online_chunk WHERE id = ?", (chunk_id,)).fetchone()[0] is None
