-- SP3: world and progression (quests, oracle, dragon, rewards, xp ledger, mastery).
ALTER TABLE session ADD COLUMN encounter TEXT;            -- NULL | lieutenant key | 'eris'
ALTER TABLE session ADD COLUMN quest_id INTEGER;          -- NULL | quest.id (no FK: quests may be deleted with the profile)
CREATE TABLE quest (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('board','oracle','boss')), target TEXT NOT NULL, week TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','shelved','expired')),
  goal_json TEXT NOT NULL, progress_json TEXT NOT NULL DEFAULT '{}', reward_json TEXT NOT NULL,
  created_at TEXT NOT NULL, completed_at TEXT);
CREATE INDEX quest_profile_status ON quest(profile_id, status);
CREATE TABLE oracle (profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE, week TEXT NOT NULL,
  scrolls_json TEXT NOT NULL, chosen TEXT, quest_id INTEGER, consulted_at TEXT, PRIMARY KEY (profile_id, week));
CREATE TABLE dragon (profile_id INTEGER PRIMARY KEY REFERENCES profile(id) ON DELETE CASCADE, name TEXT,
  tint TEXT NOT NULL DEFAULT 'bronze', stage TEXT NOT NULL DEFAULT 'egg', hatched_at TEXT, updated_at TEXT NOT NULL);
CREATE TABLE reward (profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE, reward_id TEXT NOT NULL,
  source TEXT NOT NULL, granted_at TEXT NOT NULL, equipped INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (profile_id, reward_id));
CREATE TABLE xp_event (id INTEGER PRIMARY KEY AUTOINCREMENT, profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE,
  session_id INTEGER, quest_id INTEGER, amount INTEGER NOT NULL, reason TEXT NOT NULL, week TEXT, created_at TEXT NOT NULL);
CREATE INDEX xp_event_profile ON xp_event(profile_id);
CREATE TABLE mastery (profile_id INTEGER NOT NULL REFERENCES profile(id) ON DELETE CASCADE, lieutenant TEXT NOT NULL,
  neutralised_at TEXT NOT NULL, PRIMARY KEY (profile_id, lieutenant));
