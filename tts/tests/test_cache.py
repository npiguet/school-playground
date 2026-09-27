import os

from app import cache as cache_mod
from app.cache import Cache, cache_key


def test_the_key_names_everything_that_changes_the_sound():
    base = cache_key("m", "ff_siwis", 1.0, "Un matin. Point.")
    assert base == cache_key("m", "ff_siwis", 1.0, "Un matin. Point.")
    assert len(base) == 64
    others = {cache_key("m2", "ff_siwis", 1.0, "Un matin. Point."), cache_key("m", "af_heart", 1.0, "Un matin. Point."),
              cache_key("m", "ff_siwis", 0.9, "Un matin. Point."), cache_key("m", "ff_siwis", 1.0, "Un soir. Point.")}
    assert base not in others and len(others) == 4
    assert cache_key("m", "v", 0.9, "x") == cache_key("m", "v", 0.9000001, "x")


def test_the_format_version_changes_the_key(monkeypatch):
    before = cache_key("m", "v", 1.0, "x")
    monkeypatch.setattr(cache_mod, "FORMAT_VERSION", cache_mod.FORMAT_VERSION + 1)
    assert cache_key("m", "v", 1.0, "x") != before


def test_a_line_comes_back_as_it_went_in(tmp_path):
    c = Cache(tmp_path, limit_bytes=1000)
    assert c.get("k") is None
    c.put("k", b"mp3")
    assert c.get("k") == b"mp3"
    assert c.path("k") == tmp_path / "k.mp3"
    assert list(tmp_path.glob("*.part")) == []


def test_the_least_recently_used_lines_go_first(tmp_path):
    c = Cache(tmp_path, limit_bytes=250)
    c.put("a", b"x" * 100)
    os.utime(c.path("a"), (1000, 1000))
    c.put("b", b"x" * 100)
    os.utime(c.path("b"), (1001, 1001))
    c.put("c", b"x" * 100)          # 300 > 250: « a », the oldest, goes
    assert c.get("a") is None
    os.utime(c.path("c"), (2000, 2000))
    assert c.get("b") == b"x" * 100  # read now: the most recent
    c.put("d", b"x" * 100)          # « c » is now the oldest
    assert c.get("c") is None
    assert c.get("b") is not None and c.get("d") is not None


def test_what_an_earlier_run_left_counts(tmp_path):
    for k in "abc":
        (tmp_path / f"{k}.mp3").write_bytes(b"x" * 100)
        os.utime(tmp_path / f"{k}.mp3", (1000 + ord(k), 1000 + ord(k)))
    (tmp_path / "z.part").write_bytes(b"half")
    c = Cache(tmp_path, limit_bytes=250)
    assert not (tmp_path / "z.part").exists()
    c.put("d", b"x" * 100)
    assert sorted(p.stem for p in tmp_path.glob("*.mp3")) == ["c", "d"]
