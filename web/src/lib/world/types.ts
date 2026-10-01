// World/progression types (SP3 Task 4), mirroring `server/app/schemas.py`'s SP3
// additions (Task 3) and the plan's "Shared contracts" block verbatim. Kept apart
// from `../types` (SP1/SP2 domain types) so this lane and the server lane can land
// independently.
import type { GameRules } from '../rules';
import type { Profile } from '../types';

export const LIEUTENANT_ORDER = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'] as const;
export type LieutenantKey = (typeof LIEUTENANT_ORDER)[number];

/** Spec 2026-09-29 dragon growth §1: the six stages, in order (server/app/world/dragon.py STAGE_ORDER). */
export const DRAGON_STAGES = ['egg', 'hatchling', 'young', 'adult', 'illustre', 'ancestral'] as const;
export type DragonStage = (typeof DRAGON_STAGES)[number];
export type Tint = 'bronze' | 'ecume' | 'olivier' | 'braise' | 'jade' | 'argent';
export type QuestKind = 'board' | 'oracle' | 'boss';
export type QuestStatus = 'active' | 'done' | 'shelved' | 'expired';
export type ScrollKey = 'faible' | 'ecole' | 'destin';
export type RewardKind = 'trophy' | 'tint' | 'gear' | 'decor' | 'accessory' | 'house';
/** Spec 2026-09-29 drachmes §3: the house the hero lives in (the highest one owned). */
export type House = 'cabin' | 'villa' | 'palais';
/** Spec §4: where the dragon wears a piece. */
export type Slot = 'cou' | 'queue' | 'dos' | 'tete';

/** Spec §2 (R9): Hermès's stall as `/api/world` serves it; names and descriptions are in `rewards`. */
export interface ShopCatalog {
  slots: Slot[];
  slot_levels: Record<Slot, number>;
  draw_order: Slot[];
  accessories: { id: string; item: string; lieutenant: string; slot: Slot; level: number; price: number; the: string }[];
  decor: { id: string; price: number; the: string }[];
  houses: { id: string; key: 'villa' | 'palais'; stage: DragonStage; after: string | null; price: number; the: string }[];
  max_decor: Record<House, number>;
}

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
  }[];
  rewards: Record<string, { id: string; kind: RewardKind; name: string; desc: string; source: string }>;
  /** Spec 2026-09-29 dragon growth §2: the dragon's stages, their names and XP (from data/regles.json). */
  stages: { key: DragonStage; name: string; xp: number }[];
  tints: Tint[];
  oracle_rewards: string[];
  boss_rewards: Record<string, string>;
  quest_bonus: Record<string, number>;
  /** A seal L pays level_xp × L XP (spec 2026-09-29 lieutenant levels §1), read by the guide. */
  level_xp: number;
  /** Spec 2026-09-29 §7: the rules file's values (server/app/rules.py), defaults in lib/rules.ts. */
  rules: GameRules;
  /** Spec 2026-09-29 drachmes §2: Hermès's stall, its items and prices. */
  shop: ShopCatalog;
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

/** Spec 2026-09-29 lieutenant levels §1: what the next seal asks (from data/regles.json). */
export interface SealNeed {
  days: number;
  chances: number;
  correct: number;
}

/** The window toward a lieutenant's next seal: days of guard (days with a chance) after the last
 *  seal, the chances met, the share right in the handed-in copies (null without a chance). */
export interface SealWindow {
  level: number;
  days: number;
  chances: number;
  correct: number | null;
  complete: boolean;
  need: SealNeed;
}

export interface LieutenantState {
  key: string;
  name: string;
  categories: string[];
  available: boolean;
  /** Spec 2026-09-29 lieutenant levels §1: the seal won, 0 before the first (1 bois … 5 orichalque). */
  level: number;
  level_reached_at: string | null;
  /** The window toward the next seal; null after the fifth. */
  next: SealWindow | null;
  all_time: { traps: number; caught: number; missed: number; rate: number | null };
  last_day: string | null;
  bestiary_unlocked: boolean;
  active_quest_id: number | null;
}

