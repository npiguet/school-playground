"""The line cache (spec 2026-09-27 §4.1): one MP3 per line in /cache (its own volume, no backup needed),
named by what changes the sound; the least recently used go first once past TTS_CACHE_MB."""
from __future__ import annotations

import hashlib
import json
import os
import threading
from pathlib import Path

# Bump when the MP3s or the phonemes change for the same inputs: the bitrate, the encoder, the trimming, or
# a new pin of the G2P stack in requirements.txt (misaki, phonemizer-fork, espeakng-loader), which the key
# does not otherwise cover.
FORMAT_VERSION = 1
# Past the limit, the oldest lines go until the cache is down to this share of it: one scan of the
# directory frees room for many lines, instead of a scan on every line made (final review M5).
LOW_WATER = 0.9


def cache_key(model: str, voice: str, speed: float, text: str) -> str:
    raw = json.dumps([model, voice, round(speed, 3), text, FORMAT_VERSION], ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class Cache:
    def __init__(self, root: Path, limit_bytes: int):
        self.root = root
        self.limit = limit_bytes
        self._lock = threading.Lock()
        root.mkdir(parents=True, exist_ok=True)
        for part in root.glob("*.part"):   # a write cut short by a stop
            part.unlink(missing_ok=True)
        self._total = sum(f.stat().st_size for f in root.glob("*.mp3"))

    def path(self, key: str) -> Path:
        return self.root / f"{key}.mp3"

    def get(self, key: str) -> bytes | None:
        try:
            data = self.path(key).read_bytes()
        except FileNotFoundError:
            return None
        self.has(key)   # read: now the most recently used (evicted meanwhile? the bytes read are still good)
        return data

    def has(self, key: str) -> bool:
        """Whether the line is cached, marking it the most recently used (the newest mtime: atime is
        unreliable on noatime mounts). Reads nothing."""
        try:
            os.utime(self.path(key))
        except FileNotFoundError:
            return False
        return True

    def put(self, key: str, data: bytes) -> None:
        p = self.path(key)
        tmp = p.with_suffix(".part")
        with self._lock:
            old = p.stat().st_size if p.exists() else 0
            tmp.write_bytes(data)
            os.replace(tmp, p)
            self._total += len(data) - old
            if self._total > self.limit:
                self._evict(keep=p)

    def _evict(self, keep: Path) -> None:
        files = []
        for f in self.root.glob("*.mp3"):
            if f == keep:
                continue
            try:
                files.append((f.stat().st_mtime, f))
            except FileNotFoundError:
                continue
        for _, f in sorted(files):
            if self._total <= self.limit * LOW_WATER:
                break
            try:
                size = f.stat().st_size
                f.unlink()
            except FileNotFoundError:
                continue
            self._total -= size
