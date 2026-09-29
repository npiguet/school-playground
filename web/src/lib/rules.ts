// The camp's rules (spec 2026-09-29 §7): the server reads data/regles.json at start-up and serves the
// values with GET /api/world (`catalog.rules`). The defaults below mirror server/app/rules.py and
// apply until the catalog has come. Pure.
import { todayIso } from './dates';
import type { PlayMode } from './types';

export interface GameRules {
  quest_min_chances: number;
  quest_min_correct: number;
  fight_max_per_100: number;
  copy_belle_max_per_100: number;
  copy_correcte_max_per_100: number;
  aid_bonus: number;
  pace_bonus: Record<'1' | '2' | '3', number>;
  prophecy_bonus: number;
  chouette_hints: number;
}

export const DEFAULT_RULES: GameRules = {
  quest_min_chances: 3,
  quest_min_correct: 0.85,
  fight_max_per_100: 4,
  copy_belle_max_per_100: 2,
  copy_correcte_max_per_100: 8,
  aid_bonus: 0.2,
  pace_bonus: { '1': 0, '2': 0.25, '3': 0.5 },
  prophecy_bonus: 0.5,
  chouette_hints: 3,
};

export function rulesOf(catalog: { rules?: GameRules } | null | undefined): GameRules {
  return catalog?.rules ?? DEFAULT_RULES;
}

/** Mistakes left per 100 words (spec §1), every category counted; 0 for a text without words. */
export function per100(mistakes: number, words: number): number {
  return words > 0 ? (100 * mistakes) / words : 0;
}

export type CopyVerdict = 'belle' | 'correcte' | 'reprendre';

/** Spec §2: ≤ 2 « belle copie », ≤ 8 « copie correcte », above « copie à reprendre ». */
export function copyVerdict(per: number, rules: Pick<GameRules, 'copy_belle_max_per_100' | 'copy_correcte_max_per_100'>): CopyVerdict {
  if (per <= rules.copy_belle_max_per_100) return 'belle';
  if (per <= rules.copy_correcte_max_per_100) return 'correcte';
  return 'reprendre';
}

/** The pace's bonus (spec §4): a stale pace 4 counts as 3; the Grimoire has none. */
export function paceBonus(pace: number, mode: PlayMode, rules: GameRules): number {
  if (mode === 'grimoire') return 0;
  const key = String(Math.min(3, Math.max(1, Math.round(pace)))) as '1' | '2' | '3';
  return rules.pace_bonus[key] ?? 0;
}

/** The prophecy's bonus applies strictly before the text's due date, as on the server (`due_date > day`). */
export function prophecyBonusApplies(dueDate: string | null, today: Date = new Date()): boolean {
  return !!dueDate && dueDate > todayIso(today);
}
