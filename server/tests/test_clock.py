from app.clock import local_day, iso_week, week_days


def test_local_day_is_swiss():
    assert local_day("2026-09-24T22:30:00+00:00") == "2026-09-25"   # 00:30 CEST next day
    assert local_day("2026-01-10T23:30:00+00:00") == "2026-01-11"   # CET
    assert local_day("2026-09-24T10:00:00+00:00") == "2026-09-24"


def test_iso_week():
    assert iso_week("2026-09-24") == "2026-W39"
    assert iso_week("2026-01-01") == "2026-W01"
    assert iso_week("2027-01-01") == "2026-W53"


def test_week_days():
    days = week_days("2026-W39")
    assert days[0] == "2026-09-21" and days[-1] == "2026-09-27" and len(days) == 7
