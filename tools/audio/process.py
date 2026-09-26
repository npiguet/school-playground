"""UI5 audio pipeline (Ruling E17): trims each CC0 source, crossfades a loop's seam, normalises its
loudness, encodes AAC-LC 96 kbps .m4a, records each loop's exact length for the runtime loop region
(web/src/lib/audio/meta.gen.json) and writes the credits into ASSETS-LICENSES.md. Runs in the
tools/audio container (run_docker.sh); sources are listed in tools/audio/sources.json."""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "tools/audio/sources.json"
OUT = ROOT / "web/public/audio"
META = ROOT / "web/src/lib/audio/meta.gen.json"
LICENSES = ROOT / "ASSETS-LICENSES.md"
RATE = 44100
PRIMING = 1024  # ffmpeg's native AAC encoder priming, in samples
TARGET = {"music": -18.0, "sfx": -16.0}
TRUE_PEAK = -1.5


def run(args: list[str]) -> str:
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit(f"ffmpeg failed: {' '.join(args)}\n{p.stderr[-2000:]}")
    return p.stderr


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def duration(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def loudness(path: Path) -> tuple[float, float]:
    """Integrated loudness (LUFS) and true peak (dBTP). A clip under 3 s is measured over a 3 s
    repetition of itself (EBU R128 gates in 400 ms blocks; a lone 0.1 s click has no integrated value)."""
    short = duration(path) < 3
    pre = ["-stream_loop", "40"] if short else []
    err = run(["ffmpeg", "-hide_banner", "-nostats", *pre, "-i", str(path), *(["-t", "3"] if short else []),
               "-af", "ebur128=peak=true", "-f", "null", "-"])
    i = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err)[-1])
    tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", err)[-1])
    return i, tp


def build(slot: str, s: dict) -> dict:
    kind, name = slot.split("/")
    src = ROOT / s["file"]
    if sha256(src) != s["sha256"]:
        sys.exit(f"{slot}: {s['file']} does not match its recorded sha256")
    channels = "2" if kind == "music" else "1"
    with tempfile.TemporaryDirectory() as tmp:
        cut = Path(tmp) / "cut.wav"
        trim = ["-ss", str(s.get("start", 0)), "-t", str(s["duration"])]
        if kind == "music":
            x = float(s.get("xfade", 3.0))
            # Seam: the loop's tail fades into its own head, so its end leads straight back to its start
            # (output = body[x:], ending with head[0:x] crossfaded in).
            graph = (f"[0:a]aresample={RATE},asplit=2[a][b];"
                     f"[a]atrim=0:{x},asetpts=PTS-STARTPTS[head];"
                     f"[b]atrim={x},asetpts=PTS-STARTPTS[body];"
                     f"[body][head]acrossfade=d={x}:c1=tri:c2=tri[out]")
            run(["ffmpeg", "-hide_banner", "-y", *trim, "-i", str(src), "-filter_complex", graph, "-map", "[out]",
                 "-ac", channels, "-c:a", "pcm_s16le", str(cut)])
        else:
            run(["ffmpeg", "-hide_banner", "-y", *trim, "-i", str(src), "-ar", str(RATE), "-ac", channels,
                 "-af", "afade=t=out:st={:.3f}:d=0.02".format(max(0.0, float(s["duration"]) - 0.02)),
                 "-c:a", "pcm_s16le", str(cut)])
        i, _ = loudness(cut)
        gain = TARGET[kind] - i
        norm = Path(tmp) / "norm.wav"
        run(["ffmpeg", "-hide_banner", "-y", "-i", str(cut), "-af",
             f"volume={gain:.2f}dB,alimiter=limit={10 ** (TRUE_PEAK / 20):.4f}:level=0",
             "-c:a", "pcm_s16le", str(norm)])
        with wave.open(str(norm)) as w:
            samples, rate = w.getnframes(), w.getframerate()
        dest = OUT / kind / f"{name}.m4a"
        dest.parent.mkdir(parents=True, exist_ok=True)
        run(["ffmpeg", "-hide_banner", "-y", "-i", str(norm), "-c:a", "aac", "-b:a", "96k",
             "-movflags", "+faststart", "-map_metadata", "-1", str(dest)])
    li, tp = loudness(dest)
    print(f"{slot:14} {dest.stat().st_size / 1024:7.1f} KiB  {samples / rate:6.2f} s  {li:6.1f} LUFS  {tp:5.1f} dBTP")
    return {"samples": samples, "rate": rate, "priming": PRIMING} if kind == "music" else {}


def credits(sources: dict) -> None:
    rows = ["| File | Source | Author | Licence | Changes |", "|---|---|---|---|---|"]
    for slot, s in sorted(sources.items()):
        rows.append(f"| `web/public/audio/{slot}.m4a` | [{s['title']}]({s['url']}) | {s['author']} | "
                    f"[{s['license']}]({s['license_url']}) | trimmed, {'loop seam crossfaded, ' if slot.startswith('music') else ''}"
                    f"loudness normalised, AAC 96 kbps |")
    section = "\n".join(["<!-- audio:start -->", "## Sounds (scenes UI spec §7)", "",
                         "Every sound is CC0 (public domain dedication); credited here anyway, with where it came from.",
                         "", *rows, "<!-- audio:end -->"])
    text = LICENSES.read_text(encoding="utf-8")
    text = (re.sub(r"<!-- audio:start -->.*<!-- audio:end -->", section, text, flags=re.S)
            if "<!-- audio:start -->" in text else text.rstrip() + "\n\n" + section + "\n")
    LICENSES.write_text(text, encoding="utf-8")


def main() -> None:
    cmd, *args = sys.argv[1:] or ["build"]
    sources = json.loads(SOURCES.read_text(encoding="utf-8")) if SOURCES.exists() else {}
    if cmd == "measure":
        for a in args:
            i, tp = loudness(ROOT / a)
            print(f"{a}: {duration(ROOT / a):.2f} s, {i:.1f} LUFS, {tp:.1f} dBTP")
    elif cmd == "build":
        meta = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
        for slot in args or sorted(sources):
            m = build(slot, sources[slot])
            if m:
                meta[slot.split("/")[1]] = m
        META.write_text(json.dumps(meta, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    elif cmd == "credits":
        credits(sources)
    else:
        sys.exit("usage: process.py measure <files> | build [slots] | credits")


if __name__ == "__main__":
    main()
