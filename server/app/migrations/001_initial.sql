-- Initial schema (spec §4 "Data model"). Levels are Swiss HarmoS: 5H=CE2, 6H=CM1, 7H=CM2, 8H=6e, 9H=5e, 10H=4e, 11H=3e.
CREATE TABLE profile (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  avatar        TEXT NOT NULL DEFAULT 'chouette',
  level         TEXT NOT NULL,
  pin_hash      TEXT,
  help_stage    INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX profile_name_nocase ON profile(name COLLATE NOCASE);

CREATE TABLE text (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  source              TEXT NOT NULL CHECK (source IN ('seed','custom','scan','online')),
  seed_key            TEXT UNIQUE,
  level               TEXT NOT NULL,
  author              TEXT,
  translator          TEXT,
  work                TEXT,
  credits             TEXT,
  added_by_profile_id INTEGER REFERENCES profile(id) ON DELETE SET NULL,
  due_date            TEXT,
  photo_path          TEXT,
  annotation_json     TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL
);

CREATE TABLE session (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  text_id     INTEGER NOT NULL REFERENCES text(id) ON DELETE CASCADE,
  pace_level  INTEGER NOT NULL,
  help_stage  INTEGER NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  draft       TEXT NOT NULL,
  final       TEXT NOT NULL,
  result_json TEXT NOT NULL,
  score       INTEGER NOT NULL,
  catch_rate  REAL
);
CREATE INDEX session_profile_finished ON session(profile_id, finished_at);
CREATE INDEX session_profile_text ON session(profile_id, text_id);

CREATE TABLE profile_stat (
  profile_id      INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  occurrences     INTEGER NOT NULL DEFAULT 0,
  errors_in_draft INTEGER NOT NULL DEFAULT 0,
  caught          INTEGER NOT NULL DEFAULT 0,
  missed          INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL,
  PRIMARY KEY (profile_id, category)
);

CREATE TABLE profile_stat_day (
  profile_id      INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  day             TEXT NOT NULL,
  category        TEXT NOT NULL,
  occurrences     INTEGER NOT NULL DEFAULT 0,
  errors_in_draft INTEGER NOT NULL DEFAULT 0,
  caught          INTEGER NOT NULL DEFAULT 0,
  missed          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, day, category)
);

CREATE TABLE trap_word (
  profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  word       TEXT NOT NULL,
  box        INTEGER NOT NULL DEFAULT 1,
  last_seen  TEXT NOT NULL,
  misses     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (profile_id, word)
);
