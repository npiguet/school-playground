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


def _seam(src: Path, start: float, dur: float, x: float, channels: str, dest: Path) -> None:
    """Cuts `dur` s of `src` from `start` into a seamless loop of `dur - x` s: its tail crossfades
    into its own head over `x` s, so its end leads straight back to its start. The body and the head
    are two independent inputs (two -i of the same file, each with its own -ss/-t) rather than one
    input split with asplit/atrim: ffmpeg 7.1's threaded filtergraph scheduler deadlocks an asplit
    whose two atrim branches feed straight into acrossfade (reproduced with a synthetic sine source
    too) - it reports "No filtered frames for output stream" and writes an empty file."""
    body = ["-ss", str(start + x), "-t", str(dur - x)]
    head = ["-ss", str(start), "-t", str(x)]
    graph = (f"[0:a]aresample={RATE}[body];[1:a]aresample={RATE}[head];"
             f"[body][head]acrossfade=d={x}:c1=tri:c2=tri[out]")
    run(["ffmpeg", "-hide_banner", "-y", *body, "-i", str(src), *head, "-i", str(src),
         "-filter_complex", graph, "-map", "[out]", "-ac", channels, "-c:a", "pcm_s16le", str(dest)])


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
        if layer.get("xfade"):
            # A bed layer as long as the main clip, given its own crossfaded seam so the loop's wrap
            # has no jump in it either (a plain `loop` layer is repeated end to start as it is).
            x = float(layer["xfade"])
            seamed = Path(tmp) / f"layer{idx}.wav"
            _seam(lsrc, float(layer.get("start", 0)), cut_dur + x, x, channels, seamed)
            inputs += ["-i", str(seamed)]
        else:
            pre = ["-stream_loop", "-1"] if layer.get("loop") else []
            if "start" in layer:
                pre = [*pre, "-ss", str(layer["start"])]
            inputs += [*pre, "-i", str(lsrc)]
        gain = float(layer.get("gain_db", 0.0))
        # Optional: `filter`, an ffmpeg audio filter chain (e.g. a lowpass to push a sound far away);
        # `at`, where in the loop a one-shot layer lands (seconds; default 0, the loop's start).
        extra = f",{layer['filter']}" if layer.get("filter") else ""
        at = float(layer.get("at", 0.0))
        place = f",adelay={int(at * 1000)}:all=1,apad" if at else ",apad"
        length = cut_dur - at if not layer.get("loop") else cut_dur
        parts.append(f"[{idx}:a]aresample={RATE},atrim=0:{length:.6f},asetpts=PTS-STARTPTS{extra},"
                     f"volume={gain}dB{place},atrim=0:{cut_dur:.6f}[l{idx}]")
    mix_in = "[0:a]" + "".join(f"[l{i}]" for i in range(1, len(layers) + 1))
    graph = ";".join(parts) + f";{mix_in}amix=inputs={len(layers) + 1}:duration=first:normalize=0[mixed]"
    mixed = Path(tmp) / "mixed.wav"
    run(["ffmpeg", "-hide_banner", "-y", *inputs, "-filter_complex", graph, "-map", "[mixed]",
         "-ac", channels, "-c:a", "pcm_s16le", str(mixed)])
    return mixed


def build(slot: str, s: dict, out: Path | None = None) -> dict:
    """Builds one slot into web/public/audio/<kind>/<name>.m4a, or into `out`/<name>.m4a when a
    staging folder is given (candidates to listen to, never read by the game)."""
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
            _seam(src, start, dur, x, channels, cut)
        else:
            run(["ffmpeg", "-hide_banner", "-y", *trim, "-i", str(src), "-ar", str(RATE), "-ac", channels,
                 "-af", "afade=t=out:st={:.3f}:d=0.02".format(max(0.0, float(s["duration"]) - 0.02)),
                 "-c:a", "pcm_s16le", str(cut)])
        if s.get("filter"):
            # Optional ffmpeg filter chain on the main clip (length-preserving: eq, low/high-pass).
            shaped = Path(tmp) / "shaped.wav"
            run(["ffmpeg", "-hide_banner", "-y", "-i", str(cut), "-af", s["filter"], "-c:a", "pcm_s16le", str(shaped)])
            cut = shaped
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
        dest = (out / f"{name}.m4a") if out else (OUT / kind / f"{name}.m4a")
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
    if out:
        return {"file": dest.name, "seconds": round(samples / rate, 2), "lufs": li, "true_peak": tp,
                "kib": round(dest.stat().st_size / 1024, 1)}
    return {"samples": samples, "rate": rate, "priming": PRIMING, "ffmpeg": ffmpeg_version()} if kind == "music" else {}


