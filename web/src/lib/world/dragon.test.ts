import { describe, it, expect } from 'vitest';
import { DRAGON_STAGES } from './types';
import { LOCKED_EGG_FILTER, TINT_FILTERS, TINT_SWATCH, dragonCaption, eggFilter, stageActivity, stageLabel, stageLine, validName } from './dragon';

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
    // UI3b playability #15: the dragon speaks in the first person under its own plate.
    expect(stageLine('egg', null, 1)).toBe("Chaque piège d'Éris déjoué me fait frémir dans ma coquille.");
    expect(stageLine('hatchling', null, 5)).toBe('Au fait, tu me donnes un nom\u202f?');
    expect(stageLine('hatchling', 'Braise', 5)).toBe("Chaque ruse d'Éris neutralisée me fait grandir.");
    expect(stageLine('young', 'Braise', 2)).toBe("Je bats des ailes\u202f! Encore 2 ruses d'Éris à neutraliser.");
    expect(stageLine('young', 'Braise', 1)).toBe("Je bats des ailes\u202f! Encore 1 ruse d'Éris à neutraliser.");
    expect(stageLine('young', 'Braise', 0)).toBe("Je bats des ailes\u202f! Toutes les ruses d'Éris sont neutralisées, pour l'instant.");
    expect(stageLine('adult', 'Braise', null)).toBe("Je veille sur le camp. Éris n'a qu'à bien se tenir.");
    for (const st of DRAGON_STAGES) {
      expect(stageLine(st, 'Braise', 2)).not.toMatch(/Braise|Ton dragon|technique/);
    }
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
