-- SP2: proofreading-only sessions (Grimoire corrompu) are recorded with mode = 'grimoire'.
ALTER TABLE session ADD COLUMN mode TEXT NOT NULL DEFAULT 'dictation';
