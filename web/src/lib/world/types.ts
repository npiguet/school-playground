// World/progression types (SP3 Task 4), mirroring `server/app/schemas.py`'s SP3
// additions (Task 3) and the plan's "Shared contracts" block verbatim. Kept apart
// from `../types` (SP1/SP2 domain types) so this lane and the server lane can land
// independently.
import type { GameRules } from '../rules';
import type { Profile } from '../types';

export const LIEUTENANT_ORDER = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'] as const;
export type LieutenantKey = (typeof LIEUTENANT_ORDER)[number];

export type DragonStage = 'egg' | 'hatchling' | 'young' | 'adult';
export type Tint = 'bronze' | 'ecume' | 'olivier' | 'braise' | 'jade' | 'argent';
export type QuestKind = 'board' | 'oracle' | 'boss';
export type QuestStatus = 'active' | 'done' | 'shelved' | 'expired';
export type ScrollKey = 'faible' | 'ecole' | 'destin';
export type RewardKind = 'relic' | 'tint' | 'gear' | 'decor';

export interface WorldCatalog {
  lieutenants: {
    key: string;
    name: string;
    // Narrative gender for French agreement (l'Hydre/Écho/la Chimère/les Sirènes/Léthé are
    // feminine, Protée is masculine) - see `agree()` in `../world/eris.ts` (SP3 batch review I7).
    gender: 'f' | 'm' | 'fp';
    categories: string[];
    technique: string;
    min_level: string;
    relic: string;
  }[];
  rewards: Record<string, { id: string; kind: RewardKind; name: string; desc: string; source: string }>;
  ranks: { xp: number; title: string }[];
  tints: Tint[];
  oracle_rewards: string[];
  boss_rewards: Record<string, string>;
  mastery: { min_days: number; min_traps: number; rate: number };
  quest_bonus: Record<string, number>;
  /** Spec 2026-09-29 §7: the rules file's values (server/app/rules.py), defaults in lib/rules.ts. */
  rules: GameRules;
}

export interface RewardOut {
  id: string;
  kind: RewardKind;
  name: string;
  desc: string;
  source: string;
  granted_at: string;
  equipped: boolean;
}

export interface Window {
  days: number;
  traps: number;
  caught: number;
  rate: number | null;
  complete: boolean;
}

export interface LieutenantState {
  key: string;
  name: string;
  categories: string[];
  available: boolean;
  neutralised: boolean;
  neutralised_at: string | null;
  window: Window;
  all_time: { traps: number; caught: number; missed: number; rate: number | null };
  last_day: string | null;
  bestiary_unlocked: boolean;
  active_quest_id: number | null;
  stirring: boolean;
}

export interface QuestOut {
  id: number;
  kind: QuestKind;
  target: string;
  week: string | null;
  status: QuestStatus;
  // `tier` is present only on boss quests (server's `create_boss_quest` stores it in `goal_json`
  // alongside `text_id`/`help_stage`, which the client never needs to read here - `worldApi.boss()`
  // returns those at the top level instead). `mode` is set to 'grimoire' server-side after a
  // too_easy boss draw (P1-5 follow-up): the next attempt runs as a Grimoire corrompu session on
  // the same text instead of plain dictation (Boss.svelte reads it to route "Relancer le combat").
  goal: { sessions?: number; min_rate: number; min_draft?: number; tier?: number; mode?: 'grimoire' };
  progress: { sessions: number; log: { session_id: number; ok: boolean }[] };
  reward: { xp: number; reward_id: string | null; bestiary: boolean };
  texts: { id: number; title: string; level: string; word_count: number }[];
  created_at: string;
  completed_at: string | null;
}

export interface DragonOut {
  name: string | null;
  tint: Tint;
  stage: DragonStage;
  neutralised: number;
  available: number;
  next_stage_at: number | null;
  unlocked_tints: Tint[];
}

export interface OracleOut {
  week: string;
  status: 'sealed' | 'chosen';
  reward_id: string | null;
  scrolls: { key: ScrollKey; title: string; hint: string; lieutenant: string | null }[]; // lieutenant revealed only for the chosen scroll
  quest: QuestOut | null;
  prophecies: { text_id: number; title: string; due_date: string; days_left: number }[];
}

export interface CampResponse {
  profile: Profile;
  xp: { total: number; rank: number; title: string; next_threshold: number | null; rank_floor: number };
  dragon: DragonOut;
  lieutenants: LieutenantState[];
  quests: QuestOut[];
  oracle: { week: string; status: 'sealed' | 'chosen'; reward_id: string | null };
  prophecies: OracleOut['prophecies'];
  weekly: { week: string; target: number; done: number; reached: boolean };
  boss: { tier_available: number | null; tiers_won: number[]; active_quest_id: number | null };
  rewards_count: number;
  small_tricks: { traps: number; caught: number };
}

export interface Progression {
  xp: {
    session: number;
    /** Spec 2026-09-29 §4: the session XP broken down for the victory's chips (they add up to `session`).
     *  Absent from a victory saved before the change. */
    parts?: { text: number; pace: number; aids: number; prophecy: number };
    bonuses: { reason: string; amount: number }[];
    total_before: number;
    total_after: number;
    rank_before: number;
    rank_after: number;
    title_after: string;
  };
  quests: {
    id: number;
    kind: QuestKind;
    target: string;
    counted: boolean;
    progress: number;
    goal: number | null;
    completed: boolean;
    reward_id: string | null;
  }[];
  neutralised: string[];
  rewards: { id: string; kind: RewardKind; name: string }[];
  dragon: { stage_before: DragonStage; stage_after: DragonStage; needs_name: boolean };
  weekly: { target: number; done: number; reached_now: boolean };
  // P1-5: a draft with too few errors to judge (< min_draft) is a draw ('too_easy'), not a win -
  // distinct from a real loss so the reveal shows its own encouragement instead of Éris's mocking
  // loss line for a fight she never got to fight.
  boss: { tier: number; won: boolean; too_easy: boolean } | null;
  encounter: string | null;
}
