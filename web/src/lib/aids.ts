// The five review aids (spec 2026-09-29 §3): each taken along or left at the camp before the battle,
// remembered per hero (`settings.aids`, written by the server with each session, plan Ruling R1), and
// worth +20 % of glory each when left. The suggestion reads the last defences; it only ever suggests.
import { copyVerdict, paceBonus, type GameRules } from './rules';
import { plural } from './text/french';
import type { PlayMode } from './types';
import { TOOL_ICONS } from './world/art';

export const AID_KEYS = ['argus', 'ariane', 'persee', 'athena', 'palamede'] as const;
export type AidKey = (typeof AID_KEYS)[number];
export const ALL_AIDS: readonly AidKey[] = AID_KEYS;
/** The order the camp suggests leaving them in. */
export const SUGGEST_ORDER: readonly AidKey[] = ['athena', 'argus', 'palamede', 'persee', 'ariane'];

/** `name` on the toggle, `the` inside a sentence (« Tu pourrais laisser la chouette au camp. »). */
export const AID_LABELS: Record<AidKey, { name: string; the: string; desc: string }> = {
  argus: { name: "Les yeux d'Argus", the: "les yeux d'Argus", desc: "Une catégorie de mots à la fois, le reste dans l'ombre." },
  ariane: { name: "Le fil d'Ariane", the: "le fil d'Ariane", desc: 'Relie un verbe à son sujet.' },
  persee: { name: 'Le bouclier de Persée', the: 'le bouclier de Persée', desc: 'Une phrase à la fois, de la dernière à la première.' },
  athena: { name: "La chouette d'Athéna", the: 'la chouette', desc: 'Des indices pour repérer un piège.' },
  palamede: { name: 'Les jetons de Palamède', the: 'les jetons de Palamède', desc: 'Combien de pièges se cachent dans le texte.' },
};

export function isAidKey(k: unknown): k is AidKey {
  return typeof k === 'string' && (AID_KEYS as readonly string[]).includes(k);
}

/** A remembered or saved choice: the valid aids, once each, in the camp's order. Anything that is not a
 *  list (a new hero, a save from before the aids) is all five, as for a new hero (spec §3). */
export function normalizeAids(raw: unknown): AidKey[] {
  if (!Array.isArray(raw)) return [...AID_KEYS];
  return AID_KEYS.filter((k) => raw.includes(k));
}

/** The toggle's one line; the owl's says how many hints the rules give her. */
export function aidDesc(key: AidKey, rules: GameRules): string {
  return key === 'athena' ? `${plural(rules.chouette_hints, 'indice', 'indices')} pour repérer un piège.` : AID_LABELS[key].desc;
}

/** The aid's painted emblem. Palamède's comes with the art track (plan Task 9): null until then. */
export function aidIcon(key: AidKey): string | null {
  return (TOOL_ICONS as Record<string, string>)[key] ?? null;
}

/** The glory this battle is worth on top of the text (spec §4): the pace, +20 % per aid left, the prophecy. */
export function bonusParts(
  o: { pace: number; mode: PlayMode; aids: readonly AidKey[]; prophecy: boolean },
  rules: GameRules,
): { pace: number; aids: number; prophecy: number; total: number } {
  const pace = paceBonus(o.pace, o.mode, rules);
  const aids = rules.aid_bonus * (AID_KEYS.length - o.aids.length);
  const prophecy = o.prophecy ? rules.prophecy_bonus : 0;
  return { pace, aids, prophecy, total: pace + aids + prophecy };
}

/** « a », « a et b », « a, b et c ». */
export function listFr(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

/** One of the last defences (GET /api/profiles/{id}/stats `recent_sessions`, newest first). */
export interface RecentDefence {
  mode: string;
  aids: readonly string[] | null;
  per_100: number | null;
}

export interface Suggestion {
  kind: 'leave' | 'take';
  aid: AidKey;
}

const sameAids = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((k) => b.includes(k));

/** Spec §3: after 3 consecutive dictations with a « belle copie » and the same aids, suggest leaving the
 *  next aid (athena → argus → palamede → persee → ariane); after 2 consecutive « copie à reprendre »,
 *  suggest taking back the last aid left. Only a suggestion: the muster never changes the choice.
 *  Grimoire rounds are skipped; a defence from before the aids breaks a "same aids" run (Ruling R3). */
export function suggestion(recent: readonly RecentDefence[], current: readonly AidKey[], rules: GameRules): Suggestion | null {
  const dictations = recent.filter((s) => s.mode === 'dictation');
  const verdict = (s: RecentDefence) => (s.per_100 === null ? null : copyVerdict(s.per_100, rules));
  const run = dictations.slice(0, 3);
  const first = run[0]?.aids ?? null;
  if (run.length === 3 && first !== null && run.every((s) => verdict(s) === 'belle' && s.aids !== null && sameAids(s.aids, first))) {
    const aid = SUGGEST_ORDER.find((k) => first.includes(k) && current.includes(k));
    if (aid) return { kind: 'leave', aid };
  }
  const last2 = dictations.slice(0, 2);
  if (last2.length === 2 && last2.every((s) => verdict(s) === 'reprendre')) {
    const aid = [...SUGGEST_ORDER].reverse().find((k) => !current.includes(k));
    if (aid) return { kind: 'take', aid };
  }
  return null;
}
