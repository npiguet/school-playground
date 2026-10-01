import { describe, it, expect } from 'vitest';
import { DRAGON_STAGES, type Progression } from './types';
import {
  DEFAULT_STAGE_XP,
  LOCKED_EGG_FILTER,
  TINT_FILTERS,
  TINT_SWATCH,
  dragonCaption,
  eggFilter,
  gaugeOf,
  nearNextStage,
  nextStage,
  scaleOf,
  stageActivity,
  stageLabel,
  stageLine,
  stageXp,
  validName,
  victoryGauge,
  victoryLaurel,
} from './dragon';

describe('dragon helpers', () => {
  it('knows when the next stage is close: strictly under a fifth of the span (spec 2026-09-29 explanations §1, R4)', () => {
    expect(nearNextStage({ total: 1101, floor: 100, next: 1200 })).toBe(true);
    expect(nearNextStage({ total: 980, floor: 100, next: 1200 })).toBe(false); // exactly a fifth left
    expect(nearNextStage({ total: 81, floor: 0, next: 100 })).toBe(true);
    expect(nearNextStage({ total: 300, floor: 5000, next: 15000 })).toBe(false); // a stage grown before its XP
    expect(nearNextStage({ total: 41000, floor: 40000, next: null })).toBe(false);
  });
  it('never offers violet (reserved for Éris) and has six tints', () => {
    expect(Object.keys(TINT_FILTERS)).toEqual(['bronze', 'ecume', 'olivier', 'braise', 'jade', 'argent']);
    for (const f of Object.values(TINT_FILTERS)) expect(f).not.toMatch(/hue-rotate\((2[6-9]\d|3[0-2]\d)deg\)/); // 260–329° ≈ violet band
  });
  it('labels and lines', () => {
    expect(stageLabel('egg')).toBe('Œuf');
    expect(stageLabel('adult')).toBe('Dragon adulte');
    expect(DRAGON_STAGES.map(stageLabel)).toEqual(['Œuf', 'Dragonnet', 'Jeune dragon', 'Dragon adulte', 'Dragon illustre', 'Dragon ancestral']);
    expect(dragonCaption({ name: null, stage: 'ancestral' })).toBe('Dragon ancestral');
    expect(dragonCaption({ name: null, stage: 'egg' })).toBe('Un œuf de dragon');
    expect(dragonCaption({ name: null, stage: 'young' })).toBe('Jeune dragon');
    expect(dragonCaption({ name: 'Braise', stage: 'young' })).toBe('Braise');
    const xp = (total: number, floor: number, next: number | null) => ({ total, floor, next });
    // UI3b playability #15: the dragon speaks in the first person under its own plate.
    expect(stageLine('egg', xp(40, 0, 100))).toBe("Chaque piège d'Éris déjoué me fait frémir dans ma coquille.");
    // Spec 2026-09-29 dragon growth §3: how far the next stage is, in words; « under 20 % » is strict.
    expect(stageLine('hatchling', xp(150, 100, 1200))).toBe('Chaque texte bien défendu me fait grandir.');
    expect(stageLine('young', xp(4240, 1200, 5000))).toBe('Chaque texte bien défendu me fait grandir.'); // 760 of 3800 left: 20 %
    expect(stageLine('young', xp(4241, 1200, 5000))).toBe('Encore un peu de gloire et je grandis.');
    expect(stageLine('illustre', xp(39000, 15000, 40000))).toBe('Encore un peu de gloire et je grandis.');
    expect(stageLine('adult', xp(300, 5000, 15000))).toBe('Chaque texte bien défendu me fait grandir.'); // grown before its XP
    expect(stageLine('ancestral', xp(41000, 40000, null))).toBe("J'ai tout lu, tout vu. Et je veille toujours sur toi.");
    // Explanations §1, R7: the camp can ask for the far wording (its next goal already says « Encore un peu »).
    expect(stageLine('young', xp(4241, 1200, 5000), false)).toBe('Chaque texte bien défendu me fait grandir.');
    expect(stageLine('egg', xp(90, 0, 100), true)).toBe("Chaque piège d'Éris déjoué me fait frémir dans ma coquille.");
    for (const st of DRAGON_STAGES) {
      expect(stageLine(st, xp(4300, 1200, 5000))).not.toMatch(/\d|Braise|Ton dragon|ruse|neutralis|technique/);
    }
  });
  it('measures the gauge on a stage scale, clamped, full at the top', () => {
    expect(gaugeOf(3100, { floor: 1200, next: 5000 })).toEqual({ value: 1900, max: 3800 });
    expect(gaugeOf(300, { floor: 5000, next: 15000 })).toEqual({ value: 0, max: 10000 });
    expect(gaugeOf(9000, { floor: 100, next: 1200 })).toEqual({ value: 1100, max: 1100 });
    expect(gaugeOf(41000, { floor: 40000, next: null })).toEqual({ value: 1, max: 1 });
    expect(DRAGON_STAGES.map(nextStage)).toEqual(['hatchling', 'young', 'adult', 'illustre', 'ancestral', 'ancestral']);
  });
  it('says what it is up to as a sentence, never a lone word (UI3b playability #5)', () => {
    expect(stageActivity('egg')).toBe('Il frémit dans sa coquille.');
    expect(stageActivity('hatchling')).toBe('Il est curieux.');
    expect(stageActivity('young')).toBe("Il s'entraîne à voler.");
    expect(stageActivity('adult')).toBe('Il monte la garde.');
    expect(stageActivity('illustre')).toBe('Il veille sur le camp et raconte ses exploits.');
    expect(stageActivity('ancestral')).toBe('Il lit les vieux parchemins et veille sur toi.');
  });
  it('tints a won egg and greys a locked one (fix round 1: on the egg picture only)', () => {
    expect(eggFilter('ecume', true)).toBe(TINT_FILTERS.ecume);
    expect(eggFilter('bronze', true)).toBe('none');
    expect(eggFilter('ecume', false)).toBe(LOCKED_EGG_FILTER);
    expect(LOCKED_EGG_FILTER).toMatch(/grayscale\(1\)/);
  });
  it('validates names', () => {
    expect(validName('  Braise ')).toBe(true);
    expect(validName('')).toBe(false);
    expect(validName('a'.repeat(21))).toBe(false);
    expect(validName('a\nb')).toBe(false);
  });
  it('has a flat swatch per tint, never a red (UI3 Ruling A12)', () => {
    expect(Object.keys(TINT_SWATCH).sort()).toEqual(['argent', 'braise', 'bronze', 'ecume', 'jade', 'olivier']);
    for (const [tint, hex] of Object.entries(TINT_SWATCH)) {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(r >= 200 && g < 60 && b < 60, tint).toBe(false);
    }
  });
});

