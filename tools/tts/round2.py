"""TTS bake-off, round 2: Kokoro-82M only (the voice the user picked), CPU. Reads tools/tts/round2.json
(round2.ts) and writes assets/tts-bakeoff/kokoro/: the samples, results.json and index.html. Round 1's
page (assets/tts-bakeoff/index.html) is left alone.

  python tools/tts/round2.py bake    # in the Kokoro container (run_docker.sh round2-bake)
  python tools/tts/round2.py post    # in tools/audio's ffmpeg container (run_docker.sh round2-post)

Three sections:
- punct: ff_siwis at speed 1, each sentence in variants A-E of the spoken punctuation (round2.ts).
- voices: line a, variant B: ff_siwis; ff_siwis blended 80/20 and 60/40 with other voices (the weighted
  average of the two voice tensors); other voices alone through the French pipeline (lang_code 'f', so
  espeak-ng fr-fr phonemes).
- pace: line a, variant B, ff_siwis at the game's two slowest paces (PACE_RATES 1 and 2): Kokoro's own
  speed control, and ffmpeg atempo of the speed-1 render.

For every render, the gap before the last « point… » word (the spoken name of the final mark) is
measured twice: the model's own predicted duration of the tokens between that word and the one before
(pred_dur, 600 samples per frame at 24 kHz), and the silence ffmpeg finds there (post)."""
from __future__ import annotations

import html
import json
import os
import re
import subprocess
import sys
import time
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/tts-bakeoff/kokoro"
RESULTS = OUT / "results.json"
LINES = json.loads((ROOT / "tools/tts/round2.json").read_text(encoding="utf-8"))
THREADS = int(os.environ.get("TTS_THREADS", "8"))
SR = 24000
FRAME = 600 / SR  # seconds per pred_dur frame

# Grades from hexgrad/Kokoro-82M VOICES.md (overall grade; traits: F/M).
GRADES = {
    "ff_siwis": ("French F", "B-"),
    "af_heart": ("American English F", "A"),
    "af_bella": ("American English F", "A-"),
    "af_nicole": ("American English F", "B-"),
    "bf_emma": ("British English F", "B-"),
    "am_michael": ("American English M", "C+"),
    "am_fenrir": ("American English M", "C+"),
    "bm_george": ("British English M", "C"),
}
BLEND_WITH = ["af_heart", "af_bella", "bf_emma", "am_michael", "bm_george"]
BLEND_WEIGHTS = [0.8, 0.6]  # ff_siwis's share
SOLO = ["af_heart", "af_bella", "af_nicole", "bf_emma", "am_michael", "am_fenrir"]
VARIANTS = "ABCDE"
VARIANT_NOTES = {
    "A": "current game form: « , name. »",
    "B": "the mark, then its name: « . point. » (user's form)",
    "C": "B, name capitalised after . ? ! …: « . Point. »",
    "D": "B with « … » in place of « . »: « … point. » (user's D)",
    "E": "B with a line break after . ? ! …: Kokoro synthesises the name separately",
}


# ---------------------------------------------------------------- bake (Kokoro container)

