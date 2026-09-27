import time

import pytest
from fastapi.testclient import TestClient

from app.audio import silence, stub_ms
from app.config import Config
from app.main import create_app


@pytest.fixture
def config(tmp_path):
    (tmp_path / "respell.json").write_text("{}", encoding="utf-8")
    return Config(stub=True, threads=1, cache_dir=tmp_path / "cache", cache_mb=64,
                  respell_path=tmp_path / "respell.json", model_dir=tmp_path / "models")


def wait_ready(client, timeout: float = 10.0) -> None:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if client.get("/health").status_code == 200:
            return
        time.sleep(0.02)
    raise AssertionError(f"the voice never got ready: {client.get('/health').json()}")


class SpyEngine:
    """Says silence like the stub, and writes down what it was given."""
    model_id = "spy"

    def __init__(self, ms: int | None = None, fail: int = 0):
        self.said: list[tuple[str, float]] = []
        self.ms = ms
        self.fail = fail

    def synth(self, text: str, speed: float):
        self.said.append((text, speed))
        if self.fail:
            self.fail -= 1
            raise RuntimeError("the model tripped")
        return silence(self.ms if self.ms is not None else stub_ms(text, speed))


@pytest.fixture
def client(config):
    with TestClient(create_app(config)) as c:
        wait_ready(c)
        yield c
