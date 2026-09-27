import io
import threading
import time

import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from app.audio import stub_ms
from app.main import MAX_PREPARE_LINES, create_app
from tests.conftest import SpyEngine, wait_ready


def test_health_says_ready_and_names_its_engine(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ready", "engine": "stub"}


def test_speak_returns_a_silent_mp3_as_long_as_the_line(client):
    text = "Un matin, virgule, l'œuf se fendit. Point."
    for speed in (1.0, 0.75):
        r = client.post("/speak", json={"text": text, "speed": speed})
        assert r.status_code == 200
        assert r.headers["content-type"] == "audio/mpeg"
        info = sf.info(io.BytesIO(r.content))
        assert info.samplerate == 24000 and info.channels == 1
        assert abs(info.duration * 1000 - stub_ms(text, speed)) <= 150


def test_a_line_is_made_once_then_served_from_the_cache(config):
    spy = SpyEngine()
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:
        wait_ready(c)
        a = c.post("/speak", json={"text": "Un matin. Point.", "speed": 0.9}).content
        b = c.post("/speak", json={"text": "Un matin. Point.", "speed": 0.9}).content
    assert a == b and spy.said == [("Un matin. Point.", 0.9)]
    assert len(list(config.cache_dir.glob("*.mp3"))) == 1
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:   # a restart keeps the cache
        wait_ready(c)
        c.post("/speak", json={"text": "Un matin. Point.", "speed": 0.9})
    assert len(spy.said) == 1


def test_prepare_queues_the_lines_in_order(config):
    spy = SpyEngine(ms=50)
    lines = [{"text": f"Phrase {i}. Point.", "speed": 0.85} for i in range(3)]
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:
        wait_ready(c)
        r = c.post("/prepare", json={"lines": lines})
        assert r.status_code == 202 and r.json() == {"queued": 3}
        for line in lines:   # each one is cached once made: /speak then needs no new synthesis
            assert c.post("/speak", json=line).status_code == 200
    assert [t for t, _ in spy.said] == [line["text"] for line in lines]


def test_respelling_and_plain_spaces_reach_the_voice(config):
    config.respell_path.write_text('{"Seguin": "Segin"}', encoding="utf-8")
    spy = SpyEngine(ms=50)
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:
        wait_ready(c)
        c.post("/speak", json={"text": "Bonjour ! monsieur Seguin. Point.", "speed": 1.0})
    assert spy.said == [("Bonjour ! monsieur Segin. Point.", 1.0)]


@pytest.mark.parametrize("body", [
    {"text": "", "speed": 1.0}, {"text": "   ", "speed": 1.0}, {"text": "a" * 10_001, "speed": 1.0},
    {"text": "a", "speed": 0.49}, {"text": "a", "speed": 1.51}, {"text": "a"}, {"speed": 1.0},
])
def test_speak_refuses_what_it_cannot_say(client, body):
    assert client.post("/speak", json=body).status_code == 422


def test_the_limits_themselves_are_accepted(config):
    # Review Focus 1: pace 4's full reading of a long text is one line of several thousand characters.
    spy = SpyEngine(ms=50)
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:
        wait_ready(c)
        for body in ({"text": "a" * 10_000, "speed": 1.0}, {"text": "a", "speed": 0.5}, {"text": "a", "speed": 1.5}):
            assert c.post("/speak", json=body).status_code == 200


def test_prepare_refuses_a_bad_line_or_too_many(client):
    assert client.post("/prepare", json={"lines": [{"text": "a", "speed": 2.0}]}).status_code == 422
    many = [{"text": f"l{i}", "speed": 1.0} for i in range(MAX_PREPARE_LINES + 1)]
    assert client.post("/prepare", json={"lines": many}).status_code == 422


def test_a_voice_still_loading_answers_503(config):
    gate = threading.Event()

    def slow_factory(c):
        gate.wait(5)
        return SpyEngine(ms=50)

    with TestClient(create_app(config, engine_factory=slow_factory)) as c:
        r = c.get("/health")
        assert r.status_code == 503 and r.json() == {"status": "loading"}
        assert c.post("/speak", json={"text": "a", "speed": 1.0}).status_code == 503
        assert c.post("/prepare", json={"lines": []}).status_code == 503
        gate.set()
        wait_ready(c)
        assert c.post("/speak", json={"text": "a", "speed": 1.0}).status_code == 200


def test_a_voice_that_cannot_load_says_so(config):
    def broken(c):
        raise RuntimeError("no model here")

    with TestClient(create_app(config, engine_factory=broken)) as c:
        end = time.monotonic() + 10.0   # the factory fails at once: poll as wait_ready does, bounded
        r = c.get("/health")
        while r.json()["status"] == "loading" and time.monotonic() < end:
            time.sleep(0.02)
            r = c.get("/health")
        assert r.status_code == 503
        assert r.json() == {"status": "error", "detail": "RuntimeError: no model here"}


def test_a_line_that_fails_is_a_500_and_is_tried_again_next_time(config):
    spy = SpyEngine(ms=50, fail=1)
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:
        wait_ready(c)
        assert c.post("/speak", json={"text": "a", "speed": 1.0}).status_code == 500
        assert c.post("/speak", json={"text": "a", "speed": 1.0}).status_code == 200


def test_a_voice_whose_worker_stopped_is_not_ready(config):
    spy = SpyEngine(ms=50)
    with TestClient(create_app(config, engine_factory=lambda c: spy)) as c:
        wait_ready(c)
        c.app.state.worker.stop()
        r = c.get("/health")
        assert r.status_code == 503
        assert r.json() == {"status": "error", "detail": "the voice's worker stopped"}
        assert c.post("/speak", json={"text": "a", "speed": 1.0}).status_code == 503
        assert c.post("/prepare", json={"lines": [{"text": "a", "speed": 1.0}]}).status_code == 503
    assert spy.said == []
