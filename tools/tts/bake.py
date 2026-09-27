"""TTS bake-off: speaks tools/tts/lines.json with one candidate engine, on CPU, and records how long
each line took. Runs inside that candidate's container (run_docker.sh), never on the host.

  python tools/tts/bake.py <piper|kokoro|chatterbox|xtts|f5>

Writes assets/tts-bakeoff/<candidate>-<voice>-<line>.wav and assets/tts-bakeoff/results/<candidate>.json.
Lines: a, b1, b2, c at rate 1, and a-slow-native: line a at the game's slowest pace (PACE_RATES[1])
through the engine's own speed control, when it has one. The ffmpeg atempo stretch (a-slow-atempo) is
made afterwards by post.py. Timing: one warm-up synthesis per voice first, then each line once; the
real-time factor is generation time / audio length (below 1 is faster than real time)."""
from __future__ import annotations

import json
import os
import platform
import sys
import time
import urllib.request
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/tts-bakeoff"
CACHE = Path(os.environ.get("TTS_CACHE", "/cache"))
LINES = json.loads((ROOT / "tools/tts/lines.json").read_text(encoding="utf-8"))
SLOW = LINES["slowRate"]
THREADS = int(os.environ.get("TTS_THREADS", "8"))
# Hugging Face commits, not `main`, so the bake-off can be reproduced (final review M9); each was its
# repository's head when the bake-off ran (2026-09-27), as parity.py pins Kokoro's.
PIPER_REVISION = "c10ece1aade47bb51c153c893d14e5bf8e5b7117"      # rhasspy/piper-voices
KOKORO_REVISION = "f3ff3571791e39611d31c381e3a41a3af07b4987"     # hexgrad/Kokoro-82M (parity.py)
F5_REVISION = "bcad6ae266c8406dc572b33d1d6ffced4db114fe"         # RASPIAUDIO/F5-French-MixedSpeakers-reduced


def write_wav(path: Path, audio: np.ndarray, sr: int) -> float:
    audio = np.clip(np.asarray(audio, dtype=np.float32).reshape(-1), -1.0, 1.0)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((audio * 32767).astype("<i2").tobytes())
    return len(audio) / sr


def download(url: str, dest: Path) -> Path:
    if not dest.is_file():
        dest.parent.mkdir(parents=True, exist_ok=True)
        print(f"  fetching {url}", flush=True)
        req = urllib.request.Request(url, headers={"User-Agent": "discorde-tts-bakeoff"})
        with urllib.request.urlopen(req, timeout=600) as r:
            tmp = dest.with_suffix(dest.suffix + ".part")
            tmp.write_bytes(r.read())
            tmp.rename(dest)
    return dest


def size_of(paths) -> int:
    total = 0
    for p in paths:
        p = Path(p)
        total += sum(f.stat().st_size for f in p.rglob("*") if f.is_file()) if p.is_dir() else p.stat().st_size
    return total


def torch_threads() -> None:
    import torch

    torch.set_num_threads(THREADS)


# Every engine returns a list of voices: (voice id, label, synth(text, speed) -> (audio, sr, extra),
# native_speed: bool, model files). `extra` is a dict (phonemes and the like) kept in the results.


