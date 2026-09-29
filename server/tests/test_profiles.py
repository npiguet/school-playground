def test_create_and_list_profile(client):
    r = client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H", "pin": None})
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["name"] == "Léa" and p["level"] == "10H" and p["has_pin"] is False and "help_stage" not in p
    assert "pin_hash" not in p
    assert [x["id"] for x in client.get("/api/profiles").json()] == [p["id"]]


def test_duplicate_name_is_409(client):
    client.post("/api/profiles", json={"name": "Léa", "avatar": "chouette", "level": "10H"})
    assert client.post("/api/profiles", json={"name": "léa", "avatar": "dragon", "level": "8H"}).status_code == 409


def test_validation(client):
    bad = [
        {"name": "", "avatar": "chouette", "level": "10H"},
        {"name": "A", "avatar": "unicorn", "level": "10H"},
        {"name": "A", "avatar": "chouette", "level": "12H"},
        {"name": "A", "avatar": "chouette", "level": "10H", "pin": "12"},
        {"name": "A", "avatar": "chouette", "level": "10H", "pin": "abcd"},
    ]
    for body in bad:
        assert client.post("/api/profiles", json=body).status_code == 422, body


def test_pin_flow(client):
    p = client.post("/api/profiles", json={"name": "Max", "avatar": "dragon", "level": "6H", "pin": "1234"}).json()
    assert p["has_pin"] is True
    assert client.post(f"/api/profiles/{p['id']}/verify-pin", json={"pin": "0000"}).json() == {"ok": False}
    assert client.post(f"/api/profiles/{p['id']}/verify-pin", json={"pin": "1234"}).json() == {"ok": True}
    client.patch(f"/api/profiles/{p['id']}", json={"pin": ""})
    assert client.get(f"/api/profiles/{p['id']}").json()["has_pin"] is False
    assert client.post(f"/api/profiles/{p['id']}/verify-pin", json={"pin": "9999"}).json() == {"ok": True}


def test_patch_settings_and_delete(client):
    p = client.post("/api/profiles", json={"name": "Max", "avatar": "dragon", "level": "6H"}).json()
    r = client.patch(f"/api/profiles/{p['id']}", json={"settings": {"voice": "Thomas"}, "level": "7H"})
    assert r.json()["settings"] == {"voice": "Thomas"} and r.json()["level"] == "7H"
    assert client.delete(f"/api/profiles/{p['id']}").status_code == 204
    assert client.get(f"/api/profiles/{p['id']}").status_code == 404