describe('the victory gauge (spec 2026-09-29 dragon growth §2)', () => {
  const T = DEFAULT_STAGE_XP;
  const p = (xp: Partial<Progression['xp']>, dragon: Progression['dragon']) => ({
    xp: { session: 51, bonuses: [], total_before: 0, total_after: 0, ...xp },
    dragon,
  });
  const stay = (s: Progression['dragon']['stage_after']) => ({ stage_before: s, stage_after: s, needs_name: false });

  it('reads the stage table from the catalogue, the defaults until it has come', () => {
    expect(DEFAULT_STAGE_XP).toEqual({ egg: 0, hatchling: 100, young: 1200, adult: 5000, illustre: 15000, ancestral: 40000 });
    expect(stageXp(null)).toEqual(T);
    expect(stageXp({ stages: [{ key: 'hatchling', xp: 50 }, { key: 'dragon', xp: 7 }] })).toEqual({ ...T, hatchling: 50 });
    expect(scaleOf('young', T)).toEqual({ floor: 1200, next: 5000 });
    expect(scaleOf('ancestral', T)).toEqual({ floor: 40000, next: null });
  });

  it('stays on one scale when the dragon does not grow', () => {
    const g = victoryGauge(p({ total_before: 487, total_after: 538, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 }, stay('hatchling')), T);
    expect(g).toEqual({ stages: { before: 'hatchling', after: 'hatchling' }, grew: false, before: { label: 'Dragonnet', max: 1100, from: 387 }, after: { label: 'Dragonnet', max: 1100, from: 387, to: 438 } });
  });

  it('fills the old stage, then switches to the new one', () => {
    const g = victoryGauge(p({ total_before: 1100, total_after: 1211, stage_before: 'hatchling', stage_after: 'young', floor: 1200, next: 5000 }, { stage_before: 'hatchling', stage_after: 'young', needs_name: false }), T);
    expect(g).toEqual({ stages: { before: 'hatchling', after: 'young' }, grew: true, before: { label: 'Dragonnet', max: 1100, from: 1000 }, after: { label: 'Jeune dragon', max: 3800, from: 0, to: 11 } });
  });

  it('skips a middle stage when it crosses two at once', () => {
    const g = victoryGauge(p({ total_before: 60, total_after: 1250, stage_before: 'egg', stage_after: 'young', floor: 1200, next: 5000 }, { stage_before: 'egg', stage_after: 'young', needs_name: true }), T);
    expect(g).toEqual({ stages: { before: 'egg', after: 'young' }, grew: true, before: { label: 'Œuf', max: 100, from: 60 }, after: { label: 'Jeune dragon', max: 3800, from: 0, to: 50 } });
  });

  it('is full at the top, never dividing by zero', () => {
    const g = victoryGauge(p({ total_before: 39950, total_after: 40100, stage_before: 'illustre', stage_after: 'ancestral', floor: 40000, next: null }, { stage_before: 'illustre', stage_after: 'ancestral', needs_name: false }), T);
    expect(g).toEqual({ stages: { before: 'illustre', after: 'ancestral' }, grew: true, before: { label: 'Dragon illustre', max: 25000, from: 24950 }, after: { label: 'Dragon ancestral', max: 1, from: 1, to: 1 } });
  });

  it('reads empty for a stage grown before its XP', () => {
    const g = victoryGauge(p({ total_before: 300, total_after: 354, stage_before: 'adult', stage_after: 'adult', floor: 5000, next: 15000 }, stay('adult')), T);
    expect(g.after).toEqual({ label: 'Dragon adulte', max: 10000, from: 0, to: 0 });
  });

  it('resumes a victory saved before the stages on the dragon\'s scale', () => {
    // A play state saved before the change: rank fields, no stage fields (R7).
    const legacy = { xp: { session: 51, bonuses: [], total_before: 60, total_after: 160, rank_before: 1, rank_after: 2, title_after: 'Scribe des Muses' }, dragon: { stage_before: 'egg' as const, stage_after: 'hatchling' as const, needs_name: true } };
    expect(victoryGauge(legacy, T)).toEqual({ stages: { before: 'egg', after: 'hatchling' }, grew: true, before: { label: 'Œuf', max: 100, from: 60 }, after: { label: 'Dragonnet', max: 1100, from: 0, to: 60 } });
    expect(victoryGauge(legacy, stageXp({ stages: [{ key: 'hatchling', xp: 50 }] })).after).toEqual({ label: 'Dragonnet', max: 1150, from: 10, to: 110 });
  });

  it('names the stages it was built from (the XP block first), so the dragon card follows the note', () => {
    const g = victoryGauge(p({ total_before: 1100, total_after: 1211, stage_before: 'hatchling', stage_after: 'young', floor: 1200, next: 5000 }, stay('hatchling')), T);
    expect(g.stages).toEqual({ before: 'hatchling', after: 'young' });
    expect(g.grew).toBe(true);
  });
});

