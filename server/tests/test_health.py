def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "version": "0.1.0"}


def test_spa_fallback_serves_index(settings, client):
    settings.static_dir.mkdir(parents=True)
    (settings.static_dir / "index.html").write_text("<html>discorde</html>")
    assert "discorde" in client.get("/").text
    assert "discorde" in client.get("/some/deep/route").text
    assert client.get("/api/nope").status_code == 404
