// The dragon companion: tints (OKLCH settings for the same cut image, decision 11 - never a new
// generation), stage labels/camp speech lines and name validation. Pure functions/data only, no
// DOM/store access, so `Dragon.svelte`, the nest and its care panel, the trophy shelf and
// the victory's spoils (`battle/VictorySpoils.svelte`) all share the same wording and this file stays trivially testable.
import { DRAGON_STAGES, type DragonOut, type DragonStage, type Progression, type Tint } from './types';
import type { OklchSpec } from '../living/tint';
// The import attribute: the e2e specs import this module in plain Node ESM, which demands it.
import TINT_JSON from './tintSpecs.json' with { type: 'json' };

export type Mood = 'idle' | 'happy' | 'sleepy';

// Violet is reserved for Éris (decision 11) - never offered as a dragon tint. `bronze` is the
// unlockable-by-default original colour (no tint: null); the other five are earned via Oracle quests
// (`ORACLE_REWARDS` in `server/app/world/catalog.py`), in this exact order. Each recolours the same cut
// picture (decision 11 - never a new generation) in OKLCH, at full strength (living/tint.ts): the
// user's choice of 2026-10-02 after comparing the methods in the lab ("I'm OK with keeping the OKLCH
// variations, with strength at 100%. It looks more natural than the CSS shift."), with Argent at shift
// -166, chroma 0.52, lightness 1.36, Olivier at 50 and Écume at 165; Braise and Jade keep the panel's
// starting values (the hue the old CSS filter gave the bronze), which the user left as they were.
// The settings live in tintSpecs.json, the one source the art tools read too (tools/art/tints.py).
// Amended 2026-10-03, baked tints (the user: "for production, we'll use the baked tints"): the game
// never tints at run time; tools/art/bake_tints.py writes each stage under each tint as its own
// picture (art.ts dragonArt), and a changed entry here needs a re-bake (`tools/art/run_docker.sh
// bake`; bakedTints.test.ts fails until then). Only the lab's « Teintes » sliders tint live, on the shader.
export const TINT_SPECS: Record<Tint, OklchSpec | null> = TINT_JSON;

/** The CSS filter of a locked tint's egg picture (the care panel's swatches, the trophy shelf's tint
 *  cubbies): grey, never tinted; a won tint's egg is tinted like the dragon (TINT_SPECS). Applied to
 *  the egg's `<img>` only, never to the swatch around it: the gold ring and the painted lock keep their
 *  own colours (fix round 1: a filtered ring turned violet, Éris's colour, and a tinted lock was barely
 *  readable). */
export const LOCKED_EGG_FILTER = 'grayscale(1) opacity(0.55)';

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
  illustre: 'Dragon illustre',
  ancestral: 'Dragon ancestral',
};

export function stageLabel(stage: DragonStage): string {
  return STAGE_LABELS[stage];
}

/** The dragon's identity: its name, else what it is (the nest's caption, the cut-out's alt). */
export function dragonCaption(d: Pick<DragonOut, 'name' | 'stage'>): string {
  return d.name ?? (d.stage === 'egg' ? 'Un œuf de dragon' : stageLabel(d.stage));
}

/** A stage's scale: its own threshold and the next stage's (null at the last stage). */
export interface Scale {
  floor: number;
  next: number | null;
}

/** The gauge on a stage's scale (spec 2026-09-29 dragon growth §2, R3): a total below the floor (a stage
 *  grown before its XP) reads empty, one past the next threshold (a stale answer) full; the last stage
 *  is always full. */
export function gaugeOf(total: number, s: Scale): { value: number; max: number } {
  if (s.next === null) return { value: 1, max: 1 };
  const max = Math.max(1, s.next - s.floor);
  return { value: Math.min(max, Math.max(0, total - s.floor)), max };
}

/** Spec 2026-09-29 dragon growth §1: the built-in thresholds (server/app/world/dragon.py
 *  DEFAULT_STAGE_XP), until the catalogue's table has come. */
export const DEFAULT_STAGE_XP: Record<DragonStage, number> = { egg: 0, hatchling: 100, young: 1200, adult: 5000, illustre: 15000, ancestral: 40000 };

/** Each stage's XP from the catalogue's table (the rules file's), the defaults for any it lacks. */
export function stageXp(catalog: { stages?: { key: string; xp: number }[] } | null | undefined): Record<DragonStage, number> {
  const out = { ...DEFAULT_STAGE_XP };
  for (const s of catalog?.stages ?? []) if ((DRAGON_STAGES as readonly string[]).includes(s.key)) out[s.key as DragonStage] = s.xp;
  return out;
}

export function scaleOf(stage: DragonStage, xpOf: Record<DragonStage, number>): Scale {
  const i = Math.max(0, DRAGON_STAGES.indexOf(stage));
  return { floor: xpOf[DRAGON_STAGES[i]], next: i + 1 < DRAGON_STAGES.length ? xpOf[DRAGON_STAGES[i + 1]] : null };
}

