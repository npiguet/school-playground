"""The engine seam (Kokoro plan Tasks 2-3): the stub for e2e, or Kokoro (app/kokoro.py, the one module
that knows which Kokoro build runs: tools/tts/parity.json's verdict)."""
from __future__ import annotations

from typing import Protocol

import numpy as np

from app.audio import silence, stub_ms
from app.config import Config


class Engine(Protocol):
    model_id: str  # part of the cache key

    def synth(self, text: str, speed: float) -> np.ndarray:
        """The line, spoken: float32 mono at 24 kHz."""
        ...


class StubEngine:
    """TTS_STUB=1 (e2e only, spec §4.1): silence as long as the line would take, at once, no model."""
    model_id = "stub"

    def synth(self, text: str, speed: float) -> np.ndarray:
        return silence(stub_ms(text, speed))


def load_engine(config: Config) -> Engine:
    if config.stub:
        return StubEngine()
    from app.kokoro import KokoroEngine
    return KokoroEngine(config.model_dir, config.threads)