def bake() -> None:
    import numpy as np
    import torch
    from kokoro import KPipeline

    torch.set_num_threads(THREADS)
    OUT.mkdir(parents=True, exist_ok=True)
    t0 = time.perf_counter()
    pipe = KPipeline(lang_code="f", repo_id="hexgrad/Kokoro-82M")
    vocab = pipe.model.vocab
    load_s = time.perf_counter() - t0

    def synth(text: str, voice, speed: float) -> dict:
        audio, segs = [], []
        t = time.perf_counter()
        for r in pipe(text, voice=voice, speed=speed):
            audio.append(r.audio.numpy())
            kept = [c for c in r.phonemes if vocab.get(c) is not None]
            dur = r.pred_dur.tolist()
            assert len(dur) == len(kept) + 2, (len(dur), len(kept))
            segs.append({"phonemes": r.phonemes, "graphemes": r.graphemes, "kept": kept, "dur": dur,
                         "dropped": sorted({c for c in r.phonemes if vocab.get(c) is None})})
        gen = time.perf_counter() - t
        wav = np.concatenate(audio)
        # One timeline over every segment: bos/eos frames count as silence around each segment.
        chars, durs = [], []
        for s in segs:
            chars += ["^", *s["kept"], "$"]
            durs += s["dur"]
        frames = sum(durs)
        joined = "".join(chars)
        gap = None
        i = joined.rfind("pw")  # « point », « points », « point-virgule »: all start /pw/ (espeak fr-fr)
        if i > 0:
            j = i
            while j > 0 and not chars[j - 1].isalpha() and chars[j - 1] not in "ːˈˌ̃":
                j -= 1
            start = sum(durs[:j]) * FRAME
            gap = {"s": round(sum(durs[j:i]) * FRAME, 3), "at": round(start, 3),
                   "tokens": "".join(chars[j:i]).replace(" ", "␣")}
        return {"wav": wav, "gen_s": round(gen, 3), "audio_s": round(len(wav) / SR, 3),
                "frames_s": round(frames * FRAME, 3), "gap": gap,
                "phonemes": " | ".join(s["phonemes"] for s in segs),
                "segments": len(segs), "phoneme_len": max(len(s["phonemes"]) for s in segs),
                "dropped": sorted({c for s in segs for c in s["dropped"]})}

    rows = {"punct": [], "voices": [], "pace": []}

    def render(section: str, name: str, label: str, text: str, voice, speed: float, **meta) -> None:
        r = synth(text, voice, speed)
        wav = r.pop("wav")
        file = f"{name}.wav"
        write_wav(OUT / file, wav)
        row = {"file": file, "label": label, "spoken": text, "speed": speed, **meta, **r}
        rows[section].append(row)
        g = r["gap"]
        print(f"  {name:28} {r['gen_s']:6.2f}s for {r['audio_s']:5.2f}s"
              f"  gap before name {g['s'] if g else '-'}s {g['tokens'] if g else ''}"
              f"  ps {r['phoneme_len']}", flush=True)

    synth("Bonjour, virgule, les enfants. point.", "ff_siwis", 1.0)  # warm-up, not timed

    print("== punctuation", flush=True)
    for key, s in LINES["sentences"].items():
        for v in VARIANTS:
            text = s["variants"][v]
            if v != "A" and v != "B" and text == s["variants"]["B"]:
                rows["punct"].append({"sentence": key, "variant": v, "same_as": "B", "spoken": text})
                continue
            render("punct", f"punct-{key}-{v}", f"{v}: {VARIANT_NOTES[v]}", text, "ff_siwis", 1.0,
                   sentence=key, variant=v)

    line = LINES["sentences"]["a"]["variants"]["B"]
    print("== voices", flush=True)
    siwis = pipe.load_voice("ff_siwis")
    render("voices", "voice-ff_siwis", "ff_siwis alone (reference)", line, "ff_siwis", 1.0,
           kind="reference", voices=["ff_siwis"])
    for other in BLEND_WITH:
        pack = pipe.load_voice(other)
        for w in BLEND_WEIGHTS:
            blend = (w * siwis + (1 - w) * pack).to(torch.float32)
            pct = round(w * 100)
            render("voices", f"blend-{other}-{pct}", f"ff_siwis {pct}% + {other} {100 - pct}%", line, blend, 1.0,
                   kind="blend", voices=["ff_siwis", other], weights=[w, round(1 - w, 2)])
    for v in SOLO:
        render("voices", f"solo-{v}", f"{v} alone, French phonemiser (lang_code 'f')", line, v, 1.0,
               kind="solo", voices=[v])

    print("== pace", flush=True)
    render("pace", "pace-1.0-native", "speed 1 (reference; the atempo source)", line, "ff_siwis", 1.0, method="native")
    for rate in LINES["paces"]:
        render("pace", f"pace-{rate}-native", f"speed {rate}, Kokoro's own speed control", line, "ff_siwis", rate,
               method="native")

    RESULTS.write_text(json.dumps({"load_s": round(load_s, 2), "threads": THREADS, "cpu": cpu_name(),
                                   "rows": rows}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print("wrote", RESULTS)


def write_wav(path: Path, audio) -> None:
    import numpy as np

    audio = np.clip(np.asarray(audio, dtype=np.float32).reshape(-1), -1.0, 1.0)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype("<i2").tobytes())


def cpu_name() -> str:
    try:
        for line in Path("/proc/cpuinfo").read_text().splitlines():
            if line.startswith("model name"):
                return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return "?"


# ---------------------------------------------------------------- post (ffmpeg container)

def ffmpeg(*args: str) -> str:
    return subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *args], capture_output=True, text=True,
                          check=True).stderr


