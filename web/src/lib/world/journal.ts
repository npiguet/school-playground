// The journal's words (UI3 Ruling B6): what the Muses do at each help stage, said the camp's way
// (the old Stats said « niveau N sur 4 » and « Comme en classe », school register).
import { longDate, plural } from '../text/french';

export const HELP_STAGES = [1, 2, 3, 4] as const;

const LINES: Record<number, string> = {
  1: "Les yeux d'Argus éclairent chaque piège.",
  2: 'Les Muses nomment les passes, sans les éclairer.',
  3: 'Les Muses annoncent seulement le nombre de pièges.',
  4: 'Les Muses te laissent relire sans aide.',
};

export function helpStageLine(stage: number): string {
  return LINES[stage] ?? '';
}

/** A catch rate in words: « 75 % » (no-break space), or « — » when there was nothing to catch. */
export function rateText(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(100 * rate)} %`;
}

/** The day a defence was finished, on the hero's own clock (the server stores UTC: a text finished
 *  at 00:30 at home belongs to that day, not to the one before), as YYYY-MM-DD. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** The line under a defence in the journal: its local date, its points and, when there was
 *  something to catch, how much was foiled (fix round 1: never « — déjoués »). */
export function defenceMeta(s: { finished_at: string; score: number; catch_rate: number | null }, today: Date = new Date()): string {
  const parts = [longDate(localDay(s.finished_at), today), plural(s.score, 'point', 'points')];
  if (s.catch_rate !== null) parts.push(`${rateText(s.catch_rate)} déjoués`);
  return parts.join(' · ');
}
