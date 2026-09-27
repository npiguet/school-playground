"""TTS bake-off, after every `bake`: stretches each candidate's line a to the game's slowest pace with
ffmpeg's atempo (a-slow-atempo, to compare with the engine's own speed control), measures the pauses
in every sample (silencedetect), and writes assets/tts-bakeoff/index.html, the listening page. Runs in
tools/audio's ffmpeg container (run_docker.sh post)."""
from __future__ import annotations

import html
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets/tts-bakeoff"
RESULTS = OUT / "results"
LINES = json.loads((ROOT / "tools/tts/lines.json").read_text(encoding="utf-8"))
LICENCES = json.loads((ROOT / "tools/tts/licences.json").read_text(encoding="utf-8"))
ORDER = ["piper", "kokoro", "chatterbox", "xtts", "f5"]
COLUMNS = ["a", "a-slow-native", "a-slow-atempo", "b1", "b2", "c"]


def ffmpeg(*args: str) -> str:
    return subprocess.run(["ffmpeg", "-hide_banner", "-nostats", *args], capture_output=True, text=True, check=True).stderr


def pauses(path: Path, dur: float) -> dict:
    """Leading and trailing silence, and the longest pause inside, in seconds (below -40 dBFS for at
    least 0.25 s)."""
    log = ffmpeg("-i", str(path), "-af", "silencedetect=noise=-40dB:d=0.25", "-f", "null", "-")
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    spans = list(zip(starts, ends + [dur] * (len(starts) - len(ends))))
    lead = next((e for s, e in spans if s <= 0.01), 0.0)
    trail = next((dur - s for s, e in spans if e >= dur - 0.01), 0.0)
    inner = [e - s for s, e in spans if s > 0.01 and e < dur - 0.01]
    return {"lead": round(lead, 2), "trail": round(trail, 2), "max_pause": round(max(inner, default=0.0), 2)}


def mb(n) -> str:
    return "?" if n is None else f"{n / 1e6:,.0f} MB"


def main() -> None:
    images = json.loads((RESULTS / "images.json").read_text(encoding="utf-8"))
    results = {c: json.loads((RESULTS / f"{c}.json").read_text(encoding="utf-8")) for c in ORDER if (RESULTS / f"{c}.json").is_file()}
    for cand, res in results.items():
        for row in res["rows"]:
            a = row["lines"].get("a")
            if a:
                src = OUT / a["file"]
                name = a["file"].replace("-a.wav", "-a-slow-atempo.wav")
                ffmpeg("-y", "-i", str(src), "-filter:a", f"atempo={LINES['slowRate']}", str(OUT / name))
                row["lines"]["a-slow-atempo"] = {"file": name, "audio_s": round(a["audio_s"] / LINES["slowRate"], 3)}
            for line in row["lines"].values():
                line.update(pauses(OUT / line["file"], line["audio_s"]))
        (RESULTS / f"{cand}.json").write_text(json.dumps(res, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    (OUT / "index.html").write_text(page(results, images), encoding="utf-8")
    print("wrote", OUT / "index.html")


def cell(line: dict | None) -> str:
    if not line:
        return '<td class="na">no native speed control</td>'
    stats = []
    if "gen_s" in line:
        stats.append(f"{line['gen_s']:.2f} s to make, RTF {line['rtf']:.2f}")
    else:
        stats.append("ffmpeg atempo of a")
    stats.append(f"{line['audio_s']:.1f} s long; longest pause {line['max_pause']:.1f} s")
    if line.get("phonemes"):
        stats.append(f'<details><summary>phonemes</summary><code>{html.escape(line["phonemes"])}</code></details>')
    return (f'<td><audio controls preload="none" src="{html.escape(line["file"])}"></audio>'
            f'<div class="s">{"<br>".join(stats)}</div></td>')


def page(results: dict, images: dict) -> str:
    cpu = next(iter(results.values()))
    heads = {"a": "a: full sentence", "a-slow-native": f"a at {LINES['slowRate']}, engine's own speed",
             "a-slow-atempo": f"a at {LINES['slowRate']}, ffmpeg atempo", "b1": "b1: chunk 1", "b2": "b2: chunk 2",
             "c": "c: dragon line"}
    rows = []
    for cand, res in results.items():
        lic = LICENCES[cand]
        for row in res["rows"]:
            timed = [v for v in row["lines"].values() if "gen_s" in v]
            gen = sum(v["gen_s"] for v in timed)
            aud = sum(v["audio_s"] for v in timed)
            voice_lic = lic.get("voices", {}).get(row["voice"].split("-")[0], lic.get("weights"))
            info = (f'<b>{html.escape(row["label"])}</b>'
                    f'<div class="s">all lines: {gen:.1f} s for {aud:.1f} s of audio, RTF {gen / aud if aud else 0:.2f}'
                    f'<br>model {mb(row["model_bytes"])}, image {images.get(cand, "?")}, load {res["load_s"]:.0f} s (first run: includes the weights download)'
                    f'<br>engine: {lic["engine"]}<br>weights/voice: {voice_lic}'
                    + (f'<br>note: {html.escape(lic["note"])}' if lic.get("note") else "")
                    + (f'<br><span class="err">error: {html.escape(row["error"])}</span>' if row.get("error") else "")
                    + "</div>")
            cells = "".join(cell(row["lines"].get(k)) for k in COLUMNS)
            rows.append(f"<tr><th>{info}</th>{cells}</tr>")
    spoken = "".join(f"<dt>{k}</dt><dd>{html.escape(v['spoken'])}<br><small>shown as: {html.escape(v['text'])}</small></dd>"
                     for k, v in LINES["lines"].items())
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TTS bake-off</title>
<style>
:root {{ color-scheme: light dark; --bg: #fbf8f2; --fg: #222; --muted: #666; --line: #d8d0c0; --err: #b00020; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg: #1b1a18; --fg: #eee; --muted: #aaa; --line: #444; --err: #ff6b81; }} }}
body {{ background: var(--bg); color: var(--fg); font: 15px/1.4 system-ui, sans-serif; margin: 16px; }}
table {{ border-collapse: collapse; }}
th, td {{ border: 1px solid var(--line); padding: 6px; vertical-align: top; text-align: left; }}
tbody th {{ min-width: 260px; max-width: 320px; font-weight: normal; }}
audio {{ width: 220px; }}
.s {{ color: var(--muted); font-size: 12px; }}
.na {{ color: var(--muted); font-size: 12px; }}
.err {{ color: var(--err); }}
code {{ font-size: 11px; white-space: normal; }}
.wrap {{ overflow-x: auto; }}
dd {{ margin: 0 0 8px 24px; }}
</style></head><body>
<h1>TTS bake-off</h1>
<p>French dictation voices for La Discorde, generated on CPU ({html.escape(cpu["cpu"])}, {cpu["threads"]} threads pinned to
{cpu["affinity"]} logical CPUs, one per physical core, to approximate the 8-core Ryzen 7 9700 server). Times are after one
warm-up synthesis per voice. RTF = generation time / audio length: below 1 is faster than real time. Made by
<code>tools/tts/run_docker.sh</code>.</p>
<h2>Lines (the game's own spoken form)</h2><dl>{spoken}</dl>
<div class="wrap"><table><thead><tr><th>candidate / voice</th>{"".join(f"<th>{heads[k]}</th>" for k in COLUMNS)}</tr></thead>
<tbody>{"".join(rows)}</tbody></table></div>
</body></html>
"""


if __name__ == "__main__":
    main()
