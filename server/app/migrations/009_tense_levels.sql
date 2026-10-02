-- Verb-tense levels (README §8, app.nlp.tenses): a text's level is the higher of its own level and
-- the class that introduces its hardest verb tense (Plan d'études romand). `base_level` keeps the
-- text's own level (chosen at the pupitre or the lens, the seed file's, the Alexandria scoring's) so
-- the rule can be applied again at every start-up (app.relevel) without ever going below it;
-- `tenses_json` holds the unambiguous forms counted per tense ({"passe_simple_3": 4}). The levels
-- themselves are raised by app.relevel at start-up: it needs the Lexique, which SQL has not.
--
-- base_level is never empty: SQLite adds a NOT NULL column only with a default, so the existing rows
-- are backfilled from `level` and a row inserted without one (an older writer, a test fixture) takes
-- its `level` through the triggers. Every reader can then trust it.
ALTER TABLE text ADD COLUMN base_level TEXT NOT NULL DEFAULT '';
UPDATE text SET base_level = level;
ALTER TABLE text ADD COLUMN tenses_json TEXT NOT NULL DEFAULT '{}';
CREATE TRIGGER text_base_level AFTER INSERT ON text WHEN NEW.base_level = ''
BEGIN
  UPDATE text SET base_level = NEW.level WHERE id = NEW.id;
END;

ALTER TABLE online_chunk ADD COLUMN base_level TEXT NOT NULL DEFAULT '';
UPDATE online_chunk SET base_level = level;
ALTER TABLE online_chunk ADD COLUMN tenses_json TEXT NOT NULL DEFAULT '{}';
CREATE TRIGGER online_chunk_base_level AFTER INSERT ON online_chunk WHEN NEW.base_level = ''
BEGIN
  UPDATE online_chunk SET base_level = NEW.level WHERE id = NEW.id;
END;
