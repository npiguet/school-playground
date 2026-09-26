// The dragon companion: tints (CSS filters on the same cut image, decision 11 - never a new
// generation), stage labels/camp speech lines and name validation. Pure functions/data only, no
// DOM/store access, so `Dragon.svelte`, the nest and its care panel, the trophy shelf and
// `ProgressionReveal.svelte` all share the same wording and this file stays trivially testable.
import { plural } from '../text/french';
import type { DragonOut, DragonStage, Tint } from './types';

export type Mood = 'idle' | 'happy' | 'sleepy';

// Violet is reserved for Éris (decision 11) - never offered as a dragon tint. `bronze` is the
// unlockable-by-default original colour (`none`); the other five are earned via Oracle quests
// (`ORACLE_REWARDS` in `server/app/world/catalog.py`), in this exact order.
export const TINT_FILTERS: Record<Tint, string> = {
  bronze: 'none',
  ecume: 'hue-rotate(190deg) saturate(.9)',
  olivier: 'hue-rotate(70deg) saturate(.8)',
  braise: 'hue-rotate(-25deg) saturate(1.3)',
  jade: 'hue-rotate(120deg) saturate(.9)',
  argent: 'saturate(0) brightness(1.15)',
};

/** The filter of a tint's egg picture (the care panel's swatches, the trophy shelf's tint cubbies):
 *  its tint once won, greyed while locked. Applied to the egg's `<img>` only, never to the swatch
 *  around it: the gold ring and the painted lock keep their own colours (fix round 1: a filtered
 *  ring turned violet, Éris's colour, and a tinted lock was barely readable). */
export const LOCKED_EGG_FILTER = 'grayscale(1) opacity(0.55)';
export function eggFilter(tint: Tint, unlocked: boolean): string {
  return unlocked ? TINT_FILTERS[tint] : LOCKED_EGG_FILTER;
}

/** Flat colour swatches for the tint rewards (UI3 Ruling A12): a tint is a colour, not an object.
 *  Braise is an ember orange, never a red. */
export const TINT_SWATCH: Record<Tint, string> = {
  bronze: '#b8863b',
  ecume: '#3f8fb0',
  olivier: '#7a8a4b',
  braise: '#d06a2c',
  jade: '#3a9a78',
  argent: '#c4c8d0',
};

export const TINT_NAMES: Record<Tint, string> = {
  bronze: 'Bronze',
  ecume: 'Écume',
  olivier: 'Olivier',
  braise: 'Braise',
  jade: 'Jade',
  argent: 'Argent',
};

const STAGE_LABELS: Record<DragonStage, string> = {
  egg: 'Œuf',
  hatchling: 'Dragonnet',
  young: 'Jeune dragon',
  adult: 'Dragon adulte',
};

export function stageLabel(stage: DragonStage): string {
  return STAGE_LABELS[stage];
}

/** The dragon's identity: its name, else what it is (the nest's caption, the cut-out's alt). */
export function dragonCaption(d: Pick<DragonOut, 'name' | 'stage'>): string {
  return d.name ?? (d.stage === 'egg' ? 'Un œuf de dragon' : stageLabel(d.stage));
}

/** The camp speech-bubble line for a dragon stage (moved out of `Camp.svelte`, spec Task 8 step
 *  1): `name` is `null` before it hatches (egg has no name yet); `remaining` is the number of
 *  available lieutenants left to neutralise before the next stage (only meaningful for `young`). */
export function stageLine(stage: DragonStage, name: string | null, remaining: number | null): string {
  const label = name ?? 'Ton dragon';
  if (stage === 'egg') return "L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.";
  if (stage === 'hatchling') return `${label} te regarde avec de grands yeux ambre.`;
  if (stage === 'young') {
    return `${label} bat des ailes : encore ${plural(Math.max(0, remaining ?? 0), 'technique', 'techniques')} à neutraliser.`;
  }
  return `${label} veille sur le camp. Éris n'a qu'à bien se tenir.`;
}

// Task 10b round 1 #3: `stageLine()` above (up to 64 chars) is what the dragon is up to, but a
// `title` tooltip carrying it never shows on iPad (the target device has no mouse hover), and it's
// too long for a hotspot label pill (`white-space: nowrap`). This is the same ambient status,
// short enough to sit in the `camp-dragon` hotspot's caption instead (Camp.svelte's HUD dragon
// button is icon-only, unchanged) - same thematic words as stageLine, just not a full sentence.
const STAGE_ACTIVITY: Record<DragonStage, string> = {
  egg: 'Frémit',
  hatchling: 'Curieux',
  young: "S'entraîne",
  adult: 'Monte la garde',
};

export function stageActivity(stage: DragonStage): string {
  return STAGE_ACTIVITY[stage];
}

/** 1-20 characters after trim, no line breaks (server mirrors the length bounds in
 *  `DragonPatch`; this also rejects the newline the server schema doesn't check). */
export function validName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 20) return false;
  return !/[\r\n]/.test(trimmed);
}
