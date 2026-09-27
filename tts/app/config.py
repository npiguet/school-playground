"""The voice service's environment (spec 2026-09-27 §4.1)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Config:
    stub: bool
    threads: int
    cache_dir: Path
    cache_mb: int
    respell_path: Path
    model_dir: Path

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            stub=os.environ.get("TTS_STUB") == "1",
            threads=max(1, int(os.environ.get("TTS_THREADS", "4"))),
            cache_dir=Path(os.environ.get("TTS_CACHE_DIR", "/cache")),
            cache_mb=max(1, int(os.environ.get("TTS_CACHE_MB", "2048"))),
            respell_path=Path(os.environ.get("TTS_RESPELL", "/srv/respell.json")),
            model_dir=Path(os.environ.get("TTS_MODEL_DIR", "/models")),
        )
