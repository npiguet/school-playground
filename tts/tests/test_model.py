"""The real voice (Kokoro plan Task 3). Needs the model baked into the image: `-m "not model"` skips it."""
import io
from itertools import cycle
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from app.audio import SR, encode_mp3
from app.config import Config
from app.main import create_app
from tests.conftest import wait_ready

pytestmark = pytest.mark.model
LINE = "Un matin, virgule, l'œuf se fendit en craquant. Point."
WORDS = ["le loup", "la bergerie", "un berger", "trois moutons", "la colline", "un chien", "le vent", "la nuit"]


@pytest.fixture(scope="module")
def engine():
    from app.kokoro import KokoroEngine
    return KokoroEngine(Path("/models"), threads=4)


def comma_sentence(chars: int) -> str:
    """One sentence of `chars` characters or more, made only of comma-separated words: no « . ! ? »."""
    words: list[str] = []
    for word in cycle(WORDS):
        words.append(word)
        if len(", ".join(words)) >= chars:
            return ", ".join(words)


def test_one_line_is_real_speech_of_a_plausible_length(engine):
    audio = engine.synth(LINE, 1.0)
    seconds = len(audio) / SR
    assert audio.dtype == np.float32 and audio.ndim == 1
    assert len(LINE) * 0.03 <= seconds <= len(LINE) * 0.15, seconds
    assert float(np.sqrt(np.mean(audio ** 2))) > 0.01   # not silence
    info = sf.info(io.BytesIO(encode_mp3(audio)))
    assert info.samplerate == 24000 and abs(info.duration - seconds) <= 0.15


def test_a_slower_pace_is_a_longer_line(engine):
    assert len(engine.synth(LINE, 0.75)) > len(engine.synth(LINE, 1.0)) * 1.15


def test_a_long_line_is_read_in_segments(engine):
    text = " ".join(["Le loup, virgule, arriva près de la bergerie. Point."] * 8)   # > 300 characters
    audio = engine.synth(text, 1.0)
    assert len(audio) / SR > 8 * 2.0


def test_a_sentence_too_long_for_the_model_is_split_never_cut(engine):
    """Task 3 addendum #3: a chunk over 510 phonemes is split at spaces near its middle; nothing dropped."""
    from app.kokoro import MAX_PHONEMES

    text = comma_sentence(700)
    whole, _ = engine.g2p(text)                   # the sentence's phonemes, in one piece
    assert len(whole) > MAX_PHONEMES              # what truncation would cut
    pieces = engine.phonemes(text)
    assert len(pieces) >= 2 and all(0 < len(p) <= MAX_PHONEMES for p in pieces)
    assert " ".join(pieces) == whole              # every phoneme kept, in order
    audio = engine.synth(text, 1.0)
    seconds = len(audio) / SR
    cut = len(engine.synth_phonemes(whole[:MAX_PHONEMES], 1.0)) / SR   # what the model says of a truncation
    assert seconds >= 0.9 * cut * len(whole) / MAX_PHONEMES, (seconds, cut, len(whole))
    assert len(text) * 0.03 <= seconds <= len(text) * 0.15, seconds


def test_a_line_with_nothing_to_pronounce_is_the_muted_line_s_silence(engine):
    from app.audio import stub_ms

    audio = engine.synth("-", 1.0)
    assert engine.phonemes("-") == [] and len(audio) == SR * stub_ms("-", 1.0) // 1000
    assert sf.info(io.BytesIO(encode_mp3(audio))).duration > 0.2   # a playable MP3, not an empty file


def test_the_service_speaks_with_the_real_voice(tmp_path):
    from app.kokoro import MODEL_ID

    (tmp_path / "respell.json").write_text("{}", encoding="utf-8")
    config = Config(stub=False, threads=4, cache_dir=tmp_path / "cache", cache_mb=64,
                    respell_path=tmp_path / "respell.json", model_dir=Path("/models"))
    with TestClient(create_app(config)) as c:
        wait_ready(c, timeout=120)
        assert c.get("/health").json()["engine"] == MODEL_ID == "kokoro-82m-onnx-direct"
        r = c.post("/speak", json={"text": LINE, "speed": 0.9})
        assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg"
        assert sf.info(io.BytesIO(r.content)).duration > 1.0
