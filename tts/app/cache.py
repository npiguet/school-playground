"""The line cache (spec 2026-09-27 §4.1): one MP3 per line in /cache (its own volume, no backup needed),
named by what changes the sound; the least recently used go first once past TTS_CACHE_MB."""
from __future__ import annotations

import hashlib
import json
import os
import threading
from pathlib import Path

FORMAT_VERSION = 1  # bump when the MP3s change for the same inputs (bitrate, encoder, trimming)


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
        p = self.path(key)
        try:
            data = p.read_bytes()
            os.utime(p)   # most recently used = newest mtime (atime is unreliable on noatime mounts)
        except FileNotFoundError:
            return None
        return data

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
            if self._total <= self.limit:
                break
            try:
                size = f.stat().st_size
                f.unlink()
            except FileNotFoundError:
                continue
            self._total -= size
