import { describe, it, expect } from 'vitest';
import { LOCKED_EGG_FILTER, TINT_FILTERS, TINT_SWATCH, eggFilter, stageActivity, stageLabel, stageLine, validName } from './dragon';

describe('dragon helpers', () => {
  it('never offers violet (reserved for Éris) and has six tints', () => {
    expect(Object.keys(TINT_FILTERS)).toEqual(['bronze', 'ecume', 'olivier', 'braise', 'jade', 'argent']);
    for (const f of Object.values(TINT_FILTERS)) expect(f).not.toMatch(/hue-rotate\((2[6-9]\d|3[0-2]\d)deg\)/); // 260–329° ≈ violet band
  });
  it('labels and lines', () => {
    expect(stageLabel('egg')).toBe('Œuf');
    expect(stageLabel('adult')).toBe('Dragon adulte');
    expect(stageLine('egg', null, 1)).toContain("L'œuf frémit");
    expect(stageLine('young', 'Braise', 2)).toBe('Braise bat des ailes : encore 2 techniques à neutraliser.');
    expect(stageLine('young', 'Braise', 1)).toBe('Braise bat des ailes : encore 1 technique à neutraliser.');
    // A real plural (plural()): 0 takes the singular in French.
    expect(stageLine('young', 'Braise', 0)).toBe('Braise bat des ailes : encore 0 technique à neutraliser.');
    expect(stageLine('adult', 'Braise', null)).toBe("Braise veille sur le camp. Éris n'a qu'à bien se tenir.");
  });
  it('has a short ambient activity per stage, for a hotspot caption (unlike stageLine, no title tooltip on iPad)', () => {
    expect(stageActivity('egg')).toBe('Frémit');
    expect(stageActivity('hatchling')).toBe('Curieux');
    expect(stageActivity('young')).toBe("S'entraîne");
    expect(stageActivity('adult')).toBe('Monte la garde');
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
