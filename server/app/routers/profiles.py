import json, re, sqlite3
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Response
from app.db import get_db
from app.levels import LEVELS, AVATARS
from app.schemas import ProfileCreate, ProfilePatch, ProfileOut, PinCheck, PIN_RE
from app.security import hash_pin, verify_pin

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_out(row: sqlite3.Row) -> ProfileOut:
    return ProfileOut(id=row["id"], name=row["name"], avatar=row["avatar"], level=row["level"],
                      has_pin=row["pin_hash"] is not None,
                      created_at=row["created_at"], settings=json.loads(row["settings_json"] or "{}"))


def fetch_profile(db: sqlite3.Connection, profile_id: int) -> sqlite3.Row:
    row = db.execute("SELECT * FROM profile WHERE id = ?", (profile_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Profile not found")
    return row


@router.get("", response_model=list[ProfileOut])
def list_profiles(db: sqlite3.Connection = Depends(get_db)):
    return [to_out(r) for r in db.execute("SELECT * FROM profile ORDER BY created_at, id")]


@router.post("", response_model=ProfileOut, status_code=201)
def create_profile(body: ProfileCreate, db: sqlite3.Connection = Depends(get_db)):
    try:
        cur = db.execute(
            "INSERT INTO profile(name, avatar, level, pin_hash, created_at) VALUES (?,?,?,?,?)",
            (body.name.strip(), body.avatar, body.level, hash_pin(body.pin) if body.pin else None, now()))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Ce nom est déjà pris")
    db.commit()
    return to_out(fetch_profile(db, cur.lastrowid))


@router.get("/{profile_id}", response_model=ProfileOut)
def get_profile(profile_id: int, db: sqlite3.Connection = Depends(get_db)):
    return to_out(fetch_profile(db, profile_id))


@router.patch("/{profile_id}", response_model=ProfileOut)
def patch_profile(profile_id: int, body: ProfilePatch, db: sqlite3.Connection = Depends(get_db)):
    row = fetch_profile(db, profile_id)
    updates: dict[str, object] = {}
    if body.name is not None: updates["name"] = body.name.strip()
    if body.avatar is not None:
        if body.avatar not in AVATARS: raise HTTPException(422, "unknown avatar")
        updates["avatar"] = body.avatar
    if body.level is not None:
        if body.level not in LEVELS: raise HTTPException(422, "unknown level")
        updates["level"] = body.level
    if body.pin is not None:
        if body.pin == "": updates["pin_hash"] = None
        elif re.fullmatch(PIN_RE, body.pin): updates["pin_hash"] = hash_pin(body.pin)
        else: raise HTTPException(422, "pin must be 4 digits")
    if body.settings is not None:
        merged = {**json.loads(row["settings_json"] or "{}"), **body.settings}
        updates["settings_json"] = json.dumps(merged, ensure_ascii=False)
    if updates:
        sets = ", ".join(f"{k} = ?" for k in updates)
        try:
            db.execute(f"UPDATE profile SET {sets} WHERE id = ?", (*updates.values(), profile_id))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Ce nom est déjà pris")
        db.commit()
    return to_out(fetch_profile(db, profile_id))


@router.delete("/{profile_id}", status_code=204)
def delete_profile(profile_id: int, db: sqlite3.Connection = Depends(get_db)):
    fetch_profile(db, profile_id)
    db.execute("DELETE FROM profile WHERE id = ?", (profile_id,))
    db.commit()
    return Response(status_code=204)


@router.post("/{profile_id}/verify-pin")
def check_pin(profile_id: int, body: PinCheck, db: sqlite3.Connection = Depends(get_db)):
    row = fetch_profile(db, profile_id)
    if row["pin_hash"] is None:
        return {"ok": True}
    return {"ok": verify_pin(body.pin, row["pin_hash"])}
