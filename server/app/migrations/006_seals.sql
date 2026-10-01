-- Sub-project 2 (spec 2026-09-29 lieutenant levels §3): the lieutenants' seals. Each neutralised
-- lieutenant becomes seal 1 (bois), won when it was neutralised; its relic becomes the wooden trophy,
-- granted and displayed as the relic was (or when it was neutralised, if the relic row is missing).
-- A relic row without a mastery row (only possible by hand) goes with the others. The mastery table
-- stays (no destructive migration) but is no longer written. XP is untouched.
CREATE TABLE lieutenant_level (
  profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  lieutenant TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  reached_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, lieutenant));
INSERT INTO lieutenant_level(profile_id, lieutenant, level, reached_at)
  SELECT profile_id, lieutenant, 1, neutralised_at FROM mastery;
CREATE TEMP TABLE relic_of (lieutenant TEXT PRIMARY KEY, relic TEXT NOT NULL);
INSERT INTO relic_of VALUES ('hydre', 'ecaille_hydre'), ('echo', 'voix_echo'), ('chimere', 'criniere_chimere'),
  ('protee', 'perle_protee'), ('sirenes', 'plume_sirene'), ('lethe', 'pavot_lethe');
INSERT OR IGNORE INTO reward(profile_id, reward_id, source, granted_at, equipped)
  SELECT m.profile_id, 'trophy:' || m.lieutenant || ':1', 'level:' || m.lieutenant || ':1',
         COALESCE(r.granted_at, m.neutralised_at), COALESCE(r.equipped, 0)
  FROM mastery m JOIN relic_of o ON o.lieutenant = m.lieutenant
  LEFT JOIN reward r ON r.profile_id = m.profile_id AND r.reward_id = o.relic;
DELETE FROM reward WHERE reward_id IN (SELECT relic FROM relic_of);
DROP TABLE relic_of;
