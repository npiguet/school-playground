// The prophecies (dictées préparées with a due date) as the Pythia announces them: scene-neutral,
// shared by the camp hub, Delphi's altar and the Pythia's overlay (final review M3: they used to
// live in the camp scene module).
import type { CampResponse } from './types';
import { rateText, weekdayOf } from '../text/french';

/** When a prophecy falls due, in words (playability #16: a real plural, no « jour(s) »). */
export function prophecyWhen(daysLeft: number): string {
  if (daysLeft <= 0) return "aujourd'hui";
  if (daysLeft === 1) return 'demain';
  // No-break spaces: « dans 2 jours » stays one unit, never split at the end of a line (the altar
  // card, walk a13; re-review N16).
  return `dans\u00a0${daysLeft}\u00a0jours`;
}

/** The bonus a prophecy still offers, as a tag on its strip (re-review N6, ruling W-f): « Défendue
 *  avant lundi : +50 % d'XP ». The server pays it for a dictation finished strictly before the due
 *  date (sessions.py, xp.py), so on the day itself there is no tag - and nothing to regret. `bonus`
 *  is the served `prophecy_bonus` (data/regles.json), null until the catalogue has come: no client
 *  copy of the figure is ever printed (SP4 final review M8), and a bonus set to 0 shows no tag.
 *  The weekday alone names the day only within the week; further off, « son jour » (the strip
 *  already shows the date). */
export function prophecyBonus(p: CampResponse['prophecies'][number], bonus: number | null): string | null {
  if (p.days_left <= 0 || bonus === null || bonus <= 0) return null;
  const day = p.days_left < 7 ? weekdayOf(p.due_date) : null;
  return `Défendue avant ${day ?? 'son jour'}\u202f: +${rateText(bonus)} d'XP`;
}

/** The prophecy a place shows: the one falling due first. */
export function nearestProphecy(camp: CampResponse): CampResponse['prophecies'][number] | null {
  const list = camp.prophecies;
  return list.length ? [...list].sort((a, b) => a.due_date.localeCompare(b.due_date))[0] : null;
}

/** A prophecy is the next step once it falls due within this many days (Ruling B9). */
export const PROPHECY_SOON_DAYS = 7;

/** The nearest prophecy when it falls due within the week, else null: the one rule behind the hub's
 *  glow (nextStep), the dragon's what-next line (whatNext) and the oracle's caption. */
export function prophecySoon(camp: CampResponse): CampResponse['prophecies'][number] | null {
  const p = nearestProphecy(camp);
  return p && p.days_left <= PROPHECY_SOON_DAYS ? p : null;
}
