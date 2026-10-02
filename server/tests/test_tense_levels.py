"""Where the verb-tense rule applies (app.nlp.tenses): every text's stored level, at every source
(the pupitre, the lens, the seed, the Bibliothèque d'Alexandrie), existing texts re-levelled at
start-up (migration 009 keeps each text's own level in base_level), and the reason the API shows."""
import json
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import DB_FILENAME, connect, migrate
from app.main import create_app
from app.nlp.annotate import annotate
from app.nlp.homophones import load_homophones
from app.relevel import relevel_texts
from app.world.quests import recommend_texts

CONTENT = Path(__file__).resolve().parents[2] / "content"

PASSE_SIMPLE = ("Le loup regarda la chèvre et partit dans la forêt. Les enfants furent surpris et rentrèrent "
                "chez eux. La nuit tombait sur le village.")
PRESENT = "Le chat dort près du feu. Les enfants jouent dans la cour et la pluie tombe doucement."
SUBJ_IMPARFAIT = "Il fallait qu'il fût là avant l'aube, car le roi voulait qu'il montât dans son carrosse."

INSERT_TEXT = ("INSERT INTO text(title, body, source, level, annotation_json, created_at) "
               "VALUES (?, ?, 'custom', ?, ?, 'now')")


@pytest.fixture(scope="module")
def annotate_fn(nlp, lexicon):
    homophones = load_homophones(CONTENT)
    return lambda body: annotate(body, nlp, homophones, lexicon)


def test_migration_009_keeps_each_texts_own_level(tmp_path):
    conn = connect(tmp_path / "db.sqlite3")
    migrate(conn, upto=8)
    conn.execute(INSERT_TEXT, ("Vieux", PASSE_SIMPLE, "6H", "{}"))
    conn.commit()
    migrate(conn)
    row = conn.execute("SELECT level, base_level, tenses_json FROM text").fetchone()
    assert (row["level"], row["base_level"], row["tenses_json"]) == ("6H", "6H", "{}")
    for table in ("text", "online_chunk"):
        cols = {r["name"]: r for r in conn.execute(f"PRAGMA table_info({table})")}
        assert cols["base_level"]["notnull"] == 1 and cols["tenses_json"]["notnull"] == 1
    # A row written without a base_level (an older writer) takes its level: never empty, never NULL.
    conn.execute(INSERT_TEXT, ("Neuf", PRESENT, "7H", "{}"))
    conn.execute("INSERT INTO online_work(id, status, fetched_at) VALUES ('w', 'ok', 'now')")
    conn.execute("INSERT INTO online_chunk(work_id, seq, body, word_count, level, score) VALUES ('w', 1, 'x', 1, '9H', 1)")
    assert conn.execute("SELECT base_level FROM text WHERE title = 'Neuf'").fetchone()[0] == "7H"
    assert conn.execute("SELECT base_level FROM online_chunk").fetchone()[0] == "9H"
    conn.execute("INSERT INTO text(title, body, source, level, base_level, created_at) "
                 "VALUES ('Mien', 'x', 'custom', '8H', '6H', 'now')")
    assert conn.execute("SELECT base_level FROM text WHERE title = 'Mien'").fetchone()[0] == "6H"


def test_relevel_raises_existing_texts_from_their_annotation(tmp_path, annotate_fn, lexicon):
    conn = connect(tmp_path / "db.sqlite3")
    migrate(conn, upto=8)
    for title, body, level in (("Loup", PASSE_SIMPLE, "5H"), ("Chat", PRESENT, "5H"),
                               ("Haut", PASSE_SIMPLE, "10H"), ("Roi", SUBJ_IMPARFAIT, "9H")):
        conn.execute(INSERT_TEXT, (title, body, level, json.dumps(annotate_fn(body))))
    conn.commit()
    migrate(conn)
    assert relevel_texts(conn, lexicon) == 2
    rows = {r["title"]: r for r in conn.execute("SELECT title, level, base_level, tenses_json FROM text")}
    assert (rows["Loup"]["level"], rows["Loup"]["base_level"]) == ("8H", "5H")
    assert json.loads(rows["Loup"]["tenses_json"]) == {"passe_simple_3": 4}
    assert rows["Chat"]["level"] == "5H"
    # Set by hand above the rule: never lowered.
    assert (rows["Haut"]["level"], rows["Haut"]["base_level"]) == ("10H", "10H")
    assert rows["Roi"]["level"] == "11H"
    # Idempotent, and the stored counts are kept.
    assert relevel_texts(conn, lexicon) == 0


