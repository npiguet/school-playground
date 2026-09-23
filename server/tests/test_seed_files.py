import json, re
from pathlib import Path
import pytest
from app.levels import LEVELS
from app.textutil import word_count, has_digits

SEED_DIR = Path(__file__).resolve().parents[2] / "content" / "seed"
FILES = sorted(SEED_DIR.glob("*.json")) if SEED_DIR.exists() else []
REQUIRED = {"title", "author", "author_death", "translator", "translator_death", "work", "year",
            "level", "original", "source_url", "license_note", "body"}


@pytest.mark.parametrize("path", FILES, ids=[p.stem for p in FILES])
def test_seed_file_is_valid(path):
    assert re.fullmatch(r"\d{3}-[a-z0-9-]+", path.stem), "file name must be NNN-slug"
    d = json.loads(path.read_text(encoding="utf-8"))
    assert REQUIRED <= set(d), REQUIRED - set(d)
    assert d["level"] in LEVELS
    assert 80 <= word_count(d["body"]) <= 200, word_count(d["body"])
    assert not has_digits(d["body"]), "numbers must be written as words"
    if d["original"]:
        assert d["author"] == "Les Muses de la Discorde"
    else:
        assert isinstance(d["author_death"], int) and d["author_death"] < 1956
        assert d["source_url"], "non-original passages must cite their source"
        if d["translator"]:
            assert isinstance(d["translator_death"], int) and d["translator_death"] < 1956


def test_titles_unique():
    titles = [json.loads(p.read_text(encoding="utf-8"))["title"] for p in FILES]
    assert len(titles) == len(set(titles))
