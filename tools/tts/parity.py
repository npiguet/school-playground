"""Kokoro ONNX parity proof (spec 2026-09-27-kokoro-voice-design §4.1, plan Task 1): kokoro-onnx against
the PyTorch kokoro package (the build the user listened to in the bake-off) on the bake-off lines. Runs
in tools/tts/parity/'s container (run_docker.sh parity), never on the host.

For each line: the phonemes each build makes (compared over the model's vocabulary), the audio length,
and a spectral similarity against the PyTorch render. Kokoro's decoder draws noise, so PyTorch is not
even identical to itself: the similarity of two PyTorch renders with different seeds is the noise floor,
and ONNX passes when it is as close to PyTorch as PyTorch is to itself (within SIM_MARGIN).

Verdicts:
- onnx: every line's phonemes equal and its audio passes -> the service runs kokoro-onnx with its own
  phonemiser;
- onnx-misaki: some phonemes differ, but ONNX fed PyTorch's own phonemes (misaki's espeak G2P) passes on
  every line -> the service runs kokoro-onnx on misaki's phonemes;
- onnx-direct: kokoro-onnx fails either way, but the same ONNX model called through onnxruntime directly
  (DirectKokoro below: misaki's phonemes, PyTorch's style row pack[len(ps)-1]) passes on every line, its
  phonemes equal too -> the service runs DirectKokoro, no PyTorch and no kokoro-onnx (controller ruling,
  Task 1 fix round 1: kokoro-onnx 0.4.9 takes the style row voice[len(tokens)], one row further);
- torch: otherwise -> the service runs the PyTorch CPU build.

Writes assets/tts-bakeoff/parity/<build>-<line>.wav (for listening; not committed) and
tools/tts/parity.json (committed)."""
from __future__ import annotations

import hashlib
import importlib.metadata as md
import json
import os
import re
import time
import urllib.request
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/tts-bakeoff/parity"
CACHE = Path(os.environ.get("TTS_CACHE", "/cache"))
THREADS = int(os.environ.get("TTS_THREADS", "4"))
SR = 24000
VOICE = "ff_siwis"
ONNX_BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
ONNX_FILES = ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
HF_REPO = "hexgrad/Kokoro-82M"
# A commit, not `main`: the files (and the URLs parity.json records for tts/Dockerfile) cannot move.
HF_REVISION = "f3ff3571791e39611d31c381e3a41a3af07b4987"
HF_FILES = ["kokoro-v1_0.pth", "config.json", "voices/ff_siwis.pt"]
MAX_LEN_DIFF_S = 0.05      # or MAX_LEN_DIFF_REL of the PyTorch length, whichever is larger
MAX_LEN_DIFF_REL = 0.02
SIM_MARGIN = 0.02
SIM_FLOOR_CAP = 0.97       # a floor above this (a deterministic decoder) is capped here


def lines() -> list[dict]:
    r1 = json.loads((ROOT / "tools/tts/lines.json").read_text(encoding="utf-8"))
    r2 = json.loads((ROOT / "tools/tts/round2.json").read_text(encoding="utf-8"))
    out = [{"id": k, "text": v["spoken"], "speed": 1.0} for k, v in r1["lines"].items()]
    out.append({"id": "a-slow", "text": r1["lines"]["a"]["spoken"], "speed": r1["slowRate"]})
    for k, s in r2["sentences"].items():
        out.append({"id": f"r2-{k}-C", "text": s["variants"]["C"], "speed": 1.0})
    for pace in r2["paces"]:
        out.append({"id": f"r2-a-C-{pace}", "text": r2["sentences"]["a"]["variants"]["C"], "speed": pace})
    return out


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with p.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def download(url: str, dest: Path) -> Path:
    if not dest.is_file():
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"  fetching {url}", flush=True)
        req = urllib.request.Request(url, headers={"User-Agent": "discorde-tts-parity"})
        with urllib.request.urlopen(req, timeout=600) as r:
            tmp = dest.with_suffix(dest.suffix + ".part")
            tmp.write_bytes(r.read())
            tmp.rename(dest)
    return dest


def write_wav(path: Path, audio: np.ndarray) -> None:
    a = np.clip(np.asarray(audio, dtype=np.float32).reshape(-1), -1.0, 1.0)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((a * 32767).astype("<i2").tobytes())


