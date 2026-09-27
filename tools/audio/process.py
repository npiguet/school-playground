"""UI5 audio pipeline (Ruling E17): trims each CC0 source, crossfades a loop's seam, normalises its
loudness, encodes AAC-LC 96 kbps .m4a, records each loop's exact length for the runtime loop region
(web/src/lib/audio/meta.gen.json) and writes the credits into ASSETS-LICENSES.md. Runs in the
tools/audio container (run_docker.sh), whose ffmpeg is pinned (Dockerfile); sources are listed in
tools/audio/sources.json, each with its download URL and sha256 (`fetch` gets them all)."""
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
# AAC-LC's MDCT can ring past a source's own true peak on a sharp transient (a crackle, a click): the
# encoded file's true peak was seen up to ~2 dB above a PCM limiter set right at TRUE_PEAK. Limit the
# PCM before encoding this much further below TRUE_PEAK so the encoded file still lands under it.
ENCODE_HEADROOM = 3.0


def ffmpeg_version() -> str:
    """The toolchain's own version line, e.g. « 7.1.5-0+deb13u1 » (final review I6): printed at each
    build and recorded with each loop, so a drift of the pinned ffmpeg (tools/audio/Dockerfile) shows."""
    out = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, check=True).stdout
    return out.split()[2]


def fetch(sources: dict) -> None:
    """Downloads every source and layer into assets/audio/staging/ from its recorded `download` URL
    (a Kenney pack: its zip, then its `member`) and checks its sha256; a file already there and
    matching is kept (final review I6)."""
    import io
    import urllib.request
    import zipfile

    entries = [(slot, s) for slot, s in sorted(sources.items())]
    entries += [(f"{slot} (layer)", layer) for slot, s in sorted(sources.items()) for layer in s.get("layers", [])]
    for slot, s in entries:
        dest = ROOT / s["file"]
        if dest.is_file() and sha256(dest) == s["sha256"]:
            print(f"{slot:24} kept")
            continue
        req = urllib.request.Request(s["download"], headers={"User-Agent": "discorde-audio-tools"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        if "member" in s:
            data = zipfile.ZipFile(io.BytesIO(data)).read(s["member"])
        if hashlib.sha256(data).hexdigest() != s["sha256"]:
            sys.exit(f"{slot}: {s['download']} does not match its recorded sha256")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        print(f"{slot:24} fetched, sha256 ok")


def run(args: list[str]) -> str:
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit(f"ffmpeg failed: {' '.join(args)}\n{p.stderr[-2000:]}")
    return p.stderr


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def duration(path: Path) -> float:
    # A WAV we produced ourselves (cut.wav, mixed.wav, norm.wav): ffprobe's container-level duration
    # can read back as N/A when a filter graph mixed in an infinitely stream_loop'd input (even one
    # trimmed to a fixed length inside the graph), so read the exact sample count directly instead.
    if path.suffix.lower() == ".wav":
        with wave.open(str(path)) as w:
            return w.getnframes() / w.getframerate()
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout.strip()
    if out in ("", "N/A"):
        sys.exit(f"ffprobe could not determine the duration of {path}")
    return float(out)


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


def noise_floor(path: Path) -> float:
    """Approximate noise floor (dBFS), ffmpeg astats' own summary over the whole file. Useful after a
    big normalisation gain: a source that was very quiet can bring its hiss up with it."""
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "astats", "-f", "null", "-"])
    m = re.findall(r"Noise floor dB:\s*(-?inf|-?[\d.]+)", err)
    return float(m[-1]) if m else float("nan")


