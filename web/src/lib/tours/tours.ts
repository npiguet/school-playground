// The first-visit tours (spec §8, Ruling E13): each place with hotspots walks its new visitor round
// them, its character speaking one step at a time. Steps come from the place's content file,
// filtered by the dragon's stage.
import { TOURS } from '../dialogue/content';
import { frameFor } from '../dialogue/speakers';
import { matches } from '../dialogue/select';
import { frenchSpacing } from '../text/french';
import type { DialogueLine, SceneId } from '../scene/types';
import type { DragonOut } from '../world/types';
import type { ProfileSettings } from '../types';
import type { TourId } from '../dialogue/types';

export const TOUR_OF: Partial<Record<SceneId, TourId>> = { camp: 'camp', library: 'library', delphi: 'delphi', war: 'war', nest: 'nest', cabin: 'cabin' };

/** Ruling E10: e2e switches the tours off unless a spec asks for them. */
export function toursEnabled(): boolean {
  return (globalThis as { __discordeTours?: string }).__discordeTours !== 'off';
}

/** A hero onboarded before UI5 saw the Muses' cards, which the camp tour replaces. */
export function tourSeen(settings: ProfileSettings, id: TourId): boolean {
  return (settings.tours ?? []).includes(id) || (id === 'camp' && settings.onboarded === true);
}

export function tourSteps(id: TourId, dragon: DragonOut | null): { lines: DialogueLine[]; targets: (string | null)[] } {
  const steps = TOURS[id].filter((s) => matches(s.when, dragon ? { stage: dragon.stage } : {}));
  return {
    lines: steps.map((s, i) => ({ ...frameFor(s.speaker, dragon), text: frenchSpacing(s.text), key: `tour.${id}.${i}` })),
    targets: steps.map((s) => s.target),
  };
}
