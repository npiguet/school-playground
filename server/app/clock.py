"""Swiss local days and ISO weeks (plan Decision 4). All stored timestamps stay UTC ISO 8601."""
from __future__ import annotations
import os
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

DEFAULT_TZ = os.environ.get("DISCORDE_TZ", "Europe/Zurich")


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def local_day(iso_utc: str, tz: str = DEFAULT_TZ) -> str:
    dt = datetime.fromisoformat(iso_utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(ZoneInfo(tz)).date().isoformat()


def iso_week(day: str) -> str:
    y, w, _ = date.fromisoformat(day).isocalendar()
    return f"{y}-W{w:02d}"


def week_days(week: str) -> list[str]:
    y, w = int(week[:4]), int(week[-2:])
    monday = date.fromisocalendar(y, w, 1)
    return [(monday + timedelta(days=i)).isoformat() for i in range(7)]


def week_bounds_utc(week: str, tz: str = DEFAULT_TZ) -> tuple[str, str]:
    """The week's local Monday 00:00 and the following Monday 00:00, converted to UTC ISO
    strings, so callers can compare stored (UTC) timestamps against a Swiss ISO week without
    the UTC-date-prefix drift near week edges (plan Decision 4; SP3 batch review I4)."""
    y, w = int(week[:4]), int(week[-2:])
    monday = date.fromisocalendar(y, w, 1)
    start_local = datetime.combine(monday, datetime.min.time(), tzinfo=ZoneInfo(tz))
    end_local = start_local + timedelta(days=7)
    return start_local.astimezone(timezone.utc).isoformat(), end_local.astimezone(timezone.utc).isoformat()
