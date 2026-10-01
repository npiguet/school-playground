// Shared domain/API types, mirroring server/app/schemas.py. Single source of
// truth for the grading engine's own types lives in ./grading/types — we only
// re-export ArgusPass from there rather than redeclaring it.
import type { Avatar } from './levels';

export type { ArgusPass, Annotation } from './grading/types';

export interface ProfileSettings {
  /** Spec 2026-09-29 §3: the review aids taken last, pre-selected at the next muster (written by the
   *  server with each session). Absent or null (a hand-edited setting): all five. */
  aids?: string[] | null;
  /** Before UI5: one switch for the music and the effects. Read once to seed `audio` (Ruling E2); no longer written. */
  mute?: boolean;
  /** UI5 (spec §7): the three channels, always saved whole. */
  audio?: import('./audio/settings').AudioSettings;
  /** UI5 (spec §8): the places whose first-visit tour was seen or skipped. */
  tours?: string[];
  /** Sessions per ISO week (decision 15), adjustable 2-5 on the cabin lyre (settings); defaults to 3 client-side. */
  weekly_goal?: number;
  /** The camp's first visit was welcomed (decision 22): the Muses' cards before UI5, the camp tour
   *  since (written with `tours`; true counts as the camp tour seen, Ruling E13). */
  onboarded?: boolean;
  /** Final review I3 (sub-project 3): the dragon's stage the hero last saw, written by a victory that
   *  shows it grow and by the camp's « grew while you were away » reveal. Absent: never shown. */
  dragon_seen_stage?: string | null;
}

export interface Profile {
  id: number;
  name: string;
  avatar: Avatar;
  level: string;
  has_pin: boolean;
  created_at: string;
  settings: ProfileSettings;
}

export interface TextHistory {
  times_played: number;
  best_score: number | null;
  best_catch_rate: number | null;
}

export interface TextSummary {
  id: number;
  title: string;
  level: string;
  source: string;
  author: string | null;
  translator: string | null;
  work: string | null;
  credits: string | null;
  word_count: number;
  added_by_profile_id: number | null;
  added_by_name: string | null;
  due_date: string | null;
  created_at: string;
  history: TextHistory | null;
  scan_id: string | null;
  photo_count: number;
}

export interface TextFull extends TextSummary {
  body: string;
  annotation: import('./grading/types').Annotation;
}

export interface TextCreateBody {
  title: string;
  body: string;
  level: string;
  source: string;
  author?: string | null;
  translator?: string | null;
  work?: string | null;
  credits?: string | null;
  added_by_profile_id?: number | null;
  due_date?: string | null;
  scan_id?: string | null;
}

export interface ScanPage {
  index: number;
  text: string;
  low_confidence: string[];
  width: number;
  height: number;
}

export interface ScanResult {
  scan_id: string;
  pages: ScanPage[];
  text: string;
}

/** A play session's mode (SP2 Task 4/9): `'dictation'` is the SP1 flow (listen, write, proofread);
 *  `'grimoire'` skips straight to proofreading a text Éris has already corrupted. */
export type PlayMode = 'dictation' | 'grimoire';

/** One error Éris planted in a `corrupt` response (mirrors `server/app/schemas.py`'s plant dict). */
export interface Plant {
  token: number;
  start: number;
  end: number;
  original: string;
  mutated: string;
  category: string;
}

export interface CorruptResult {
  text_id: number;
  corrupted: string;
  count: number;
  plants: Plant[];
}

/** One allowlisted work in the Bibliothèque d'Alexandrie (SP2 Task 5/10). */
export interface AlexandriaWork {
  id: string;
  title: string;
  author: string;
  translator: string | null;
  credits: string;
  level_hint: string;
  source: string;
  status: 'never' | 'ok' | 'error';
  fetched_at: string | null;
  error: string | null;
  chunk_count: number;
}

/** One scored, cached chunk ("rouleau") of a work, ready to browse or adopt. */
export interface AlexandriaChunk {
  id: number;
  seq: number;
  level: string;
  word_count: number;
  score: number;
  preview: string;
  text_id: number | null;
}

/** Result of refreshing a work's cache from the online source; never thrown as an
 *  error by the API even when the network fails (`status: 'error'`). */
export interface RefreshResult {
  status: 'ok' | 'error';
  error: string | null;
  chunk_count: number;
  rejected: Record<string, number>;
}

export interface ProfileCreateBody {
  name: string;
  avatar: string;
  level: string;
  pin?: string | null;
}

export interface ProfilePatchBody {
  name?: string;
  avatar?: string;
  level?: string;
  pin?: string;
  settings?: ProfileSettings;
}

export interface SessionCreate {
  profile_id: number;
  text_id: number;
  pace_level: number;
  /** Spec 2026-09-29 §3: the review aids taken along (the server remembers them for the next muster). */
  aids: import('./aids').AidKey[];
  mode: PlayMode;
  started_at: string;
  draft: string;
  final: string;
  result: unknown;
  catch_rate: number | null;
  /** SP3 Task 7: which lieutenant/boss this session was played against, if any (world/quests.ts'
   *  quest-aware Play). */
  encounter?: string | null;
  /** SP3 Task 7: the quest this session counts towards, if the player launched it from one. */
  quest_id?: number | null;
}

export interface SessionCreated {
  id: number;
  /** SP3 Task 7: the progression this session earned (XP, quests, seals, dragon stage,
   *  weekly goal, boss outcome) - `undefined` until the server lane lands. */
  progression?: import('./world/types').Progression;
}

export interface CategoryRow {
  category: string;
  occurrences: number;
  errors_in_draft: number;
  caught: number;
  missed: number;
  catch_rate: number | null;
}

export interface RecentSession {
  id: number;
  text_id: number;
  title: string;
  finished_at: string;
  score: number;
  catch_rate: number | null;
  pace_level: number;
  mode: PlayMode;
  /** Spec 2026-09-29 §3: the aids taken for this defence, null before the aids existed. */
  aids: string[] | null;
  /** Mistakes left per 100 words in the handed-in copy; null for a text without words. */
  per_100: number | null;
}

export interface TrapWord {
  word: string;
  box: number;
  misses: number;
  last_seen: string;
}

export interface StatsResponse {
  profile: Profile;
  categories: CategoryRow[];
  recent_sessions: RecentSession[];
  trap_words: TrapWord[];
  totals: { sessions: number; score: number; caught: number };
  argus_order: import('./grading/types').ArgusPass[];
}
