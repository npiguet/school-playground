"""Scan API: photograph a printed handout, OCR it with Tesseract `fra`, store the
originals under the data volume (spec §3.2, §5). Synchronous: at most 5 photos,
12 MB each, JPEG/PNG/WEBP only (iPad Safari already converts HEIC for <input type=file>).
"""
from __future__ import annotations
import re
import shutil
import sqlite3
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse

from app.ocr import ocr_page, run_tesseract

router = APIRouter(prefix="/api/scan", tags=["scan"])

ALLOWED = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_PHOTOS = 5
MAX_BYTES = 12 * 1024 * 1024
SCAN_ID_RE = re.compile(r"^[0-9a-f]{32}$")

MEDIA_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


def scan_dir(data_dir: Path, scan_id: str) -> Path:
    return data_dir / "scans" / scan_id


def get_ocr(request: Request):
    return getattr(request.app.state, "ocr", None) or run_tesseract


@router.post("", status_code=201)
def scan(request: Request, photos: list[UploadFile] = File(...)):
    if not photos:
        raise HTTPException(422, "Aucune photo reçue.")
    if len(photos) > MAX_PHOTOS:
        raise HTTPException(422, "Cinq photos au maximum.")

    ocr = get_ocr(request)
    settings = request.app.state.settings
    scan_id = uuid.uuid4().hex
    folder = scan_dir(settings.data_dir, scan_id)

    contents: list[tuple[bytes, str]] = []
    for photo in photos:
        data = photo.file.read()
        if len(data) > MAX_BYTES:
            raise HTTPException(422, "Photo trop lourde (12 Mo au maximum).")
        ext = ALLOWED.get(photo.content_type)
        if ext is None:
            raise HTTPException(422, "Format d'image non pris en charge (JPEG ou PNG).")
        contents.append((data, ext))

    folder.mkdir(parents=True, exist_ok=True)
    pages = []
    try:
        for n, (data, ext) in enumerate(contents, start=1):
            (folder / f"page-{n}.{ext}").write_bytes(data)
            page = ocr_page(data, ocr)
            pages.append({"index": n, **page})
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(422, "Impossible de lire cette image.")

    text = "\n\n".join(p["text"] for p in pages if p["text"])
    if not text.strip():
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(422, "Aucun texte lisible sur cette photo. Prends-la bien à plat, en pleine lumière.")

    return {"scan_id": scan_id, "pages": pages, "text": text}


@router.get("/{scan_id}/page/{n}")
def get_page(scan_id: str, n: int, request: Request):
    if not SCAN_ID_RE.fullmatch(scan_id):
        raise HTTPException(404, "Not found")
    folder = scan_dir(request.app.state.settings.data_dir, scan_id)
    matches = sorted(folder.glob(f"page-{n}.*")) if folder.is_dir() else []
    if not matches:
        raise HTTPException(404, "Not found")
    path = matches[0]
    media_type = MEDIA_TYPES.get(path.suffix.lstrip(".").lower(), "application/octet-stream")
    return FileResponse(path, media_type=media_type)


def sweep_orphan_scans(data_dir: Path, conn: sqlite3.Connection, max_age_hours: int = 24) -> int:
    scans_dir = data_dir / "scans"
    if not scans_dir.exists():
        return 0
    referenced = {
        row[0].split("/", 1)[1]
        for row in conn.execute("SELECT photo_path FROM text WHERE photo_path LIKE 'scans/%'")
    }
    removed = 0
    cutoff = max_age_hours * 3600
    for d in scans_dir.iterdir():
        if not d.is_dir():
            continue
        if d.name not in referenced and time.time() - d.stat().st_mtime > cutoff:
            shutil.rmtree(d, ignore_errors=True)
            removed += 1
    return removed
