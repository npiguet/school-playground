// Lieutenant levels, shown as seals (spec 2026-09-29 lieutenant levels): five per lieutenant, each a
// material. On screen a level is always its material (« le sceau de bronze de l'Hydre »), never a
// number or the school's word. Pure: the camp's `lieutenants[].next` carries the window, the server
// decides; these words only say it.
import { plural, rateText } from '../text/french';
import { agree } from './eris';
import type { LieutenantKey, LieutenantState, SealWindow } from './types';

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