def logspec(x: np.ndarray) -> np.ndarray:
    n, hop = 1024, 256
    x = np.asarray(x, dtype=np.float32)
    if len(x) < n:
        x = np.pad(x, (0, n - len(x)))
    frames = 1 + (len(x) - n) // hop
    idx = np.arange(n)[None, :] + hop * np.arange(frames)[:, None]
    mag = np.abs(np.fft.rfft(x[idx] * np.hanning(n).astype(np.float32), axis=1))
    return np.log(mag + 1e-5)


def similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Mean per-frame correlation of the two log spectrograms, over the shorter length (1 = same)."""
    m = min(len(a), len(b))
    A, B = logspec(a[:m]), logspec(b[:m])
    A = A - A.mean(axis=1, keepdims=True)
    B = B - B.mean(axis=1, keepdims=True)
    num = (A * B).sum(axis=1)
    den = np.sqrt((A * A).sum(axis=1) * (B * B).sum(axis=1)) + 1e-9
    return float((num / den).mean())


def vocab_only(ps: str, vocab) -> str:
    return "".join(c for c in " ".join(ps.split()) if c in vocab)


def torch_build():
    import torch
    from huggingface_hub import snapshot_download
    from kokoro import KModel, KPipeline

    torch.set_num_threads(THREADS)
    local = Path(snapshot_download(HF_REPO, revision=HF_REVISION, allow_patterns=HF_FILES))
    # The pinned snapshot's own files: given paths, KModel and KPipeline fetch nothing from `main`.
    model = KModel(repo_id=HF_REPO, config=str(local / "config.json"), model=str(local / "kokoro-v1_0.pth")).eval()
    pipe = KPipeline(lang_code="f", repo_id=HF_REPO, model=model)
    voice = str(local / f"voices/{VOICE}.pt")

    def synth(text: str, speed: float, seed: int):
        torch.manual_seed(seed)
        audio, ph = [], []
        for r in pipe(text, voice=voice, speed=speed):
            audio.append(r.audio.numpy())
            ph.append(r.phonemes)
        return np.concatenate(audio), ph

    files = {f: {"url": f"https://huggingface.co/{HF_REPO}/resolve/{HF_REVISION}/{f}", "sha256": sha256(local / f),
                 "bytes": (local / f).stat().st_size} for f in HF_FILES}
    return synth, pipe.model.vocab, files, local


def onnx_build():
    import onnxruntime as ort
    from kokoro_onnx import Kokoro

    paths = [download(f"{ONNX_BASE}/{f}", CACHE / "onnx" / f) for f in ONNX_FILES]
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = THREADS
    opts.inter_op_num_threads = 1
    session = ort.InferenceSession(str(paths[0]), sess_options=opts, providers=["CPUExecutionProvider"])
    k = Kokoro.from_session(session, str(paths[1]))

    def from_phonemes(ps: str, speed: float) -> np.ndarray:
        # trim=False: spec §4.1, no silence removed beyond what Kokoro produces. (A kokoro-onnx without a
        # `trim` parameter does not trim: drop the argument then, and say so in the report.)
        audio, sr = k.create(ps, voice=VOICE, speed=speed, lang="fr-fr", is_phonemes=True, trim=False)
        assert sr == SR, sr
        return np.asarray(audio, dtype=np.float32).reshape(-1)

    def synth(text: str, speed: float):
        ps = k.tokenizer.phonemize(text, lang="fr-fr")
        return from_phonemes(ps, speed), ps

    files = {p.name: {"url": f"{ONNX_BASE}/{p.name}", "sha256": sha256(p), "bytes": p.stat().st_size} for p in paths}
    return synth, from_phonemes, files, paths


class DirectKokoro:
    """The onnx-direct build, the reference Task 3 lifts: Kokoro-82M's ONNX export through onnxruntime alone,
    with the PyTorch package's G2P (misaki's espeak, fr-fr), chunking and style row. Needs numpy,
    onnxruntime, misaki (espeak) and three files: kokoro-v1.0.onnx, voices-v1.0.bin (an npz of one
    (510, 1, 256) style pack per voice) and Kokoro-82M's config.json (its "vocab")."""
    CHUNK_CHARS = 400   # kokoro.KPipeline.__call__, non-English lang_code
    MAX_PHONEMES = 510  # the model's context, less the two pad tokens

    def __init__(self, model: Path, voices: Path, config: Path, voice: str, threads: int):
        import onnxruntime as ort
        from misaki import espeak

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = threads
        opts.inter_op_num_threads = 1
        self.session = ort.InferenceSession(str(model), sess_options=opts, providers=["CPUExecutionProvider"])
        with np.load(voices) as packs:
            self.pack = np.asarray(packs[voice], dtype=np.float32)
        self.vocab: dict[str, int] = json.loads(config.read_text(encoding="utf-8"))["vocab"]
        self.g2p = espeak.EspeakG2P(language="fr-fr")

    def phonemes(self, text: str) -> list[str]:
        """kokoro.KPipeline.__call__ for lang_code 'f': lines split at newlines, cut after sentence marks into
        chunks of at most CHUNK_CHARS (a longer sentence stays whole), each phonemised on its own."""
        out = []
        for graphemes in re.split(r"\n+", text.strip()):
            parts = re.split(r"([.!?]+)", graphemes)
            chunks, current = [], ""
            for i in range(0, len(parts), 2):
                sentence = parts[i] + (parts[i + 1] if i + 1 < len(parts) else "")
                if len(current) + len(sentence) <= self.CHUNK_CHARS:
                    current += sentence
                else:
                    chunks.append(current.strip())
                    current = sentence
            chunks.append(current.strip())
            for chunk in filter(None, chunks):
                ps, _ = self.g2p(chunk)
                if ps:
                    # KPipeline truncates the same way, dropping the rest of an over-long sentence: kept here
                    # for parity only. The service's engine (Task 3) must split such a chunk instead.
                    out.append(ps[: self.MAX_PHONEMES])
        return out

    def synth_phonemes(self, ps: str, speed: float) -> np.ndarray:
        ids = [self.vocab[c] for c in ps if c in self.vocab]
        # kokoro.KPipeline.infer's style row, pack[len(ps)-1]; kokoro-onnx 0.4.9 takes voice[len(tokens)].
        style = self.pack[len(ps) - 1]
        audio = self.session.run(None, {"tokens": np.array([[0, *ids, 0]], dtype=np.int64), "style": style,
                                        "speed": np.array([speed], dtype=np.float32)})[0]
        return np.asarray(audio, dtype=np.float32).reshape(-1)

    def synth(self, text: str, speed: float) -> tuple[np.ndarray, list[str]]:
        ps = self.phonemes(text)
        return np.concatenate([self.synth_phonemes(p, speed) for p in ps]), ps