def test_relevel_follows_the_rule_both_ways_from_the_texts_own_level(tmp_path, lexicon):
    """A level the rule raised comes back down to the text's own level when its annotation no longer
    holds the tense (a re-annotation, a better reading), never below that own level."""
    conn = connect(tmp_path / "db.sqlite3")
    migrate(conn)
    conn.execute("INSERT INTO text(title, body, source, level, base_level, tenses_json, annotation_json, created_at) "
                 "VALUES ('t', 'Il dort.', 'custom', '8H', '6H', '{\"passe_simple_3\": 1}', '{\"tokens\": []}', 'now')")
    conn.commit()
    assert relevel_texts(conn, lexicon) == 1
    assert tuple(conn.execute("SELECT level, base_level, tenses_json FROM text").fetchone()) == ("6H", "6H", "{}")


def test_relevel_covers_the_alexandria_cache(tmp_path, annotate_fn, lexicon):
    conn = connect(tmp_path / "db.sqlite3")
    migrate(conn, upto=8)
    conn.execute("INSERT INTO online_work(id, status, fetched_at) VALUES ('w', 'ok', 'now')")
    conn.execute("INSERT INTO online_chunk(work_id, seq, body, word_count, level, score, annotation_json) "
                 "VALUES ('w', 1, ?, 20, '6H', 1.0, ?)", (PASSE_SIMPLE, json.dumps(annotate_fn(PASSE_SIMPLE))))
    conn.commit()
    migrate(conn)
    assert relevel_texts(conn, lexicon) == 1
    row = conn.execute("SELECT level, base_level FROM online_chunk").fetchone()
    assert tuple(row) == ("8H", "6H")


@pytest.mark.parametrize("seed_on_startup", [True, False])
def test_startup_relevels_existing_texts(settings, annotate_fn, seed_on_startup):
    """At every start-up, with or without DISCORDE_SEED: the re-levelling needs no spaCy."""
    conn = connect(settings.data_dir / DB_FILENAME)
    migrate(conn, upto=8)
    conn.execute(INSERT_TEXT, ("Loup", PASSE_SIMPLE, "5H", json.dumps(annotate_fn(PASSE_SIMPLE))))
    conn.commit()
    conn.close()
    with TestClient(create_app(replace(settings, seed_on_startup=seed_on_startup))) as c:
        t = next(t for t in c.get("/api/texts").json() if t["title"] == "Loup")
    assert t["level"] == "8H" and t["tense_reason"] == "passé simple"


def test_pupitre_text_is_levelled_by_its_tenses(client):
    p = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "6H"}).json()
    r = client.post("/api/texts", json={"title": "Le loup", "body": PASSE_SIMPLE, "level": "5H", "source": "custom",
                                        "added_by_profile_id": p["id"]})
    assert r.status_code == 201, r.text
    assert r.json()["level"] == "8H" and r.json()["tense_reason"] == "passé simple"
    r = client.post("/api/texts", json={"title": "Le chat", "body": PRESENT, "level": "5H", "source": "custom"})
    assert r.json()["level"] == "5H" and r.json()["tense_reason"] is None
    # Chosen above the rule: kept, and no reason to show.
    r = client.post("/api/texts", json={"title": "Haut", "body": PASSE_SIMPLE, "level": "10H", "source": "custom"})
    assert r.json()["level"] == "10H" and r.json()["tense_reason"] is None
    listed = {t["title"]: t for t in client.get("/api/texts").json()}
    assert listed["Le loup"]["tense_reason"] == "passé simple" and listed["Le chat"]["tense_reason"] is None


def test_seed_import_levels_by_tenses(tmp_path, annotate_fn, lexicon):
    from app.seed import import_seed
    seed = tmp_path / "content" / "seed"
    seed.mkdir(parents=True)
    (seed / "001-loup.json").write_text(json.dumps({"title": "Loup", "level": "5H", "body": PASSE_SIMPLE}),
                                         encoding="utf-8")
    conn = connect(tmp_path / "db.sqlite3")
    migrate(conn)
    assert import_seed(conn, tmp_path / "content", annotate_fn, lexicon) == 1
    row = conn.execute("SELECT level, base_level FROM text").fetchone()
    assert tuple(row) == ("8H", "5H")


