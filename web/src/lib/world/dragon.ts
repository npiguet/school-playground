// The dragon companion: tints (CSS filters on the same cut image, decision 11 - never a new
// generation), stage labels/camp speech lines and name validation. Pure functions/data only, no
// DOM/store access, so `Dragon.svelte`, `DragonScreen.svelte`, `Cabin.svelte` and
// `ProgressionReveal.svelte` all share the same wording and this file stays trivially testable.
import type { DragonStage, Tint } from './types';

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

/** The camp speech-bubble line for a dragon stage (moved out of `Camp.svelte`, spec Task 8 step
 *  1): `name` is `null` before it hatches (egg has no name yet); `remaining` is the number of
 *  available lieutenants left to neutralise before the next stage (only meaningful for `young`). */
export function stageLine(stage: DragonStage, name: string | null, remaining: number | null): string {
  const label = name ?? 'Ton dragon';
  if (stage === 'egg') return "L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.";
  if (stage === 'hatchling') return `${label} te regarde avec de grands yeux ambre.`;
  if (stage === 'young') {
    const n = Math.max(0, remaining ?? 0);
    const word = n === 1 ? 'technique' : 'techniques';
    return `${label} bat des ailes : encore ${n} ${word} à neutraliser.`;
  }
  return `${label} veille sur le camp. Éris n'a qu'à bien se tenir.`;
}

/** 1-20 characters after trim, no line breaks (server mirrors the length bounds in
 *  `DragonPatch`; this also rejects the newline the server schema doesn't check). */
export function validName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 20) return false;
  return !/[\r\n]/.test(trimmed);
}
