import io

import numpy as np
import soundfile as sf

from app.audio import SR, encode_mp3, silence, stub_ms


def test_mp3_is_available():
    assert "MP3" in sf.available_formats()


def test_an_mp3_keeps_the_length_rate_and_single_channel():
    t = np.linspace(0, 2, 2 * SR, endpoint=False, dtype=np.float32)
    info = sf.info(io.BytesIO(encode_mp3(0.3 * np.sin(2 * np.pi * 220 * t))))
    assert info.samplerate == 24000 and info.channels == 1
    assert abs(info.duration - 2.0) <= 0.15


def test_the_stub_takes_as_long_as_the_line_would():
    # web/src/lib/dictation/voice.ts: 65 ms a character, divided by the rate, at least 300 ms.
    assert stub_ms("x" * 100, 1.0) == 6500
    assert stub_ms("x" * 100, 0.75) == round(6500 / 0.75)
    assert stub_ms("abc", 1.0) == 300
    assert len(silence(1500)) == int(1.5 * SR)