def test_alexandria_scrolls_carry_the_rule_and_the_adopted_text_keeps_it(settings):
    with TestClient(create_app(settings)) as client:
        assert client.post("/api/alexandria/works/verne-vingt-mille-lieues/refresh").json()["status"] == "ok"
        conn = connect(settings.data_dir / DB_FILENAME)
        rows = conn.execute("SELECT id, level, base_level, tenses_json FROM online_chunk").fetchall()
        assert rows and all(r["base_level"] is not None for r in rows)
        from app.levels import level_index
        from app.nlp.tenses import level_with_tenses
        assert all(r["level"] == level_with_tenses(r["base_level"], json.loads(r["tenses_json"])) for r in rows)
        conn.close()
        chunks = client.get("/api/alexandria/works/verne-vingt-mille-lieues/chunks").json()
        assert all("tense_reason" in c for c in chunks)
        p = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H"}).json()
        chunk = chunks[0]
        t = client.post(f"/api/alexandria/chunks/{chunk['id']}/adopt", json={"profile_id": p["id"]}).json()
        assert t["level"] == chunk["level"] and t["tense_reason"] == chunk["tense_reason"]
        assert level_index(t["level"]) >= level_index("9H")


def test_a_fight_with_no_text_at_her_class_takes_one_in_tenses_she_knows(tmp_path):
    from app.routers.world import _pick_boss_text
    conn = connect(tmp_path / "db.sqlite3")
    migrate(conn)
    long_body = " ".join(["mot"] * 200)
    for title, level, base, tenses in (("Plus long, passé simple", "8H", "6H", '{"passe_simple_3": 3}'),
                                       ("Présent", "8H", "8H", "{}")):
        conn.execute("INSERT INTO text(title, body, source, level, base_level, tenses_json, created_at) "
                     "VALUES (?, ?, 'custom', ?, ?, ?, 'now')",
                     (title, long_body + (" encore" * 20 if "long" in title else ""), level, base, tenses))
    conn.commit()
    chosen = _pick_boss_text(conn, {"id": 1, "level": "7H"})
    assert conn.execute("SELECT title FROM text WHERE id = ?", (chosen,)).fetchone()[0] == "Présent"


def _fight_text(tmp_path, hero_level: str, texts: tuple) -> str:
    from app.routers.world import _pick_boss_text
    conn = connect(tmp_path / "db.sqlite3")
    migrate(conn)
    for title, level, words in texts:
        conn.execute("INSERT INTO text(title, body, source, level, created_at) VALUES (?, ?, 'custom', ?, 'now')",
                     (title, " ".join(["mot"] * words), level))
    conn.commit()
    chosen = _pick_boss_text(conn, {"id": 1, "level": hero_level})
    return conn.execute("SELECT title FROM text WHERE id = ?", (chosen,)).fetchone()[0]


def test_a_5h_fight_with_nothing_at_her_class_takes_the_nearest_class_not_the_longest(tmp_path):
    # Nothing at 5H (nor below): the nearest class above wins over a longer 11H text.
    assert _fight_text(tmp_path, "5H", (("11H, très long", "11H", 400), ("8H", "8H", 160),
                                        ("6H", "6H", 150), ("6H trop court", "6H", 100))) == "6H"


def test_a_fight_prefers_her_class_or_below_then_the_nearest_above(tmp_path):
    # A 9H hero with nothing at 9H or 8H: 7H (at or below, nearest) before 10H (above), whatever the length.
    assert _fight_text(tmp_path, "9H", (("10H long", "10H", 300), ("7H", "7H", 160), ("5H", "5H", 200))) == "7H"


def test_quests_never_recommend_a_text_whose_tenses_the_player_has_not_learnt():
    rows = [{"id": 1, "title": "passé simple", "level": "8H", "tense_level": "8H", "word_count": 100, "density": 9.0},
            {"id": 2, "title": "présent", "level": "8H", "tense_level": None, "word_count": 100, "density": 5.0},
            {"id": 3, "title": "à sa classe", "level": "7H", "tense_level": "7H", "word_count": 100, "density": 4.0}]
    assert [r["id"] for r in recommend_texts(rows, "hydre", "7H", played=set(), n=3)] == [2, 3]
