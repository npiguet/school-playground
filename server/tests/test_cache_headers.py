"""The browser keeps nothing the SPA catch-all serves (iPad Safari kept a stale index.html that named
the previous build's bundle, so a new build seemed not to take effect). The game is played on the
home network, so fetching every file again costs next to nothing: every static response is
`no-store`, and a new build shows at the next page load. /api/ is untouched."""
import pytest

NO_STORE = "no-store"


@pytest.fixture
def static(settings):
    root = settings.static_dir
    for rel, data in {
        "index.html": b"<html>discorde</html>",
        "assets/index-3f2a9c1d.js": b"console.log(1)",
        "assets/index-8e7b6a5c.css": b"body{}",
        "art/scenes/camp.webp": b"RIFF....WEBP",
        "audio/music/camp.m4a": b"\x00\x00\x00\x18ftypM4A ",
        "fonts/cinzel/x.woff2": b"wOF2",
        "icons/icon-192.png": b"\x89PNG",
        "manifest.json": b"{}",
    }.items():
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_bytes(data)
    return root


@pytest.mark.parametrize("path", ["/", "/index.html", "/some/deep/route", "/assets/index-gone.js"])
def test_index_html_and_every_route_falling_back_to_it_are_never_stored(static, client, path):
    r = client.get(path)
    assert r.status_code == 200 and "discorde" in r.text
    assert r.headers["cache-control"] == NO_STORE


@pytest.mark.parametrize("path", ["/assets/index-3f2a9c1d.js", "/assets/index-8e7b6a5c.css"])
def test_the_hashed_bundle_is_never_stored(static, client, path):
    r = client.get(path)
    assert r.status_code == 200
    assert r.headers["cache-control"] == NO_STORE


@pytest.mark.parametrize("path", [
    "/art/scenes/camp.webp", "/audio/music/camp.m4a", "/fonts/cinzel/x.woff2", "/icons/icon-192.png",
    "/manifest.json",
])
def test_art_audio_fonts_icons_and_the_manifest_are_never_stored(static, client, path):
    r = client.get(path)
    assert r.status_code == 200
    assert r.headers["cache-control"] == NO_STORE


def test_the_api_sets_no_cache_header_of_its_own(static, client):
    assert "cache-control" not in client.get("/api/health").headers
    assert "cache-control" not in client.get("/api/nope").headers
