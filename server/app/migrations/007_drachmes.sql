-- Sub-project 4 (spec 2026-09-29 drachmes §1, §5): the drachme ledger, like xp_event: the balance is
-- its sum. Every hero receives a starting grant of a tenth of the XP already won (floor; none under
-- 10 XP), so existing play is rewarded. The divisor is fixed here: a migration runs once.
CREATE TABLE drachme_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,          -- grant | session | board | oracle | weekly | level | boss | purchase
  ref TEXT,                      -- session:<id> | the item bought | NULL for the grant
  created_at TEXT NOT NULL);
CREATE INDEX drachme_event_profile ON drachme_event(profile_id);
INSERT INTO drachme_event(profile_id, amount, reason, ref, created_at)
  SELECT profile_id, SUM(amount) / 10, 'grant', NULL, strftime('%Y-%m-%dT%H:%M:%S+00:00', 'now')
  FROM xp_event GROUP BY profile_id HAVING SUM(amount) >= 10;
