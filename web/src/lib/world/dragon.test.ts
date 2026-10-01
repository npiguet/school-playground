import { describe, it, expect } from 'vitest';
import { DRAGON_STAGES } from './types';
import { LOCKED_EGG_FILTER, TINT_FILTERS, TINT_SWATCH, dragonCaption, eggFilter, gaugeOf, nextStage, stageActivity, stageLabel, stageLine, validName } from './dragon';

describe('dragon helpers', () => {
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
    expect(stageLine('egg', null, xp(40, 0, 100))).toBe("Chaque piège d'Éris déjoué me fait frémir dans ma coquille.");
    expect(stageLine('hatchling', null, xp(150, 100, 1200))).toBe('Au fait, tu me donnes un nom\u202f?');
    // Spec 2026-09-29 dragon growth §3: how far the next stage is, in words; « under 20 % » is strict.
    expect(stageLine('hatchling', 'Braise', xp(150, 100, 1200))).toBe('Chaque texte bien défendu me fait grandir.');
    expect(stageLine('young', 'Braise', xp(4240, 1200, 5000))).toBe('Chaque texte bien défendu me fait grandir.'); // 760 of 3800 left: 20 %
    expect(stageLine('young', 'Braise', xp(4241, 1200, 5000))).toBe('Encore un peu de gloire et je grandis.');
    expect(stageLine('illustre', 'Braise', xp(39000, 15000, 40000))).toBe('Encore un peu de gloire et je grandis.');
    expect(stageLine('adult', 'Braise', xp(300, 5000, 15000))).toBe('Chaque texte bien défendu me fait grandir.'); // grown before its XP
    expect(stageLine('ancestral', 'Braise', xp(41000, 40000, null))).toBe("J'ai tout lu, tout vu. Et je veille toujours sur toi.");
    for (const st of DRAGON_STAGES) {
      expect(stageLine(st, 'Braise', xp(4300, 1200, 5000))).not.toMatch(/\d|Braise|Ton dragon|ruse|neutralis|technique/);
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
