// Shared domain/API types, mirroring server/app/schemas.py. Single source of
// truth for the grading engine's own types lives in ./grading/types — we only
// re-export ArgusPass from there rather than redeclaring it.
import type { Avatar } from './levels';

export type { ArgusPass, Annotation } from './grading/types';

export interface ProfileSettings {
  voice?: string;
}

export interface Profile {
  id: number;
  name: string;
  avatar: Avatar;
  level: string;
  has_pin: boolean;
  help_stage: number;
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
  help_stage: number;
  started_at: string;
  draft: string;
  final: string;
  result: unknown;
  score: number;
  catch_rate: number | null;
}

export interface SessionCreated {
  id: number;
  help_stage_before: number;
  help_stage_after: number;
  help_stage_message: string | null;
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
  help_stage: number;
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