describe('the victory laurel at each phase', () => {
  const T = DEFAULT_STAGE_XP;
  const grown = (xpOf: typeof T) =>
    victoryGauge({ xp: { session: 51, bonuses: [], total_before: 60, total_after: 160 }, dragon: { stage_before: 'egg', stage_after: 'hatchling', needs_name: true } }, xpOf);

  it('fills the old scale, then shows the new one with its note', () => {
    const g = grown(T);
    expect(victoryLaurel(g, 'start')).toEqual({ label: 'Œuf', max: 100, value: 60, grewNote: false });
    expect(victoryLaurel(g, 'filled')).toEqual({ label: 'Œuf', max: 100, value: 100, grewNote: false });
    expect(victoryLaurel(g, 'after')).toEqual({ label: 'Dragonnet', max: 1100, value: 60, grewNote: true });
  });

  it('rescales the filled phase when the stage table arrives mid-animation', () => {
    // The catalogue lowers the hatchling to 50 after the fill started: the old scale is 50 wide now.
    const late = grown(stageXp({ stages: [{ key: 'hatchling', xp: 50 }] }));
    expect(victoryLaurel(late, 'filled')).toEqual({ label: 'Œuf', max: 50, value: 50, grewNote: false });
  });

  it('stays on one scale without a note when the dragon does not grow', () => {
    const g = victoryGauge({ xp: { session: 51, bonuses: [], total_before: 487, total_after: 538 }, dragon: { stage_before: 'hatchling', stage_after: 'hatchling', needs_name: false } }, T);
    expect(victoryLaurel(g, 'start')).toEqual({ label: 'Dragonnet', max: 1100, value: 387, grewNote: false });
    expect(victoryLaurel(g, 'after')).toEqual({ label: 'Dragonnet', max: 1100, value: 438, grewNote: false });
  });
});