def engine_piper():
    from piper import PiperVoice, SynthesisConfig

    base = f"https://huggingface.co/rhasspy/piper-voices/resolve/{PIPER_REVISION}/fr/fr_FR"
    models = [("siwis", "medium"), ("tom", "medium"), ("upmc", "medium"), ("mls", "medium"), ("gilles", "low")]
    # mls-medium has 125 speakers: three spread over the id range (its .onnx.json maps ids to
    # LibriVox reader numbers, no names or genders).
    picks = {"mls": [0, 40, 100]}
    voices = []
    for name, quality in models:
        stem = f"fr_FR-{name}-{quality}"
        onnx = download(f"{base}/{name}/{quality}/{stem}.onnx", CACHE / "piper" / f"{stem}.onnx")
        cfg_path = download(f"{base}/{name}/{quality}/{stem}.onnx.json", CACHE / "piper" / f"{stem}.onnx.json")
        cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        voice = PiperVoice.load(str(onnx))
        sr = voice.config.sample_rate
        base_ls = cfg.get("inference", {}).get("length_scale", 1.0)
        id_map = cfg.get("speaker_id_map") or {}
        if cfg.get("num_speakers", 1) > 1:
            by_id = {v: k for k, v in id_map.items()}
            ids = picks.get(name, sorted(by_id))
            speakers = [(i, by_id.get(i, str(i))) for i in ids]
        else:
            speakers = [(None, None)]
        for sid, sname in speakers:
            vid = f"{name}-{quality}" + (f"-{sname}" if sname is not None else "")

            def synth(text, speed, voice=voice, sid=sid, sr=sr, base_ls=base_ls):
                conf = SynthesisConfig(speaker_id=sid, length_scale=base_ls / speed)
                audio = np.concatenate([c.audio_float_array for c in voice.synthesize(text, syn_config=conf)])
                return audio, sr, {"phonemes": " | ".join("".join(p) for p in voice.phonemize(text))}

            label = f"Piper {stem}" + (f", speaker {sid} ({sname})" if sid is not None else "")
            voices.append((vid, label, synth, True, [onnx, cfg_path]))
    return voices


def engine_kokoro():
    torch_threads()
    from huggingface_hub import snapshot_download
    from kokoro import KModel, KPipeline

    repo = "hexgrad/Kokoro-82M"
    local = Path(snapshot_download(repo, revision=KOKORO_REVISION,
                                   allow_patterns=["kokoro-v1_0.pth", "config.json", "voices/ff_siwis.pt"]))
    # The pinned snapshot's own files: given paths, KModel and KPipeline fetch nothing from `main`.
    model = KModel(repo_id=repo, config=str(local / "config.json"), model=str(local / "kokoro-v1_0.pth")).eval()
    pipe = KPipeline(lang_code="f", repo_id=repo, model=model)
    voice = str(local / "voices/ff_siwis.pt")

    def synth(text, speed):
        audio, phonemes = [], []
        for result in pipe(text, voice=voice, speed=speed):
            audio.append(result.audio.numpy())
            phonemes.append(result.phonemes)
        return np.concatenate(audio), 24000, {"phonemes": " | ".join(phonemes)}

    return [("ff_siwis", "Kokoro-82M v1.0, voice ff_siwis", synth, True,
             [local / "kokoro-v1_0.pth", local / "config.json", local / "voices/ff_siwis.pt"])]


def engine_chatterbox():
    torch_threads()
    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    # The checkpoint was saved from CUDA: map every torch.load onto the CPU.
    real_load = torch.load
    torch.load = lambda *a, **k: real_load(*a, **{**k, "map_location": torch.device("cpu")})
    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    # Only what from_pretrained fetched (the blobs; the snapshot folder holds links to them).
    files = Path(os.environ["HF_HOME"]) / "hub/models--ResembleAI--chatterbox/blobs"

    def synth(text, speed):
        torch.manual_seed(1)
        wav = model.generate(text, language_id="fr")  # the built-in voice (conds.pt)
        return wav.squeeze(0).cpu().numpy(), model.sr, {}

    return [("default", "Chatterbox Multilingual, built-in voice", synth, False, [files])]


def engine_xtts():
    torch_threads()
    import torch
    from TTS.api import TTS

    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to("cpu")
    print("  built-in speakers:", ", ".join(tts.speakers), flush=True)
    voices = []
    for speaker in ["Claribel Dervla", "Ana Florence", "Damien Black"]:
        def synth(text, speed, speaker=speaker):
            torch.manual_seed(1)
            wav = tts.tts(text=text, speaker=speaker, language="fr", speed=speed)
            return np.asarray(wav), 24000, {}

        vid = speaker.lower().replace(" ", "_")
        voices.append((vid, f"XTTS-v2, studio speaker {speaker}", synth, True,
                       [CACHE / "tts" / "tts" / "tts_models--multilingual--multi-dataset--xtts_v2"]))
    return voices


