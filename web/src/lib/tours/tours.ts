// The first-visit tours (spec §8, Ruling E13): each place with hotspots walks its new visitor round
// them, its character speaking one step at a time. Steps come from the place's content file,
// filtered by the dragon's stage. Spec 2026-09-29 explanations §2: steps added later carry `since`; a
// hero who saw an older version hears the new steps only, once (plan R8, R9).
import { TOURS } from '../dialogue/content';
import { frameFor } from '../dialogue/speakers';
import { matches } from '../dialogue/select';
import { frenchSpacing } from '../text/french';
import type { DialogueLine, SceneId } from '../scene/types';
import type { DragonOut } from '../world/types';
import type { ProfileSettings } from '../types';
import type { TourId } from '../dialogue/types';

export const TOUR_OF: Partial<Record<SceneId, TourId>> = { camp: 'camp', library: 'library', delphi: 'delphi', war: 'war', nest: 'nest', cabin: 'cabin' };

/** The muster's parts its tour lights (R11): the pace, the aids, the total. */
export const MUSTER_TOUR_PARTS = ['pace', 'aids', 'bonus'] as const;

/** Ruling E10: e2e switches the tours off unless a spec asks for them. */
export function toursEnabled(): boolean {
  return (globalThis as { __discordeTours?: string }).__discordeTours !== 'off';
}

// « war:2 » in `settings.tours` (a constant, so no template reads to the French-spacing guard as a
// colon in prose).
const VERSION_MARK = ':';

/** A tour's content version (R8): the newest `since` of its steps, 1 without any. */
export function tourVersion(id: TourId): number {
  return TOURS[id].reduce((v, s) => Math.max(v, s.since ?? 1), 1);
}

/** The version of `id` this hero has seen (R8): 0 never, 1 for a bare « war » (every save before the
 *  versions; `onboarded`, from a hero onboarded before UI5 who saw the Muses' cards, counts as the
 *  camp's), N for « war:N ». Anything else counts for nothing. */
export function seenVersion(settings: ProfileSettings, id: TourId): number {
  let seen = id === 'camp' && settings.onboarded === true ? 1 : 0;
  for (const entry of settings.tours ?? []) {
    if (entry === id) seen = Math.max(seen, 1);
    else if (entry.startsWith(id + VERSION_MARK)) {
      const v = entry.slice(id.length + VERSION_MARK.length);
      if (/^[1-9]\d*$/.test(v)) seen = Math.max(seen, Number(v));
    }
  }
  return seen;
}

/** What a save writes for `id` (R8): the bare id, read by a page opened before the versions, and
 *  « id:N » from version 2. */
export function seenEntries(id: TourId): string[] {
  const v = tourVersion(id);
  return v >= 2 ? [id, id + VERSION_MARK + v] : [id];
}

export function tourSeen(settings: ProfileSettings, id: TourId): boolean {
  return seenVersion(settings, id) >= tourVersion(id);
}

/** The steps of `id` for this dragon; `after` a version already seen, the newer steps only (R9). */
export function tourSteps(id: TourId, dragon: DragonOut | null, after = 0): { lines: DialogueLine[]; targets: (string | null)[] } {
  const steps = TOURS[id].filter((s) => (s.since ?? 1) > after && matches(s.when, dragon ? { stage: dragon.stage } : {}));
  return {
    lines: steps.map((s, i) => ({ ...frameFor(s.speaker, dragon), text: frenchSpacing(s.text), key: `tour.${id}.${i}` })),
    targets: steps.map((s) => s.target),
  };
}
