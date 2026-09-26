// The prophecies (dictées préparées with a due date) as the Pythia announces them: scene-neutral,
// shared by the camp hub, Delphi's altar and the Pythia's overlay (final review M3: they used to
// live in the camp scene module).
import type { CampResponse } from './types';

/** When a prophecy falls due, in words (playability #16: a real plural, no « jour(s) »). */
export function prophecyWhen(daysLeft: number): string {
  if (daysLeft <= 0) return "aujourd'hui";
  if (daysLeft === 1) return 'demain';
  // A no-break space: « 2 » never ends a line with « jours » on the next (the altar card, walk a13).
  return `dans ${daysLeft} jours`;
}

/** The prophecy a place shows: the one falling due first. */
export function nearestProphecy(camp: CampResponse): CampResponse['prophecies'][number] | null {
  const list = camp.prophecies;
  return list.length ? [...list].sort((a, b) => a.due_date.localeCompare(b.due_date))[0] : null;
}
