// Lieutenant levels, shown as seals (spec 2026-09-29 lieutenant levels): five per lieutenant, each a
// material. On screen a level is always its material (« le sceau de bronze de l'Hydre »), never a
// number or the school's word. Pure: the camp's `lieutenants[].next` carries the window, the server
// decides; these words only say it.
import { plural, rateText } from '../text/french';
import { agree, genderFor, lieutenantName } from './eris';
import { lowerLeadingArticle } from './quests';
import { LIEUTENANT_ORDER, type LieutenantKey, type LieutenantState, type SealWindow } from './types';

export const MATERIALS = ['bois', 'bronze', 'argent', 'or', 'orichalque'] as const;
export const MAX_SEAL = MATERIALS.length;

const OF: Record<LieutenantKey, string> = {
  hydre: "de l'Hydre",
  echo: "d'Écho",
  chimere: 'de la Chimère',
  protee: 'de Protée',
  sirenes: 'des Sirènes',
  lethe: 'de Léthé',
};

// A share of whole counts may land a hair under a decimal threshold (22/25 against 0.88), as on the server.
const EPSILON = 1e-9;

function ofMaterial(level: number): string {
  const m = MATERIALS[Math.min(MAX_SEAL, Math.max(1, Math.round(level))) - 1];
  return /^[aeiou]/.test(m) ? `d'${m}` : `de ${m}`;
}

/** « sceau de bois », « sceau d'argent ». */
export function sealName(level: number): string {
  return `sceau ${ofMaterial(level)}`;
}

/** « sceaux de bois ». */
export function sealsName(level: number): string {
  return `sceaux ${ofMaterial(level)}`;
}

/** « Sceau de bronze ». */
export function sealTitle(level: number): string {
  return `Sceau ${ofMaterial(level)}`;
}

/** « Sceau de bronze de l'Hydre » (the catalogue's `source` of a trophy). */
export function sealTitleOf(key: LieutenantKey, level: number): string {
  return `${sealTitle(level)} ${OF[key]}`;
}

const pct = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100);
const shareOk = (n: SealWindow) => n.correct !== null && n.correct >= n.need.correct - EPSILON;

export interface SealGauge {
  label: string;
  /** Percent of the gauge filled. */
  fill: number;
  ok: boolean;
}

/** The portrait's three gauges toward the next seal (R12). */
export function sealGauges(n: SealWindow): { days: SealGauge; chances: SealGauge; correct: SealGauge & { mark: number } } {
  return {
    days: { label: `Jours de garde\u202f: ${Math.min(n.days, n.need.days)} sur ${n.need.days}`, fill: pct(n.days / n.need.days), ok: n.days >= n.need.days },
    chances: {
      label: `Pièges croisés\u202f: ${Math.min(n.chances, n.need.chances)} sur ${n.need.chances}`,
      fill: pct(n.chances / n.need.chances),
      ok: n.chances >= n.need.chances,
    },
    correct: {
      label: `Pièges déjoués\u202f: ${rateText(n.correct)}, il en faut ${rateText(n.need.correct)}`,
      fill: pct(n.correct ?? 0),
      ok: shareOk(n),
      mark: pct(n.need.correct),
    },
  };
}

/** The window passes: the next session that keeps it seals the lieutenant. */
export function sealReady(n: SealWindow): boolean {
  return n.complete && shareOk(n);
}

/** Éris's file keeps one gauge per sheet: the three parts together. */
export function sealFill(n: SealWindow): number {
  return Math.round((pct(n.days / n.need.days) + pct(n.chances / n.need.chances) + pct((n.correct ?? 0) / n.need.correct)) / 3);
}

/** What stands before the next seal, in words (spec §5, R12). At the fifth seal it sits under the
 *  plate or stamp that already names the seal, so it says only that nothing is left to win. */