/** The victory's laurel (spec §2, the P1-2 two-part logic keyed on the stage): `before` is the old
 *  stage's scale, which fills to its max when the dragon grows; `after` the new stage's, from the
 *  total before (no growth) or 0, to the total after. The new scale is the server's when the victory
 *  carries it, else the table's (a victory saved before the change, R7). */
export interface VictoryGauge {
  /** The stages the gauge was built from: the dragon card reads them too, so the « Ton dragon
   *  grandit ! » note and the card never disagree. */
  stages: { before: DragonStage; after: DragonStage };
  grew: boolean;
  before: { label: string; max: number; from: number };
  after: { label: string; max: number; from: number; to: number };
}

export function victoryGauge(p: { xp: Progression['xp']; dragon: Progression['dragon'] }, xpOf: Record<DragonStage, number>): VictoryGauge {
  const before = p.xp.stage_before ?? p.dragon.stage_before;
  const after = p.xp.stage_after ?? p.dragon.stage_after;
  const beforeScale = scaleOf(before, xpOf);
  const afterScale = p.xp.floor !== undefined && p.xp.next !== undefined ? { floor: p.xp.floor, next: p.xp.next } : scaleOf(after, xpOf);
  const b = gaugeOf(p.xp.total_before, beforeScale);
  const a0 = gaugeOf(p.xp.total_before, afterScale);
  const a1 = gaugeOf(p.xp.total_after, afterScale);
  return {
    stages: { before, after },
    grew: before !== after,
    before: { label: stageLabel(before), max: b.max, from: b.value },
    after: { label: stageLabel(after), max: a1.max, from: a0.value, to: a1.value },
  };
}

/** Where the victory's laurel stands in its animation: `start` (mounted), `filled` (the old stage's
 *  scale full, when the dragon grows) or `after` (the final value, on the new scale; at once under
 *  reduced motion). */
export type VictoryPhase = 'start' | 'filled' | 'after';

/** What the victory's laurel shows at a phase, always read from the current gauge: a stage table that
 *  arrives mid-animation rescales every phase, the filled one included. */
export function victoryLaurel(g: VictoryGauge, phase: VictoryPhase): { label: string; max: number; value: number; grewNote: boolean } {
  if (phase === 'after' || !g.grew) {
    const value = phase === 'start' ? g.after.from : g.after.to;
    return { label: g.after.label, max: g.after.max, value, grewNote: g.grew };
  }
  return { label: g.before.label, max: g.before.max, value: phase === 'filled' ? g.before.max : g.before.from, grewNote: false };
}

/** The stage after this one (the last stage is its own). */
export function nextStage(stage: DragonStage): DragonStage {
  const i = DRAGON_STAGES.indexOf(stage);
  return DRAGON_STAGES[Math.min(DRAGON_STAGES.length - 1, i + 1)];
}

/** The next stage is close (spec 2026-09-29 dragon growth §3, its R6; explanations §1 case 4): strictly
 *  under a fifth of the stage's span left, in whole numbers, on the stored stage's scale. Never at the top. */
export function nearNextStage(xp: { total: number } & Scale): boolean {
  return xp.next !== null && 5 * (xp.next - xp.total) < xp.next - xp.floor;
}

/** What the dragon says of itself at its stage, in its own voice (UI3b playability #15: its plate
 *  names it, so it speaks in the first person; the egg speaks from inside its shell). The camp's
 *  greeting. Spec 2026-09-29 dragon growth §3: once hatched, how far the next stage is, in words (never
 *  a number: the HUD carries them); « under 20 % » is strictly under a fifth of the stage's span.
 *  `close` overrides that: the camp passes false when its next goal, a seal, already says « Encore un
 *  peu » (explanations §1, R7). A hatched dragon without a name never hears this line: the camp asks
 *  for its name through `camp.next.name` instead (explanations §1, R2). */
export function stageLine(stage: DragonStage, xp: { total: number } & Scale, close = nearNextStage(xp)): string {
  // UI5 playability #12: it follows `camp.enter`, which has already said hello.
  if (stage === 'egg') return "Chaque piège d'Éris déjoué me fait frémir dans ma coquille.";
  if (stage === 'ancestral' || xp.next === null) return "J'ai tout lu, tout vu. Et je veille toujours sur toi.";
  return close ? 'Encore un peu de gloire et je grandis.' : 'Chaque texte bien défendu me fait grandir.';
}

// What the dragon is up to, as a sentence under its growth in the nest (UI3b playability #5: a lone
// « Curieux » read like a form value).
const STAGE_ACTIVITY: Record<DragonStage, string> = {
  egg: 'Il frémit dans sa coquille.',
  hatchling: 'Il est curieux.',
  young: "Il s'entraîne à voler.",
  adult: 'Il monte la garde.',
  illustre: 'Il veille sur le camp et raconte ses exploits.',
  ancestral: 'Il lit les vieux parchemins et veille sur toi.',
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
