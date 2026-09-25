import { describe, expect, it } from 'vitest';
import { ICONS } from './icons';

describe('SVG icon family (UI3 Ruling A13)', () => {
  it('draws every icon with at least one well-formed path', () => {
    for (const [name, paths] of Object.entries(ICONS)) {
      expect(paths.length, name).toBeGreaterThan(0);
      for (const p of paths) {
        expect(p.d, name).toMatch(/^M/);
        expect(p.d, name).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it('keeps the UI1 drawings: the muted lyre is the lyre struck through', () => {
    expect(ICONS['lyre-muted'].slice(0, ICONS.lyre.length)).toEqual(ICONS.lyre);
    expect(ICONS['lyre-muted'].some((p) => p.halo)).toBe(true);
  });
});