export interface QuestOut {
  id: number;
  kind: QuestKind;
  target: string;
  week: string | null;
  status: QuestStatus;
  // `tier` and `text_id` are present only on boss quests (spec 2026-09-29 §2: the rule reads no
  // threshold from a goal).
  goal: { sessions?: number; tier?: number; text_id?: number };
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
  unlocked_tints: Tint[];
  /** Spec 2026-09-29 drachmes §4: the pieces worn, as manifest keys ("hydre-cou"), in draw order. */
  worn: string[];
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
  /** Spec 2026-09-29 dragon growth §2: the dragon's gauge, the HUD's laurel: the total XP, the stored
   *  stage's threshold and the next stage's (null at the last stage). */
  xp: { total: number; floor: number; next: number | null };
  dragon: DragonOut;
  lieutenants: LieutenantState[];
  quests: QuestOut[];
  oracle: { week: string; status: 'sealed' | 'chosen'; reward_id: string | null };
  prophecies: OracleOut['prophecies'];
  weekly: { week: string; target: number; done: number; reached: boolean };
  /** Spec 2026-09-29 lieutenant levels §4: the ladder's length, and what opens the next fight (null
   *  once a fight is open or every fight is won). */
  boss: { tier_available: number | null; tiers_won: number[]; active_quest_id: number | null; fights: number; next: { tier: number; level: number; missing: number } | null };
  rewards_count: number;
  small_tricks: { traps: number; caught: number };
  /** Spec 2026-09-29 drachmes §1: the purse. */
  drachmes: number;
  /** Spec 2026-09-29 drachmes §3: the highest house owned. */
  house: House;
  /** Spec 2026-09-29 explanations §1 (R5): the stall's items the purse can buy now. */
  affordable: number;
}

export interface Progression {
  xp: {
    session: number;
    /** Spec 2026-09-29 §4: the session XP broken down for the victory's chips (they add up to `session`).
     *  Absent from a victory saved before the change. */
    parts?: { text: number; pace: number; aids: number; prophecy: number };
    /** A seal's bonus names its lieutenant and seal (spec 2026-09-29 lieutenant levels §1). */
    bonuses: { reason: string; amount: number; lieutenant?: string; level?: number }[];
    total_before: number;
    total_after: number;
    /** Spec 2026-09-29 dragon growth §2: the dragon's stages around this victory and the new stage's
     *  gauge (floor, next; next null at the last stage). Absent from a victory saved before the change. */
    stage_before?: DragonStage;
    stage_after?: DragonStage;
    floor?: number;
    next?: number | null;
  };
  quests: {
    id: number;
    kind: QuestKind;
    target: string;
    counted: boolean;
    /** Why the text does not count (too few chances for the target, or too many mistakes left in
     *  the copy); null when it counts. Absent from a victory saved before the reasons. */
    reason?: 'chances' | 'copy' | null;
    progress: number;
    goal: number | null;
    completed: boolean;
    reward_id: string | null;
  }[];
  /** Spec 2026-09-29 lieutenant levels §1: the seals this session won (absent from a victory saved
   *  before the change). */
  levels?: { lieutenant: string; level: number; reward_id: string }[];
  /** A victory saved before the seals: its old `neutralised` keys, now their wooden seal. */
  neutralised?: string[];
  /** Spec 2026-09-29 drachmes §1: what this session paid, part by part (absent from a victory saved
   *  before the change). */
  drachmes?: { earned: number; parts: { reason: string; amount: number; lieutenant?: string; level?: number }[]; balance: number };
  rewards: { id: string; kind: RewardKind; name: string }[];
  dragon: { stage_before: DragonStage; stage_after: DragonStage; needs_name: boolean };
  weekly: { target: number; done: number; reached_now: boolean };
  // Spec 2026-09-29 §2: the fight is won on the copy (no more « too easy » draw).
  boss: { tier: number; won: boolean } | null;
  encounter: string | null;
}