def _mix_layers(cut: Path, tmp: str, channels: str, slot: str, layers: list[dict]) -> Path:
    """Mixes extra CC0 textures under (or into) the slot's main clip: a looping layer (e.g. a bubbling
    texture under a drone) is repeated to the main clip's exact length; a one-shot layer (e.g. a single
    chime transient cut from elsewhere in a source, `loop` omitted/false) starts at its own `start` and
    is trimmed to fit. Either way it is gained then summed with the main clip (amix, normalize=0 so the
    main clip is not attenuated by the mix)."""
    cut_dur = duration(cut)
    inputs = ["-i", str(cut)]
    parts = []
    for idx, layer in enumerate(layers, start=1):
        lsrc = ROOT / layer["file"]
        if sha256(lsrc) != layer["sha256"]:
            sys.exit(f"{slot}: layer {layer['file']} does not match its recorded sha256")
        pre = ["-stream_loop", "-1"] if layer.get("loop") else []
        if "start" in layer:
            pre = [*pre, "-ss", str(layer["start"])]
        inputs += [*pre, "-i", str(lsrc)]
        gain = float(layer.get("gain_db", 0.0))
        parts.append(f"[{idx}:a]aresample={RATE},atrim=0:{cut_dur:.6f},asetpts=PTS-STARTPTS,"
                     f"volume={gain}dB[l{idx}]")
    mix_in = "[0:a]" + "".join(f"[l{i}]" for i in range(1, len(layers) + 1))
    graph = ";".join(parts) + f";{mix_in}amix=inputs={len(layers) + 1}:duration=first:normalize=0[mixed]"
    mixed = Path(tmp) / "mixed.wav"
    run(["ffmpeg", "-hide_banner", "-y", *inputs, "-filter_complex", graph, "-map", "[mixed]",
         "-ac", channels, "-c:a", "pcm_s16le", str(mixed)])
    return mixed


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
            start = float(s.get("start", 0))
            dur = float(s["duration"])
            # Seam: the loop's tail fades into its own head, so its end leads straight back to its start
            # (output = body + head crossfaded at the very end, output length = dur - x). Read the body
            # and the head as two independent inputs (two -i of the same file, each with its own -ss/-t)
            # rather than one input split with asplit/atrim: ffmpeg 7.1's threaded filtergraph scheduler
            # deadlocks an asplit whose two atrim branches feed straight into acrossfade (reproduced with
            # a synthetic sine source too) - it reports "No filtered frames for output stream" and writes
            # an empty file. Two separate demuxer reads of the same file avoid that scheduler path.
            body = ["-ss", str(start + x), "-t", str(dur - x)]
            head = ["-ss", str(start), "-t", str(x)]
            graph = (f"[0:a]aresample={RATE}[body];[1:a]aresample={RATE}[head];"
                     f"[body][head]acrossfade=d={x}:c1=tri:c2=tri[out]")
            run(["ffmpeg", "-hide_banner", "-y", *body, "-i", str(src), *head, "-i", str(src),
                 "-filter_complex", graph, "-map", "[out]", "-ac", channels, "-c:a", "pcm_s16le", str(cut)])
        else:
            run(["ffmpeg", "-hide_banner", "-y", *trim, "-i", str(src), "-ar", str(RATE), "-ac", channels,
                 "-af", "afade=t=out:st={:.3f}:d=0.02".format(max(0.0, float(s["duration"]) - 0.02)),
                 "-c:a", "pcm_s16le", str(cut)])
        layers = s.get("layers", [])
        mixed = _mix_layers(cut, tmp, channels, slot, layers) if layers else cut
        i, _ = loudness(mixed)
        gain = TARGET[kind] - i
        norm = Path(tmp) / "norm.wav"
        run(["ffmpeg", "-hide_banner", "-y", "-i", str(mixed), "-af",
             f"volume={gain:.2f}dB,alimiter=limit={10 ** ((TRUE_PEAK - ENCODE_HEADROOM) / 20):.4f}:level=0",
             "-c:a", "pcm_s16le", str(norm)])
        with wave.open(str(norm)) as w:
            samples, rate = w.getnframes(), w.getframerate()
        dest = OUT / kind / f"{name}.m4a"
        dest.parent.mkdir(parents=True, exist_ok=True)
        run(["ffmpeg", "-hide_banner", "-y", "-i", str(norm), "-c:a", "aac", "-b:a", "96k",
             "-movflags", "+faststart", "-map_metadata", "-1", str(dest)])
    li, tp = loudness(dest)
    # Minimal on-target check (Task 3b): the mix step (layers) must not push the final file off its
    # loudness/true-peak target. LUFS is informational (a small drift is fine, "-≈-"); true peak is a
    # hard spec ceiling (Ruling E17) so a violation fails the build.
    target = TARGET[kind]
    status = "PASS" if abs(li - target) <= 1.0 else "WARN"
    if tp > TRUE_PEAK + 0.1:
        sys.exit(f"{slot}: true peak {tp:.1f} dBTP exceeds the {TRUE_PEAK} dBTP ceiling")
    print(f"{slot:14} {dest.stat().st_size / 1024:7.1f} KiB  {samples / rate:6.2f} s  "
          f"{li:6.1f} LUFS  {tp:5.1f} dBTP  [{status} vs {target} LUFS target]")
    return {"samples": samples, "rate": rate, "priming": PRIMING, "ffmpeg": ffmpeg_version()} if kind == "music" else {}


def credits(sources: dict) -> None:
    rows = ["| File | Source | Author | Licence | Changes |", "|---|---|---|---|---|"]
    for slot, s in sorted(sources.items()):
        rows.append(f"| `web/public/audio/{slot}.m4a` | [{s['title']}]({s['url']}) | {s['author']} | "
                    f"[{s['license']}]({s['license_url']}) | trimmed, {'loop seam crossfaded, ' if slot.startswith('music') else ''}"
                    f"loudness normalised, AAC 96 kbps |")
        for layer in s.get("layers", []):
            how = "looped continuously" if layer.get("loop") else "a short excerpt"
            rows.append(f"| `web/public/audio/{slot}.m4a` (layer) | [{layer['title']}]({layer['url']}) | "
                        f"{layer['author']} | [{layer['license']}]({layer['license_url']}) | "
                        f"{how}, mixed in at {layer.get('gain_db', 0):+} dB |")
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
            nf = noise_floor(ROOT / a)
            print(f"{a}: {duration(ROOT / a):.2f} s, {i:.1f} LUFS, {tp:.1f} dBTP, noise floor {nf:.1f} dBFS")
    elif cmd == "fetch":
        fetch(sources)
    elif cmd == "build":
        print(f"ffmpeg {ffmpeg_version()}")
        meta = json.loads(META.read_text(encoding="utf-8")) if META.exists() else {}
        for slot in args or sorted(sources):
            m = build(slot, sources[slot])
            if m:
                meta[slot.split("/")[1]] = m
        META.write_text(json.dumps(meta, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    elif cmd == "credits":
        credits(sources)
    else:
        sys.exit("usage: process.py fetch | measure <files> | build [slots] | credits")


if __name__ == "__main__":
    main()
