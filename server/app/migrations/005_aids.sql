-- Sub-project 1 (spec 2026-09-29 §8): the review aids taken for each session, and the mistakes
-- introduced while proofreading, per category. Nothing is dropped: help_stage stays on profile and
-- session (new sessions write 0).
ALTER TABLE session ADD COLUMN aids TEXT;   -- JSON list of the aids taken; NULL before sub-project 1
ALTER TABLE profile_stat ADD COLUMN introduced INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profile_stat_day ADD COLUMN introduced INTEGER NOT NULL DEFAULT 0;
