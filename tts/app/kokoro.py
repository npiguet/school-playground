"""Kokoro-82M, the one module that knows which build runs (tools/tts/parity.json: verdict "onnx-direct",
Kokoro plan Task 1 and the Task 3 addendum). The model's ONNX export through onnxruntime alone, with the
PyTorch package's own French G2P (misaki's espeak, fr-fr), chunking and style row: tools/tts/parity.py's
DirectKokoro, which matched the PyTorch build the bake-off ran. No PyTorch, no kokoro, no kokoro-onnx.
The model, the voices and the model's config.json (its phoneme vocabulary) are baked into the image
under /models (tts/Dockerfile)."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import numpy as np

from app.audio import silence, stub_ms
from app.text import segments

MODEL_ID = "kokoro-82m-v1.0-onnx-direct"   # /health's engine, and part of every line's cache key
VOICE = "ff_siwis"
CHUNK_CHARS = 400     # kokoro.KPipeline.__call__, non-English lang_code
MAX_PHONEMES = 510    # the model's context, less the two pad tokens
_PAUSES = ",;:.!?"    # a cut just after one of these falls where the voice pauses anyway
_STRESS = "ˈˌ"        # stress marks lead the vowel after them
_LENGTH = "ː"         # the length mark trails the phoneme before it


def _no_space_cut(ps: str) -> int:
    """The middle of a run with no space, moved back so that a phoneme keeps its marks: never before a
    combining mark (the tilde of « ɛ̃ ») or a length mark, never just after a stress mark."""
    cut = len(ps) // 2
    while cut > 1 and (unicodedata.combining(ps[cut]) or ps[cut] in _LENGTH or ps[cut - 1] in _STRESS):
        cut -= 1
    return cut


def split_phonemes(ps: str, limit: int = MAX_PHONEMES) -> list[str]:
    """`ps` in pieces of at most `limit` phonemes, never truncated (Task 3 addendum #3; KPipeline would cut
    the rest of the sentence off). A cut is made at the space nearest the middle, preferably one just after
    a pause or sentence mark in the middle half, and each half is cut again until it fits; the spaces cut
    at are the only phonemes left out, so " ".join(pieces) == ps. A piece with no space at all is cut near
    its middle, between two phonemes (_no_space_cut), and then "".join gives it back."""
    if len(ps) <= limit:
        return [ps]
    n, mid = len(ps), len(ps) // 2
    spaces = [i for i in range(1, n - 1) if ps[i] == " "]
    pauses = [i for i in spaces if ps[i - 1] in _PAUSES and n // 4 <= i <= 3 * n // 4]
    candidates = pauses or spaces
    if candidates:
        cut = min(candidates, key=lambda i: abs(i - mid))
        left, right = ps[:cut], ps[cut + 1:]
    else:
        cut = _no_space_cut(ps)
        left, right = ps[:cut], ps[cut:]
    return split_phonemes(left, limit) + split_phonemes(right, limit)


class KokoroEngine:
    model_id = MODEL_ID

    def __init__(self, model_dir: Path, threads: int):
        import onnxruntime as ort
        from misaki import espeak

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = threads  # TTS_THREADS: the game server stays responsive meanwhile
        opts.inter_op_num_threads = 1
        self._session = ort.InferenceSession(str(model_dir / "kokoro-v1.0.onnx"), sess_options=opts,
                                             providers=["CPUExecutionProvider"])
        with np.load(model_dir / "voices-v1.0.bin") as packs:
            self._pack = np.asarray(packs[VOICE], dtype=np.float32)   # (510, 1, 256): a style row per length
        self._vocab: dict[str, int] = json.loads((model_dir / "config.json").read_text(encoding="utf-8"))["vocab"]
        self.g2p = espeak.EspeakG2P(language="fr-fr")   # the PyTorch package's G2P for lang_code 'f'

    def phonemes(self, text: str) -> list[str]:
        """kokoro.KPipeline.__call__ for lang_code 'f': lines split at newlines, cut after sentence marks into
        chunks of at most CHUNK_CHARS (a longer sentence stays whole), each phonemised on its own; then, where
        KPipeline truncates a chunk to MAX_PHONEMES, split_phonemes cuts it into pieces instead."""
        out: list[str] = []
        for graphemes in re.split(r"\n+", text.strip()):
            parts = re.split(r"([.!?]+)", graphemes)
            chunks, current = [], ""
            for i in range(0, len(parts), 2):
                sentence = parts[i] + (parts[i + 1] if i + 1 < len(parts) else "")
                if len(current) + len(sentence) <= CHUNK_CHARS:
                    current += sentence
                else:
                    chunks.append(current.strip())
                    current = sentence
            chunks.append(current.strip())
            for chunk in filter(None, chunks):
                ps, _ = self.g2p(chunk)
                if ps:
                    out.extend(split_phonemes(ps))
        return out

    def synth_phonemes(self, ps: str, speed: float) -> np.ndarray:
        """One piece of at most MAX_PHONEMES, spoken: kokoro.KPipeline.infer's call, style row pack[len(ps)-1]."""
        ids = [self._vocab[c] for c in ps if c in self._vocab]   # KModel drops what is not in its vocabulary
        audio = self._session.run(None, {"tokens": np.array([[0, *ids, 0]], dtype=np.int64),
                                         "style": self._pack[len(ps) - 1],
                                         "speed": np.array([speed], dtype=np.float32)})[0]
        return np.asarray(audio, dtype=np.float32).reshape(-1)

    def synth(self, text: str, speed: float) -> np.ndarray:
        # No silence trimmed or added (spec §4.1): the pieces are joined as the model made them.
        parts = [self.synth_phonemes(ps, speed) for segment in segments(text) for ps in self.phonemes(segment)]
        if not parts:
            # Nothing the G2P can pronounce (« - » or « / » alone): an empty MP3 would not play, so the line is
            # the silence the game waits for a muted line (app/audio.py stub_ms, voice.ts speechMs).
            return silence(stub_ms(text, speed))
        return np.concatenate(parts)