export function sealProgressLine(key: LieutenantKey, l: Pick<LieutenantState, 'level' | 'next'>): string {
  const n = l.next;
  if (!n || l.level >= MAX_SEAL) return 'Il ne reste rien à conquérir ici.';
  if (l.level === 0 && n.days === 0) return `Pas encore ${agree('croisé', key)}.`;
  const seal = sealName(n.level);
  const days = Math.max(0, n.need.days - n.days);
  const traps = Math.max(0, n.need.chances - n.chances);
  const parts = [days > 0 ? `${plural(days, 'jour', 'jours')} de garde` : null, traps > 0 ? plural(traps, 'piège', 'pièges') : null].filter(
    (p): p is string => p !== null,
  );
  if (parts.length > 0) return `Encore ${parts.join(' et ')} avant le ${seal}.`;
  if (sealReady(n)) return `Tout y est\u202f: défends encore un texte, et le ${seal} est à toi.`;
  return `Il ne te reste qu'à déjouer ${rateText(n.need.correct)} des pièges avant le ${seal}.`;
}

const COUNT_WORDS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];

/** What opens the next fight (spec §4, R9): the seals still missing, counted across the lieutenants,
 *  never naming one. The battle path's caption and the dragon's line when the locked path is tapped. */
export function fightLine(next: { level: number; missing: number }): string {
  const n = next.missing;
  const count = n < COUNT_WORDS.length ? COUNT_WORDS[n] : String(n);
  return `Encore ${count} ${n < 2 ? sealName(next.level) : sealsName(next.level)} et Éris t'attend.`;
}

const ON: Record<LieutenantKey, string> = {
  hydre: "sur l'Hydre",
  echo: 'sur Écho',
  chimere: 'sur la Chimère',
  protee: 'sur Protée',
  sirenes: 'sur les Sirènes',
  lethe: 'sur Léthé',
};

/** The victory's cry for a seal (spec §5): « Sceau de bronze ! ». */
export function sealCry(level: number): string {
  return `${sealTitle(level)}\u202f!`;
}

/** The seal's card on the victory (R16). */
export function levelUpLine(key: LieutenantKey, level: number): string {
  const their = genderFor(key) === 'fp' ? 'Leur' : 'Son';
  return `Tu poses le ${sealName(level)} ${ON[key]}. ${their} trophée t'attend dans ta cabane.`;
}

/** The seal's XP chip: « Sceau de bronze : l'Hydre » (the victory adds « +200 »). */
export function levelChipLabel(level: number, name: string): string {
  return `${sealTitle(level)}\u202f: ${lowerLeadingArticle(name)}`;
}

const isKey = (k: string): k is LieutenantKey => (LIEUTENANT_ORDER as readonly string[]).includes(k);

export interface LevelUp {
  lieutenant: LieutenantKey;
  level: number;
  reward_id: string;
}

/** The seals a victory reveals; a victory saved before the change reveals its neutralisations as the
 *  wooden seals they became (migration 006). */
export function levelUps(p: { levels?: { lieutenant: string; level: number; reward_id: string }[]; neutralised?: string[] }): LevelUp[] {
  // The id is joined, not templated: the French-spacing guard reads a template literal as copy.
  const ups = p.levels ?? (p.neutralised ?? []).map((k) => ({ lieutenant: k, level: 1, reward_id: ['trophy', k, 1].join(':') }));
  return ups.filter((u): u is LevelUp => isKey(u.lieutenant));
}

const CHIP_LABELS: Record<string, string> = {
  // Spec 2026-09-29 §4 (sub-project 1): the session's parts, then the other bonuses.
  text: 'Texte',
  session: 'Texte',
  pace: 'Rythme',
  aids: 'Sans aides',
  prophecy: 'Prophétie',
  board: 'Quête',
  oracle: 'Oracle',
  boss: 'Éris vaincue',
  weekly: 'Objectif de la semaine',
  // A seal's bonus without its lieutenant (never sent by the server): never the raw key.
  level: 'Sceau',
  // A victory saved before the seals: its neutralisation's bonus was the first seal's.
  mastery: 'Premier sceau',
};

/** Every XP chip's label (the victory adds « +N »): a seal names itself and its lieutenant. */
export function bonusChipLabel(b: { reason: string; amount?: number; lieutenant?: string; level?: number }, names: Record<string, string>): string {
  if (b.reason === 'level' && b.lieutenant && isKey(b.lieutenant) && b.level) {
    return levelChipLabel(b.level, names[b.lieutenant] ?? lieutenantName(b.lieutenant));
  }
  return CHIP_LABELS[b.reason] ?? b.reason;
}
