import os, time
from pathlib import Path
from app.ocr import OcrWord
from app.routers.scan import sweep_orphan_scans

FIX = Path(__file__).parent / "fixtures" / "scan"


def fake_ocr(img):
    return [OcrWord("Les", 95, 1, 1, 1, 0, 0, 1, 1), OcrWord("fées", 40, 1, 1, 1, 0, 0, 1, 1), OcrWord("dansent.", 95, 1, 1, 1, 0, 0, 1, 1)]


def upload(client, names):
    files = [("photos", (n, (FIX / n).read_bytes(), "image/png" if n.endswith(".png") else "image/jpeg")) for n in names]
    return client.post("/api/scan", files=files)


def test_scan_stores_photos_and_returns_text(client, settings):
    client.app.state.ocr = fake_ocr
    r = upload(client, ["handout.png", "handout-rotated.jpg"])
    assert r.status_code == 201, r.text
    d = r.json()
    assert len(d["scan_id"]) == 32 and len(d["pages"]) == 2
    assert d["pages"][0]["text"] == "Les fées dansent." and d["pages"][0]["low_confidence"] == ["fées"]
    assert d["text"] == "Les fées dansent.\n\nLes fées dansent."
    folder = settings.data_dir / "scans" / d["scan_id"]
    assert (folder / "page-1.png").read_bytes() == (FIX / "handout.png").read_bytes()   # original bytes, untouched
    assert (folder / "page-2.jpg").exists()
    page = client.get(f"/api/scan/{d['scan_id']}/page/2")
    assert page.status_code == 200 and page.headers["content-type"].startswith("image/jpeg")
    assert client.get(f"/api/scan/{d['scan_id']}/page/3").status_code == 404
    assert client.get("/api/scan/../etc/page/1").status_code in (404, 422)


def test_scan_validation(client):
    client.app.state.ocr = fake_ocr
    assert client.post("/api/scan", files=[]).status_code == 422
    assert upload(client, ["handout.png"] * 6).status_code == 422
    r = client.post("/api/scan", files=[("photos", ("x.txt", b"hello", "text/plain"))])
    assert r.status_code == 422 and "JPEG ou PNG" in r.text
    client.app.state.ocr = lambda img: []
    r = upload(client, ["handout.png"])
    assert r.status_code == 422 and "Aucun texte lisible" in r.text


def test_text_from_scan_links_photos(client, settings):
    client.app.state.ocr = fake_ocr
    scan_id = upload(client, ["handout.png"]).json()["scan_id"]
    body = {"title": "Feuille", "body": "Les fées dansent dans la clairière et les oiseaux les écoutent.", "level": "8H",
            "source": "scan", "scan_id": scan_id, "due_date": "2030-01-15"}
    r = client.post("/api/texts", json=body)
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["source"] == "scan" and t["scan_id"] == scan_id and t["photo_count"] == 1 and t["due_date"] == "2030-01-15"
    listed = client.get("/api/texts").json()
    assert listed[0]["scan_id"] == scan_id
    assert client.post("/api/texts", json={**body, "scan_id": "0" * 32}).status_code == 422
    assert client.post("/api/texts", json={**body, "scan_id": None}).status_code == 422


def test_sweep_removes_only_old_unreferenced_scans(client, settings):
    client.app.state.ocr = fake_ocr
    kept = upload(client, ["handout.png"]).json()["scan_id"]
    client.post("/api/texts", json={"title": "F", "body": "Les fées dansent dans la clairière.", "level": "8H", "source": "scan", "scan_id": kept})
    old = upload(client, ["handout.png"]).json()["scan_id"]
    fresh = upload(client, ["handout.png"]).json()["scan_id"]
    scans = settings.data_dir / "scans"
    past = time.time() - 48 * 3600
    os.utime(scans / kept, (past, past))
    os.utime(scans / old, (past, past))
    from app.db import connect
    conn = connect(settings.data_dir / "discorde.sqlite3")
    assert sweep_orphan_scans(settings.data_dir, conn) == 1
    assert (scans / kept).exists() and (scans / fresh).exists() and not (scans / old).exists()
