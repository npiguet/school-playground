import { describe, it, expect } from 'vitest';
import { TINT_FILTERS, stageLabel, stageLine, validName } from './dragon';

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
    expect(stageLine('adult', 'Braise', null)).toBe("Braise veille sur le camp. Éris n'a qu'à bien se tenir.");
  });
  it('validates names', () => {
    expect(validName('  Braise ')).toBe(true);
    expect(validName('')).toBe(false);
    expect(validName('a'.repeat(21))).toBe(false);
    expect(validName('a\nb')).toBe(false);
  });
});
