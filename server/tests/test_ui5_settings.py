"""UI5: the hero's audio channels and seen tours ride in the free-form settings, merged key by key."""


def test_audio_and_tours_round_trip_and_merge(client):
    pid = client.post("/api/profiles", json={"name": "Io", "avatar": "chouette", "level": "10H"}).json()["id"]
    audio = {"music": {"volume": 0.4, "muted": False}, "sfx": {"volume": 0.7, "muted": True}, "voice": {"volume": 1, "muted": False}}
    assert client.patch(f"/api/profiles/{pid}", json={"settings": {"audio": audio}}).status_code == 200
    assert client.patch(f"/api/profiles/{pid}", json={"settings": {"tours": ["camp"], "onboarded": True}}).status_code == 200
    s = client.get(f"/api/profiles/{pid}").json()["settings"]
    assert s["audio"] == audio and s["tours"] == ["camp"] and s["onboarded"] is True
    audio2 = {**audio, "music": {"volume": 0.1, "muted": True}}
    assert client.patch(f"/api/profiles/{pid}", json={"settings": {"audio": audio2}}).status_code == 200
    assert client.get(f"/api/profiles/{pid}").json()["settings"]["audio"] == audio2
