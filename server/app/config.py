"""Environment-driven settings. Every path has a sane default for the production image."""
from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path

UNKNOWN = "unknown"


@dataclass(frozen=True)
class Settings:
    data_dir: Path = Path("/data")
    content_dir: Path = Path("/app/content")
    static_dir: Path = Path("/app/static")
    spacy_model: str = "fr_core_news_lg"
    seed_on_startup: bool = True
    alexandria_offline_dir: Path | None = None
    test_hooks: bool = False
    tts_url: str = "http://tts:8000"
    # The build stamp (GET /api/health, the lyre's credits): the Dockerfile's GIT_COMMIT and BUILD_DATE
    # build args, "unknown" when the image was built without them.
    build_commit: str = UNKNOWN
    build_date: str = UNKNOWN

    @classmethod
    def from_env(cls) -> "Settings":
        offline_dir = os.environ.get("DISCORDE_ALEXANDRIA_OFFLINE_DIR")
        return cls(
            data_dir=Path(os.environ.get("DISCORDE_DATA_DIR", "/data")),
            content_dir=Path(os.environ.get("DISCORDE_CONTENT_DIR", "/app/content")),
            static_dir=Path(os.environ.get("DISCORDE_STATIC_DIR", "/app/static")),
            spacy_model=os.environ.get("SPACY_MODEL", "fr_core_news_lg"),
            seed_on_startup=os.environ.get("DISCORDE_SEED", "1") == "1",
            alexandria_offline_dir=Path(offline_dir) if offline_dir else None,
            test_hooks=os.environ.get("DISCORDE_TEST_HOOKS") == "1",
            tts_url=os.environ.get("DISCORDE_TTS_URL", "http://tts:8000"),
            build_commit=_stamp("DISCORDE_BUILD_COMMIT"),
            build_date=_stamp("DISCORDE_BUILD_DATE"),
        )


def _stamp(name: str) -> str:
    """An empty value (a build arg passed empty) is as unknown as a missing one."""
    return os.environ.get(name, "").strip() or UNKNOWN
