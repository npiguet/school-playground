// The dragon companion: tints (CSS filters on the same cut image, decision 11 - never a new
// generation), stage labels/camp speech lines and name validation. Pure functions/data only, no
// DOM/store access, so `Dragon.svelte`, the nest and its care panel, the trophy shelf and
// the victory's spoils (`battle/VictorySpoils.svelte`) all share the same wording and this file stays trivially testable.
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

/** What the dragon says of itself at its stage, in its own voice (UI3b playability #15: its plate
 *  names it, so it speaks in the first person; the egg speaks from inside its shell). The camp's
 *  greeting and the nest's. `name` is null until it is named (a hatchling then asks for one);
 *  `remaining` is the number of available lieutenants left to neutralise (only said when `young`). */
export function stageLine(stage: DragonStage, name: string | null, remaining: number | null): string {
  if (stage === 'egg') return "Toc, toc… Chaque piège d'Éris déjoué me fait frémir dans ma coquille.";
  if (stage === 'hatchling') return name ? "Te revoilà ! Chaque ruse d'Éris neutralisée me fait grandir." : 'Te revoilà ! Tu me donnes un nom ?';
  if (stage === 'young') {
    const n = Math.max(0, remaining ?? 0);
    if (n === 0) return "Je bats des ailes ! Toutes les ruses d'Éris sont neutralisées, pour l'instant.";
    return `Je bats des ailes ! Encore ${plural(n, "ruse d'Éris", "ruses d'Éris")} à neutraliser.`;
  }
  return "Je veille sur le camp. Éris n'a qu'à bien se tenir.";
}

// What the dragon is up to, as a sentence under its growth in the nest (UI3b playability #5: a lone
// « Curieux » read like a form value).
const STAGE_ACTIVITY: Record<DragonStage, string> = {
  egg: 'Il frémit dans sa coquille.',
  hatchling: 'Il est curieux.',
  young: "Il s'entraîne à voler.",
  adult: 'Il monte la garde.',
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
