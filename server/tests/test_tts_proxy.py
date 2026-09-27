"""The voice proxy (spec 2026-09-27 §4.2): /api/tts/* in front of the `tts` service."""
import json

import httpx
import pytest

from app.config import Settings


def hero(client) -> int:
    r = client.post("/api/profiles", json={"name": "Voix", "avatar": "chouette", "level": "10H"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def voice(client, handler) -> list[httpx.Request]:
    """Replaces the service with `handler`; returns the requests it receives."""
    seen: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    client.app.state.tts_client.close()   # the lifespan's own; the lifespan closes the replacement
    client.app.state.tts_client = httpx.Client(transport=httpx.MockTransport(record), base_url="http://tts:8000")
    return seen


def mp3(_):
    return httpx.Response(200, content=b"ID3fake", headers={"content-type": "audio/mpeg"})


def down(request):
    raise httpx.ConnectError("no route to tts", request=request)


def test_speak_passes_the_line_to_the_voice_and_the_mp3_back(client):
    seen = voice(client, mp3)
    r = client.post("/api/tts/speak", json={"profile_id": hero(client), "text": "Un matin. Point.", "speed": 0.75})
    assert r.status_code == 200
    assert r.content == b"ID3fake" and r.headers["content-type"] == "audio/mpeg"
    assert [(q.method, q.url.path) for q in seen] == [("POST", "/speak")]
    assert json.loads(seen[0].content) == {"text": "Un matin. Point.", "speed": 0.75}


@pytest.mark.parametrize("status", [422, 500])
def test_the_voice_s_own_answers_pass_through(client, status):
    voice(client, lambda _: httpx.Response(status, json={"detail": "from the voice"}))
    r = client.post("/api/tts/speak", json={"profile_id": hero(client), "text": "x", "speed": 1.0})
    assert r.status_code == status and r.json() == {"detail": "from the voice"}


def test_a_voice_still_loading_is_a_503(client):
    voice(client, lambda _: httpx.Response(503, json={"detail": "the voice is not ready"}))
    r = client.post("/api/tts/speak", json={"profile_id": hero(client), "text": "x", "speed": 1.0})
    assert r.status_code == 503


@pytest.mark.parametrize("error", [httpx.ConnectError, httpx.ReadTimeout])
def test_a_voice_that_cannot_be_reached_is_a_503(client, error):
    def fail(request):
        raise error("down", request=request)

    voice(client, fail)
    pid = hero(client)
    r = client.post("/api/tts/speak", json={"profile_id": pid, "text": "x", "speed": 1.0})
    assert r.status_code == 503 and r.json() == {"detail": "the voice cannot be reached"}
    r = client.post("/api/tts/prepare", json={"profile_id": pid, "lines": []})
    assert r.status_code == 503


def test_speaking_needs_a_hero(client):
    seen = voice(client, mp3)
    assert client.post("/api/tts/speak", json={"profile_id": 999_999, "text": "x", "speed": 1.0}).status_code == 404
    assert client.post("/api/tts/speak", json={"text": "x", "speed": 1.0}).status_code == 422
    assert client.post("/api/tts/prepare", json={"profile_id": 999_999, "lines": []}).status_code == 404
    assert client.post("/api/tts/prepare", json={"lines": []}).status_code == 422
    assert seen == []


def test_prepare_forwards_the_lines_in_order(client):
    seen = voice(client, lambda _: httpx.Response(202, json={"queued": 2}))
    lines = [{"text": "Un. Point.", "speed": 0.9}, {"text": "Deux. Point.", "speed": 0.9}]
    r = client.post("/api/tts/prepare", json={"profile_id": hero(client), "lines": lines})
    assert r.status_code == 202 and r.json() == {"queued": 2}
    assert seen[0].url.path == "/prepare" and json.loads(seen[0].content) == {"lines": lines}


@pytest.mark.parametrize("answer, status, body", [
    (lambda _: httpx.Response(200, json={"status": "ready", "engine": "kokoro-82m-v1.0-onnx"}), 200,
     {"voice": "ready", "engine": "kokoro-82m-v1.0-onnx"}),
    (lambda _: httpx.Response(503, json={"status": "loading"}), 503, {"voice": "loading"}),
    (lambda _: httpx.Response(503, json={"status": "error", "detail": "RuntimeError: x"}), 503, {"voice": "error"}),
    (down, 503, {"voice": "unreachable"}),
])
def test_the_voice_s_health(client, answer, status, body):
    voice(client, answer)
    r = client.get("/api/tts/health")
    assert r.status_code == status and r.json() == body


def test_the_game_s_health_stays_about_the_game(client):
    voice(client, down)
    assert client.get("/api/health").status_code == 200


def test_the_voice_s_address_comes_from_the_environment(monkeypatch):
    assert Settings.from_env().tts_url == "http://tts:8000"
    monkeypatch.setenv("DISCORDE_TTS_URL", "http://voice.lan:9000")
    assert Settings.from_env().tts_url == "http://voice.lan:9000"