def credits(sources: dict) -> None:
    rows = ["| File | Source | Author | Licence | Changes |", "|---|---|---|---|---|"]
    for slot, s in sorted(sources.items()):
        rows.append(f"| `web/public/audio/{slot}.m4a` | [{s['title']}]({s['url']}) | {s['author']} | "
                    f"[{s['license']}]({s['license_url']}) | trimmed, {'filtered, ' if s.get('filter') else ''}"
                    f"{'loop seam crossfaded, ' if slot.startswith('music') else ''}"
                    f"loudness normalised, AAC 96 kbps |")
        for layer in s.get("layers", []):
            how = "looped continuously" if layer.get("loop") else "a short excerpt"
            how += ", filtered" if layer.get("filter") else ""
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


BANDS = [("sub <80 Hz", None, 80), ("low 80-300", 80, 300), ("low-mid 300-1k", 300, 1000),
         ("mid 1k-4k", 1000, 4000), ("high >4k", 4000, None)]
FRAME_S = 0.023  # envelope frame, ~ one auditory "event" resolution


def _band_rms(path: Path, lo: float | None, hi: float | None) -> float:
    """Overall RMS level (dBFS) of one frequency band (4th-order-ish: each filter applied twice)."""
    chain = []
    if lo:
        chain += [f"highpass=f={lo}"] * 2
    if hi:
        chain += [f"lowpass=f={hi}"] * 2
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-ac", "1",
               "-af", ",".join([*chain, "astats=measure_perchannel=none"]), "-f", "null", "-"])
    m = re.findall(r"RMS level dB:\s*(-?inf|-?[\d.]+)", err)
    return float(m[-1]) if m else float("-inf")