def silences(path: Path, dur: float) -> list[tuple[float, float]]:
    """Silent spans (below -45 dBFS for at least 40 ms)."""
    log = ffmpeg("-i", str(path), "-af", "silencedetect=noise=-45dB:d=0.04", "-f", "null", "-")
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    return list(zip(starts, ends + [dur] * (len(starts) - len(ends))))


def measure(row: dict) -> None:
    with wave.open(str(OUT / row["file"]), "rb") as w:  # the real length (atempo's is not exactly 1/rate)
        row["audio_s"] = round(w.getnframes() / w.getframerate(), 3)
    spans = silences(OUT / row["file"], row["audio_s"])
    row["trail_s"] = round(next((row["audio_s"] - s for s, e in spans if e >= row["audio_s"] - 0.01), 0.0), 2)
    inner = [(s, e) for s, e in spans if s > 0.01 and e < row["audio_s"] - 0.01]
    row["max_pause_s"] = round(max((e - s for s, e in inner), default=0.0), 2)
    g = row.get("gap")
    if g:  # the measured silence overlapping the model's predicted gap (widened by 60 ms each side)
        lo, hi = g["at"] - 0.06, g["at"] + g["s"] + 0.06
        g["silence_s"] = round(sum(max(0.0, min(e, hi) - max(s, lo)) for s, e in inner), 2)