def espeak_ng_version() -> str:
    """The espeak-ng misaki's G2P actually loads (espeakng-loader's bundled library, set by misaki.espeak)."""
    from misaki import espeak  # noqa: F401  (sets phonemizer's library and data path)
    from phonemizer.backend.espeak.wrapper import EspeakWrapper

    return ".".join(map(str, EspeakWrapper().version))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    t_synth, vocab, hf_files, hf_dir = torch_build()
    o_synth, o_from_ph, onnx_files, onnx_paths = onnx_build()
    direct = DirectKokoro(onnx_paths[0], onnx_paths[1], hf_dir / "config.json", VOICE, THREADS)
    t_synth("Bonjour, virgule, les enfants. Point.", 1.0, 0)   # warm-up, not timed
    o_synth("Bonjour, virgule, les enfants. Point.", 1.0)
    direct.synth("Bonjour, virgule, les enfants. Point.", 1.0)
    rows = []
    for line in lines():
        lid, text, speed = line["id"], line["text"], line["speed"]
        t = time.perf_counter(); ta, tph = t_synth(text, speed, 0); t_gen = time.perf_counter() - t
        tb, _ = t_synth(text, speed, 1)
        t = time.perf_counter(); oa, oph = o_synth(text, speed); o_gen = time.perf_counter() - t
        fed = np.concatenate([o_from_ph(p, speed) for p in tph])
        t = time.perf_counter(); da, dph = direct.synth(text, speed); d_gen = time.perf_counter() - t
        for name, audio in (("torch", ta), ("onnx", oa), ("onnx-fed", fed), ("onnx-direct", da)):
            write_wav(OUT / f"{name}-{lid}.wav", audio)
        t_s, o_s, f_s, d_s = len(ta) / SR, len(oa) / SR, len(fed) / SR, len(da) / SR
        tol = max(MAX_LEN_DIFF_S, MAX_LEN_DIFF_REL * t_s)
        floor = similarity(tb, ta)
        need = min(floor, SIM_FLOOR_CAP) - SIM_MARGIN
        row = {
            "id": lid, "speed": speed, "chars": len(text),
            "phonemes_torch": " | ".join(tph), "phonemes_onnx": oph,
            "phonemes_equal": vocab_only(" ".join(tph), vocab) == vocab_only(oph, vocab),
            "torch_s": round(t_s, 3), "onnx_s": round(o_s, 3), "onnx_fed_s": round(f_s, 3),
            "noise_floor": round(floor, 4), "needed": round(need, 4),
            "similarity": round(similarity(oa, ta), 4), "similarity_fed": round(similarity(fed, ta), 4),
            "torch_rtf": round(t_gen / t_s, 3), "onnx_rtf": round(o_gen / o_s, 3),
            "phonemes_direct": " | ".join(dph),
            "phonemes_direct_equal": vocab_only(" ".join(dph), vocab) == vocab_only(" ".join(tph), vocab),
            "direct_s": round(d_s, 3), "similarity_direct": round(similarity(da, ta), 4),
            "direct_rtf": round(d_gen / d_s, 3),
        }
        row["onnx_ok"] = row["phonemes_equal"] and abs(o_s - t_s) <= tol and row["similarity"] >= need
        row["onnx_fed_ok"] = abs(f_s - t_s) <= tol and row["similarity_fed"] >= need
        row["onnx_direct_ok"] = (row["phonemes_direct_equal"] and abs(d_s - t_s) <= tol
                                 and row["similarity_direct"] >= need)
        rows.append(row)
        print(f"  {lid:14} phonemes {'=' if row['phonemes_equal'] else '≠'}/{'=' if row['phonemes_direct_equal'] else '≠'}"
              f"  len {t_s:6.2f}/{o_s:6.2f}/{f_s:6.2f}/{d_s:6.2f} s"
              f"  sim {row['similarity']:.3f}/{row['similarity_fed']:.3f}/{row['similarity_direct']:.3f}"
              f" (need {need:.3f})  ok {row['onnx_ok']}/{row['onnx_fed_ok']}/{row['onnx_direct_ok']}", flush=True)
    if all(r["onnx_ok"] for r in rows):
        verdict = "onnx"
    elif all(r["onnx_fed_ok"] for r in rows):
        verdict = "onnx-misaki"
    elif all(r["onnx_direct_ok"] for r in rows):
        verdict = "onnx-direct"
    else:
        verdict = "torch"
    result = {
        "verdict": verdict,
        "verdict_order": ["onnx", "onnx-misaki", "onnx-direct", "torch"],
        # phonemizer-fork and espeakng-loader decide misaki's phonemes: misaki.espeak points phonemizer at
        # espeakng-loader's own espeak-ng (library and fr data), not the image's Debian one.
        "versions": {**{p: md.version(p) for p in
                        ("torch", "kokoro", "misaki", "kokoro-onnx", "onnxruntime", "soundfile", "numpy",
                         "phonemizer-fork", "espeakng-loader")},
                     "espeak-ng": espeak_ng_version()},
        "threads": THREADS,
        "criteria": {"max_len_diff_s": MAX_LEN_DIFF_S, "max_len_diff_rel": MAX_LEN_DIFF_REL,
                     "sim_margin": SIM_MARGIN, "sim_floor_cap": SIM_FLOOR_CAP},
        # onnx-direct (DirectKokoro) reads files.onnx's two files and files.torch's config.json (the vocab).
        "files": {"onnx": onnx_files, "torch": hf_files},
        "lines": rows,
    }
    (ROOT / "tools/tts/parity.json").write_text(json.dumps(result, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"== verdict: {verdict}", flush=True)


if __name__ == "__main__":
    main()
