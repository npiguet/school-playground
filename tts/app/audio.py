"""Audio out of the voice: MP3, 24 kHz mono (spec 2026-09-27 §4.1), and the stub's silence."""
from __future__ import annotations

import io

import numpy as np
import soundfile as sf

SR = 24000
STUB_MS_PER_CHAR = 65  # web/src/lib/dictation/voice.ts SPEECH_MS_PER_CHAR


def stub_ms(text: str, speed: float) -> int:
    """How long the stub's silence lasts: what the game waits for a muted line (voice.ts speechMs)."""
    return max(300, round(len(text) * STUB_MS_PER_CHAR / speed))


def silence(ms: int) -> np.ndarray:
    return np.zeros(int(SR * ms / 1000), dtype=np.float32)


def encode_mp3(samples: np.ndarray) -> bytes:
    """MP3 through libsndfile (the soundfile wheel bundles one with MPEG support, Ruling K13)."""
    buf = io.BytesIO()
    audio = np.clip(np.asarray(samples, dtype=np.float32).reshape(-1), -1.0, 1.0)
    sf.write(buf, audio, SR, format="MP3", subtype="MPEG_LAYER_III")
    return buf.getvalue()
