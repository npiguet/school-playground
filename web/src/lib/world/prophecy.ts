// The prophecies (dictées préparées with a due date) as the Pythia announces them: scene-neutral,
// shared by the camp hub, Delphi's altar and the Pythia's overlay (final review M3: they used to
// live in the camp scene module).
import type { CampResponse } from './types';
import { weekdayOf } from '../text/french';

/** When a prophecy falls due, in words (playability #16: a real plural, no « jour(s) »). */
export function prophecyWhen(daysLeft: number): string {
  if (daysLeft <= 0) return "aujourd'hui";
  if (daysLeft === 1) return 'demain';
  // No-break spaces: « dans 2 jours » stays one unit, never split at the end of a line (the altar
  // card, walk a13; re-review N16).
  return `dans ${daysLeft} jours`;
}

/** The bonus a prophecy still offers, as a tag on its strip (re-review N6, ruling W-f): « Défendue
 *  avant lundi : +50 % d'XP ». The server pays it for a dictation finished strictly before the due
 *  date (sessions.py, xp.py x1.5), so on the day itself there is no tag - and nothing to regret.
 *  The weekday alone names the day only within the week; further off, « son jour » (the strip
 *  already shows the date). */
export function prophecyBonus(p: CampResponse['prophecies'][number]): string | null {
  if (p.days_left <= 0) return null;
  const day = p.days_left < 7 ? weekdayOf(p.due_date) : null;
  return `Défendue avant ${day ?? 'son jour'} : +50 % d'XP`;
}

/** The prophecy a place shows: the one falling due first. */
export function nearestProphecy(camp: CampResponse): CampResponse['prophecies'][number] | null {
  const list = camp.prophecies;
  return list.length ? [...list].sort((a, b) => a.due_date.localeCompare(b.due_date))[0] : null;
}
