-- SP2: Bibliothèque d'Alexandrie cache. A work is an allowlist entry (content/alexandria/works.json); chunks are candidate passages.
CREATE TABLE online_work (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error       TEXT,
  fetched_at  TEXT NOT NULL,
  stats_json  TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE online_chunk (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id         TEXT NOT NULL REFERENCES online_work(id) ON DELETE CASCADE,
  seq             INTEGER NOT NULL,
  body            TEXT NOT NULL,
  word_count      INTEGER NOT NULL,
  level           TEXT NOT NULL,
  score           REAL NOT NULL,
  features_json   TEXT NOT NULL DEFAULT '{}',
  annotation_json TEXT NOT NULL DEFAULT '{}',
  text_id         INTEGER REFERENCES text(id) ON DELETE SET NULL,
  UNIQUE (work_id, seq)
);
CREATE INDEX online_chunk_work_score ON online_chunk(work_id, score DESC);
