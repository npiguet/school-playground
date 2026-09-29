from dataclasses import replace

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_health_names_the_build(settings):
    stamped = replace(settings, build_commit="b68ecc8", build_date="2026-09-29")
    with TestClient(create_app(stamped)) as c:
        r = c.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "build": {"commit": "b68ecc8", "date": "2026-09-29"}}


def test_an_unstamped_build_says_unknown(client):
    assert client.get("/api/health").json() == {"status": "ok", "build": {"commit": "unknown", "date": "unknown"}}


def test_the_stamp_comes_from_the_environment(monkeypatch):
    for name in ("DISCORDE_BUILD_COMMIT", "DISCORDE_BUILD_DATE"):
        monkeypatch.delenv(name, raising=False)
    assert (Settings.from_env().build_commit, Settings.from_env().build_date) == ("unknown", "unknown")
    # A build without the args passes them empty (compose's ${GIT_COMMIT:-}): still unknown.
    monkeypatch.setenv("DISCORDE_BUILD_COMMIT", "")
    monkeypatch.setenv("DISCORDE_BUILD_DATE", " ")
    assert (Settings.from_env().build_commit, Settings.from_env().build_date) == ("unknown", "unknown")
    monkeypatch.setenv("DISCORDE_BUILD_COMMIT", "b68ecc8")
    monkeypatch.setenv("DISCORDE_BUILD_DATE", "2026-09-29")
    assert (Settings.from_env().build_commit, Settings.from_env().build_date) == ("b68ecc8", "2026-09-29")


def test_spa_fallback_serves_index(settings, client):
    settings.static_dir.mkdir(parents=True)
    (settings.static_dir / "index.html").write_text("<html>discorde</html>")
    assert "discorde" in client.get("/").text
    assert "discorde" in client.get("/some/deep/route").text
    assert client.get("/api/nope").status_code == 404


def test_spa_serves_woff2_as_font(settings, client):
    fonts = settings.static_dir / "fonts" / "cinzel"
    fonts.mkdir(parents=True)
    (fonts / "x.woff2").write_bytes(b"wOF2")
    r = client.get("/fonts/cinzel/x.woff2")
    assert r.status_code == 200
    assert r.headers["content-type"] == "font/woff2"