def engine_f5():
    torch_threads()
    import importlib.resources

    import torch
    from f5_tts.api import F5TTS
    from huggingface_hub import hf_hub_download

    repo = "RASPIAUDIO/F5-French-MixedSpeakers-reduced"
    ckpt = hf_hub_download(repo, "model_last_reduced.pt", revision=F5_REVISION)
    vocab = hf_hub_download(repo, "vocab.txt", revision=F5_REVISION)
    f5 = F5TTS(model="F5TTS_Base", ckpt_file=ckpt, vocab_file=vocab, device="cpu")
    # The checkpoint ships no reference clip: the reference is the one bundled with the f5-tts package
    # (a synthetic English sample), with its transcript as the f5-tts examples give it.
    ref = str(importlib.resources.files("f5_tts").joinpath("infer/examples/basic/basic_ref_en.wav"))
    ref_text = "Some call me nature, others call me mother nature."

    def synth(text, speed):
        wav, sr, _ = f5.infer(ref_file=ref, ref_text=ref_text, gen_text=text, speed=speed, seed=1,
                              remove_silence=False, show_info=lambda *a, **k: None, progress=None)
        return np.asarray(wav), sr, {"reference": "f5_tts/infer/examples/basic/basic_ref_en.wav"}

    return [("raspiaudio-fr", "F5-TTS Base, RASPIAUDIO French fine-tune (package's bundled reference)", synth, True,
             [ckpt, vocab])]


ENGINES = {"piper": engine_piper, "kokoro": engine_kokoro, "chatterbox": engine_chatterbox,
           "xtts": engine_xtts, "f5": engine_f5}


def cpu_name() -> str:
    try:
        for line in Path("/proc/cpuinfo").read_text().splitlines():
            if line.startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor()


def main() -> None:
    cand = sys.argv[1]
    only = sys.argv[2:]  # optional voice ids
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "results").mkdir(exist_ok=True)
    t0 = time.perf_counter()
    voices = ENGINES[cand]()
    load_s = time.perf_counter() - t0
    rows = []
    jobs = [(k, v["spoken"], 1.0) for k, v in LINES["lines"].items()]
    for vid, label, synth, native, files in voices:
        if only and vid not in only:
            continue
        print(f"== {cand} {vid}", flush=True)
        row = {"voice": vid, "label": label, "native_speed": native, "lines": {}, "model_bytes": size_of(files)}
        try:
            synth(LINES["lines"]["b1"]["spoken"], 1.0)  # warm-up, not timed
            todo = jobs + ([("a-slow-native", LINES["lines"]["a"]["spoken"], SLOW)] if native else [])
            for key, text, speed in todo:
                t = time.perf_counter()
                audio, sr, extra = synth(text, speed)
                gen = time.perf_counter() - t
                name = f"{cand}-{vid}-{key}.wav"
                dur = write_wav(OUT / name, audio, sr)
                row["lines"][key] = {"file": name, "gen_s": round(gen, 3), "audio_s": round(dur, 3),
                                     "rtf": round(gen / dur, 3) if dur else None, "sr": sr, **extra}
                print(f"  {key:14} {gen:7.2f}s for {dur:6.2f}s audio  RTF {gen / dur:.3f}", flush=True)
        except Exception as e:  # recorded, the other voices still run
            row["error"] = f"{type(e).__name__}: {e}"
            print("  FAILED:", row["error"], flush=True)
        rows.append(row)
    result = {"candidate": cand, "cpu": cpu_name(), "threads": THREADS, "visible_cpus": os.cpu_count(),
              "affinity": len(os.sched_getaffinity(0)), "load_s": round(load_s, 2), "rows": rows}
    path = OUT / "results" / f"{cand}.json"
    if only and path.is_file():  # a partial rerun keeps the other voices
        old = json.loads(path.read_text(encoding="utf-8"))
        keep = [r for r in old["rows"] if r["voice"] not in only]
        result["rows"] = keep + rows
    path.write_text(json.dumps(result, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
