"""UI5 Ruling E16: the audio files are served as audio/mp4, like the WebP art and the WOFF2 fonts."""
import mimetypes

import app.main  # noqa: F401  (registers the types at import)


def test_m4a_is_audio_mp4():
    assert mimetypes.guess_type("camp.m4a")[0] == "audio/mp4"


def test_the_spa_catch_all_serves_an_m4a_as_audio(settings, client):
    music = settings.static_dir / "audio" / "music"
    music.mkdir(parents=True)
    (settings.static_dir / "index.html").write_text("<html>discorde</html>")
    (music / "x.m4a").write_bytes(b"\x00\x00\x00\x18ftypM4A ")
    res = client.get("/audio/music/x.m4a")
    assert res.status_code == 200
    assert res.headers["content-type"] == "audio/mp4"
