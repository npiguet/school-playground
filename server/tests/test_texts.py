FEES = "Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent."


def make_profile(client, name="Léa", level="10H"):
    return client.post("/api/profiles", json={"name": name, "avatar": "chouette", "level": level}).json()


def test_create_custom_text_is_annotated(client):
    p = make_profile(client)
    r = client.post("/api/texts", json={"title": "Fées", "body": FEES, "level": "8H", "source": "custom",
                                        "added_by_profile_id": p["id"]})
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["word_count"] == 13 and t["added_by_name"] == "Léa" and t["source"] == "custom"
    assert t["annotation"]["version"] == 2 and len(t["annotation"]["tokens"]) > 10
    assert isinstance(t["annotation"]["chains"], list) and "forms" in t["annotation"]["tokens"][0]
    assert t["history"] is None
    full = client.get(f"/api/texts/{t['id']}").json()
    assert full["body"] == FEES


def test_list_orders_by_level_and_fills_history(client):
    p = make_profile(client)
    a = client.post("/api/texts", json={"title": "A", "body": FEES, "level": "10H", "source": "custom"}).json()
    b = client.post("/api/texts", json={"title": "B", "body": FEES, "level": "6H", "source": "custom"}).json()
    ids = [t["id"] for t in client.get("/api/texts").json()]
    assert ids == [b["id"], a["id"]]
    listed = client.get(f"/api/texts?profile_id={p['id']}").json()
    assert listed[0]["history"] == {"times_played": 0, "best_score": None, "best_catch_rate": None}


def test_validation(client):
    base = {"title": "T", "body": FEES, "level": "8H", "source": "custom"}
    assert client.post("/api/texts", json={**base, "body": "Trop court."}).status_code == 422
    r = client.post("/api/texts", json={**base, "body": "Il y a 3 chats qui dorment ici."})
    assert r.status_code == 422 and "nombres en lettres" in r.text
    assert client.post("/api/texts", json={**base, "source": "seed"}).status_code == 422
    assert client.post("/api/texts", json={**base, "level": "3H"}).status_code == 422


def test_delete_custom_but_not_seed(client, settings):
    t = client.post("/api/texts", json={"title": "T", "body": FEES, "level": "8H", "source": "custom"}).json()
    assert client.delete(f"/api/texts/{t['id']}").status_code == 204
    assert client.get(f"/api/texts/{t['id']}").status_code == 404

    from app.db import connect
    conn = connect(settings.data_dir / "discorde.sqlite3")
    conn.execute(
        "INSERT INTO text(title, body, source, seed_key, level, created_at) "
        "VALUES ('S', 'x y z', 'seed', '999-s', '8H', 'now')"
    )
    conn.commit()
    seed_id = conn.execute("SELECT id FROM text WHERE seed_key = '999-s'").fetchone()[0]
    assert client.delete(f"/api/texts/{seed_id}").status_code == 403


def test_write_then_immediate_read_sees_the_write(client):
    # Regression test: get_db opens a fresh sqlite3 connection per request, so a write
    # must be committed by the writing endpoint itself before returning. Otherwise an
    # immediate read on a different connection can miss it (see app/db.py get_db).
    t = client.post("/api/texts", json={"title": "T", "body": FEES, "level": "8H", "source": "custom"}).json()
    r = client.get(f"/api/texts/{t['id']}")
    assert r.status_code == 200, r.text
    assert r.json()["body"] == FEES


def test_body_over_4000_chars_rejected(client):
    assert client.post("/api/texts", json={"title": "T", "body": "mot " * 1100, "level": "8H", "source": "custom"}).status_code == 422