def post() -> None:
    res = json.loads(RESULTS.read_text(encoding="utf-8"))
    rows = res["rows"]
    rows["pace"] = [r for r in rows["pace"] if r["method"] == "native"]
    ref = next(r for r in rows["pace"] if r["speed"] == 1.0)
    for rate in LINES["paces"]:
        file = f"pace-{rate}-atempo.wav"
        ffmpeg("-y", "-i", str(OUT / ref["file"]), "-filter:a", f"atempo={rate}", str(OUT / file))
        g = ref["gap"]
        rows["pace"].append({"file": file, "label": f"speed {rate}, ffmpeg atempo={rate} of the speed-1 render",
                             "spoken": ref["spoken"], "speed": rate, "method": "atempo",
                             "gap": g and {**g, "s": round(g["s"] / rate, 3), "at": round(g["at"] / rate, 3)}})
    rows["pace"].sort(key=lambda r: (-r["speed"], r["method"] != "native"))
    for section in rows.values():
        for r in section:
            if "file" in r:
                measure(r)
    RESULTS.write_text(json.dumps(res, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "index.html").write_text(page(res), encoding="utf-8")
    print("wrote", OUT / "index.html")


def esc(s) -> str:
    return html.escape(str(s))


def spoken(text: str) -> str:
    return esc(text).replace("\n", '<span class="nl">&#9166; line break</span> ')


def stats(r: dict) -> str:
    out = []
    if "gen_s" in r:
        out.append(f"{r['gen_s']:.2f} s to make for {r['audio_s']:.2f} s (RTF {r['gen_s'] / r['audio_s']:.2f})")
    else:
        out.append(f"{r['audio_s']:.2f} s, ffmpeg atempo")
    g = r.get("gap")
    if g:
        out.append(f"gap before the final name: model {g['s']:.2f} s over <code>{esc(g['tokens'])}</code>, "
                   f"silence measured {g.get('silence_s', 0):.2f} s")
    out.append(f"longest pause {r['max_pause_s']:.2f} s, trailing silence {r['trail_s']:.2f} s")
    if r.get("segments", 1) > 1:
        out.append(f"{r['segments']} synthesis segments")
    if r.get("dropped"):
        out.append(f'<span class="warn">phonemes not in the vocabulary, dropped: {esc(" ".join(r["dropped"]))}</span>')
    if r.get("phoneme_len", 0) > 510:
        out.append('<span class="warn">phonemes over 510: truncated</span>')
    if "phonemes" in r:
        out.append(f'<details><summary>phonemes</summary><code>{esc(r["phonemes"])}</code></details>')
    return "<br>".join(out)


def audio_row(label: str, r: dict) -> str:
    return (f'<tr><th>{label}</th><td><audio controls preload="none" src="{esc(r["file"])}"></audio></td>'
            f'<td><div class="said">{spoken(r["spoken"])}</div><div class="s">{stats(r)}</div></td></tr>')


def page(res: dict) -> str:
    rows = res["rows"]
    punct = []
    for key, s in LINES["sentences"].items():
        punct.append(f'<tr class="group"><td colspan="3"><b>{esc(s["text"])}</b>'
                     f' <span class="s">({esc(s["source"])}{", new paragraph" if s["newParagraph"] else ""})</span></td></tr>')
        for r in (x for x in rows["punct"] if x["sentence"] == key):
            if "same_as" in r:
                punct.append(f'<tr><th>{r["variant"]}: {esc(VARIANT_NOTES[r["variant"]])}</th>'
                             f'<td class="s">same string as B, not rendered again</td><td></td></tr>')
            else:
                punct.append(audio_row(esc(r["label"]), r))

    def voice_label(r: dict) -> str:
        grades = ", ".join(f"{v} {GRADES[v][1]} ({GRADES[v][0]})" for v in r["voices"])
        return f"{esc(r['label'])}<div class=\"s\">VOICES.md grade: {esc(grades)}</div>"

    voices = [audio_row(voice_label(r), r) for r in rows["voices"]]
    pace = [audio_row(esc(r["label"]), r) for r in rows["pace"]]
    head = "<thead><tr><th>what</th><th>listen</th><th>spoken string and measures</th></tr></thead>"
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kokoro round 2</title>
<style>
:root {{ color-scheme: light dark; --bg: #fbf8f2; --fg: #222; --muted: #666; --line: #d8d0c0; --warn: #b00020; --band: #efe8da; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg: #1b1a18; --fg: #eee; --muted: #aaa; --line: #444; --warn: #ff6b81; --band: #2a2824; }} }}
body {{ background: var(--bg); color: var(--fg); font: 15px/1.4 system-ui, sans-serif; margin: 16px; max-width: 1200px; }}
table {{ border-collapse: collapse; width: 100%; margin-bottom: 24px; }}
th, td {{ border: 1px solid var(--line); padding: 6px; vertical-align: top; text-align: left; }}
tbody th {{ width: 280px; font-weight: normal; }}
tr.group td {{ background: var(--band); }}
audio {{ width: 240px; }}
.said {{ font-family: Georgia, serif; }}
.nl {{ color: var(--muted); font-size: 12px; border: 1px solid var(--line); border-radius: 3px; padding: 0 3px; }}
.s {{ color: var(--muted); font-size: 12px; }}
.warn {{ color: var(--warn); }}
code {{ font-size: 11px; white-space: normal; }}
.wrap {{ overflow-x: auto; }}
@media (max-width: 700px) {{ tbody th {{ width: auto; }} audio {{ width: 180px; }} }}
</style></head><body>
<h1>Kokoro-82M, round 2</h1>
<p>Voice <code>ff_siwis</code> unless a row says otherwise; speed 1 unless it says otherwise. CPU
({esc(res["cpu"])}, {res["threads"]} threads). Made by <code>tools/tts/run_docker.sh round2-bake</code> and
<code>round2-post</code>; the strings come from <code>tools/tts/round2.ts</code> (variant A is the game's own
<code>spokenForm</code>; B to E are a transform of it in the bake-off tooling, the game is unchanged). The comma
keeps its current form, « , virgule, », everywhere.</p>
<p class="s">"Gap before the final name": the pause the model gives the tokens between the last word of the
sentence and the spoken « point… » word (Kokoro's predicted durations), and the silence (below -45 dBFS)
ffmpeg measures at that spot.</p>
<h2>1. Punctuation phrasing</h2>
<div class="wrap"><table>{head}<tbody>{"".join(punct)}</tbody></table></div>
<h2>2. Voices (line a, variant B)</h2>
<p class="s">A blend is the weighted average of the two voice tensors. "Alone" rows use a non-French voice
through the French pipeline (lang_code 'f', espeak-ng fr-fr phonemes). No community French Kokoro voice pack
was found on Hugging Face, so none is included.</p>
<div class="wrap"><table>{head}<tbody>{"".join(voices)}</tbody></table></div>
<h2>3. Pace (line a, variant B)</h2>
<p class="s">The game's slower paces: PACE_RATES 1 = {LINES["paces"][0]}, 2 = {LINES["paces"][1]}.</p>
<div class="wrap"><table>{head}<tbody>{"".join(pace)}</tbody></table></div>
</body></html>
"""


if __name__ == "__main__":
    {"bake": bake, "post": post}[sys.argv[1]]()