def _envelope(path: Path, highpass: float | None) -> list[float]:
    """Frame-by-frame RMS level (dB) of the mono mix, optionally high-passed first."""
    import array
    import math
    rate = 16000
    af = ["-af", f"highpass=f={highpass},highpass=f={highpass}"] if highpass else []
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-v", "error", "-i", str(path), "-ac", "1",
                        "-ar", str(rate), *af, "-f", "s16le", "-"], capture_output=True, check=True)
    pcm = array.array("h")
    pcm.frombytes(p.stdout[: len(p.stdout) // 2 * 2])
    n = int(rate * FRAME_S)
    env = []
    for k in range(0, len(pcm) - n, n):
        acc = sum(x * x for x in pcm[k:k + n]) / n
        env.append(10 * math.log10(acc / (32768.0 ** 2) + 1e-12))
    return env


def _rhythm(env: list[float]) -> dict:
    """What an ear calls busy or nagging, from an envelope: onsets per minute (a frame > 6 dB above
    the median of the 250 ms before it, and not in the file's quiet tail), frame-to-frame flicker
    (median |step|, dB: high for bubbling/crackle, low for a smooth bed), and the strongest
    periodicity of the onset-strength curve between 0.2 s and 5 s (autocorrelation, 0..1: a steady
    pulse or a repeating figure scores high)."""
    import statistics
    if len(env) < 50:
        return {}
    loud = sorted(env)[int(len(env) * 0.9)]
    look = int(0.25 / FRAME_S)
    onsets, prev = 0, False
    for k in range(look, len(env)):
        hit = env[k] - statistics.median(env[k - look:k]) > 6 and env[k] > loud - 30
        onsets += hit and not prev
        prev = hit
    flicker = statistics.median(abs(env[k] - env[k - 1]) for k in range(1, len(env)))
    flux = [max(0.0, env[k] - env[k - 1]) for k in range(1, len(env))]
    mean = sum(flux) / len(flux)
    dev = [f - mean for f in flux]
    var = sum(d * d for d in dev) or 1e-12
    best, best_lag = 0.0, 0
    for lag in range(int(0.2 / FRAME_S), min(int(5 / FRAME_S), len(dev) // 2)):
        r = sum(dev[k] * dev[k + lag] for k in range(len(dev) - lag)) / var
        if r > best:
            best, best_lag = r, lag
    # Throb: a smooth swell/beat of the level itself (0.5-8 Hz), which the onset curve can miss.
    em = sum(env) / len(env)
    ed = [e - em for e in env]
    evar = sum(d * d for d in ed) or 1e-12
    ac = [sum(ed[k] * ed[k + lag] for k in range(len(ed) - lag)) / evar for lag in range(int(2 / FRAME_S) + 2)]
    # The autocorrelation first decays from 1; a swell repeating every T shows as a rise after that
    # first trough, peaking at T. Throb = that peak's height above the trough (0: none).
    trough = next((k for k in range(1, len(ac) - 1) if ac[k] <= ac[k - 1] and ac[k] <= ac[k + 1]), len(ac) - 1)
    throb, throb_lag = 0.0, 0
    for lag in range(max(trough, int(0.125 / FRAME_S)), len(ac) - 1):
        if ac[lag] >= ac[lag - 1] and ac[lag] >= ac[lag + 1] and ac[lag] - ac[trough] > throb:
            throb, throb_lag = ac[lag] - ac[trough], lag
    minutes = len(env) * FRAME_S / 60
    spread = sorted(env)
    return {"onsets_per_min": round(onsets / minutes, 1), "flicker_db": round(flicker, 2),
            "periodicity": round(best, 2), "period_s": round(best_lag * FRAME_S, 2),
            "throb": round(throb, 2), "throb_period_s": round(throb_lag * FRAME_S, 2),
            "dynamic_range_db": round(spread[int(len(spread) * 0.95)] - spread[int(len(spread) * 0.10)], 1)}


def _fft(x: list[complex]) -> list[complex]:
    """Iterative radix-2 FFT (len(x) a power of two); the container has no numpy."""
    import cmath
    n = len(x)
    a = list(x)
    j = 0
    for i in range(1, n):
        bit = n >> 1
        while j & bit:
            j ^= bit
            bit >>= 1
        j |= bit
        if i < j:
            a[i], a[j] = a[j], a[i]
    size = 2
    while size <= n:
        w = cmath.exp(-2j * cmath.pi / size)
        half = size // 2
        for start in range(0, n, size):
            wk = 1
            for k in range(start, start + half):
                t = wk * a[k + half]
                a[k + half] = a[k] - t
                a[k] = a[k] + t
                wk *= w
        size *= 2
    return a


def _tonal(path: Path) -> dict:
    """Long-term spectrum (8 kHz mono, 4096-point Hann frames averaged over 24 slices of the file):
    the spectral centroid, and the steadiest pitched components, i.e. bins standing > 10 dB above the
    median of their ±40 Hz neighbourhood. A sustained pitched hum is what an ear tires of first."""
    import array
    import math
    rate, n = 8000, 4096
    p = subprocess.run(["ffmpeg", "-hide_banner", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(rate),
                        "-f", "s16le", "-"], capture_output=True, check=True)
    pcm = array.array("h")
    pcm.frombytes(p.stdout[: len(p.stdout) // 2 * 2])
    win = [0.5 - 0.5 * math.cos(2 * math.pi * k / (n - 1)) for k in range(n)]
    slices = 24
    step = max(1, (len(pcm) - n) // slices)
    power = [0.0] * (n // 2)
    for s in range(slices):
        seg = pcm[s * step:s * step + n]
        if len(seg) < n:
            break
        spec = _fft([seg[k] * win[k] for k in range(n)])
        for k in range(n // 2):
            power[k] += abs(spec[k]) ** 2
    hz = rate / n
    db = [10 * math.log10(v + 1e-9) for v in power]
    tot = sum(power[1:]) or 1e-9
    centroid = sum(k * hz * power[k] for k in range(1, n // 2)) / tot
    reach = int(40 / hz)
    peaks = []
    for k in range(max(2, int(40 / hz)), n // 2 - reach):
        if db[k] >= max(db[k - 2:k + 3]):
            neigh = sorted(db[k - reach:k + reach])
            prom = db[k] - neigh[len(neigh) // 2]
            if prom > 10:
                peaks.append((db[k], k * hz, prom))
    peaks.sort(reverse=True)
    return {"centroid_hz": round(centroid), "tonal_peaks": [f"{f:.0f} Hz (+{pr:.0f} dB)" for _, f, pr in peaks[:4]]}


def analyze(path: Path) -> dict:
    """An analytical listen: loudness, where the energy sits (share of each band, from its RMS), and
    the rhythm of the whole mix and of its >1 kHz part (where bubbling, crackle and clicks live)."""
    i, tp = loudness(path)
    rms = {name: _band_rms(path, lo, hi) for name, lo, hi in BANDS}
    powers = {k: 10 ** (v / 10) for k, v in rms.items()}
    total = sum(powers.values()) or 1e-12
    share = {k: round(100 * p / total, 1) for k, p in powers.items()}
    env = _envelope(path, None)
    return {"seconds": round(duration(path), 2), "lufs": i, "true_peak": tp, "band_share_pct": share,
            **_tonal(path), **_swell(env),
            "full": _rhythm(env), "above_1k": _rhythm(_envelope(path, 1000))}


def _swell(env: list[float]) -> dict:
    """Slow recurring swells (2-30 s), which a loop of a minute makes obvious: the envelope in 0.5 s
    blocks, its autocorrelation's highest peak after the first trough (0: none; > 0.3: a clear cycle)."""
    per = int(0.5 / FRAME_S)
    blocks = [sum(env[k:k + per]) / per for k in range(0, len(env) - per, per)]
    if len(blocks) < 12:
        return {}
    m = sum(blocks) / len(blocks)
    d = [b - m for b in blocks]
    var = sum(x * x for x in d) or 1e-12
    ac = [sum(d[k] * d[k + lag] for k in range(len(d) - lag)) / var for lag in range(min(61, len(d) // 2))]
    trough = next((k for k in range(1, len(ac) - 1) if ac[k] <= ac[k - 1] and ac[k] <= ac[k + 1]), None)
    if trough is None:
        return {"swell": 0.0, "swell_period_s": 0.0}
    best, lag = 0.0, 0
    for k in range(max(trough, 4), len(ac) - 1):
        if ac[k] >= ac[k - 1] and ac[k] >= ac[k + 1] and ac[k] - ac[trough] > best:
            best, lag = ac[k] - ac[trough], k
    return {"swell": round(best, 2), "swell_period_s": lag * 0.5}


def main() -> None:
    argv = sys.argv[1:]
    # Staging options (a candidates round): `--sources <json>` reads another sources file than
    # tools/audio/sources.json, `--out <dir>` builds its loops into that folder (and a
    # measurements.json beside them) instead of web/public/audio, leaving meta.gen.json alone.
    opts = {}
    while argv and argv[0] in ("--sources", "--out"):
        opts[argv[0]] = ROOT / argv[1]
        argv = argv[2:]
    cmd, *args = argv or ["build"]
    src_file = opts.get("--sources", SOURCES)
    sources = json.loads(src_file.read_text(encoding="utf-8")) if src_file.exists() else {}
    out = opts.get("--out")
    if cmd == "build" and out:
        print(f"ffmpeg {ffmpeg_version()} (staging: {out.relative_to(ROOT)})")
        out.mkdir(parents=True, exist_ok=True)
        record = out / "measurements.json"
        done = json.loads(record.read_text(encoding="utf-8")) if record.exists() else {}
        for slot in args or sorted(sources):
            done[slot] = build(slot, sources[slot], out)
        record.write_text(json.dumps(done, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return
    if cmd == "analyze":
        for a in args:
            print(json.dumps({a: analyze(ROOT / a)}, indent=2))
        return
    if cmd == "measure":
        for a in args:
            i, tp = loudness(ROOT / a)
            nf = noise_floor(ROOT / a)
            print(f"{a}: {duration(ROOT / a):.2f} s, {i:.1f} LUFS, {tp:.1f} dBTP, noise floor {nf:.1f} dBFS")
    elif cmd == "fetch":
        fetch(sources)  # with --sources, only that file's entries
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
        sys.exit("usage: process.py [--sources <json>] [--out <dir>] "
                 "fetch | measure <files> | analyze <files> | build [slots] | credits")


if __name__ == "__main__":
    main()
