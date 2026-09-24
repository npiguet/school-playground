import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { ART, artFor } from './art';

function flat(o: unknown): string[] {
  return typeof o === 'string' ? [o] : Object.values(o as object).flatMap(flat);
}

describe('art map', () => {
  // Scene backgrounds have their own 600 KB budget (scenes UI spec §4, scenes/budget.test.ts).
  const nonScene = () => flat(ART).filter((p) => !p.startsWith('/art/scenes/'));

  it('every path exists under public/, non-scene art is under 150 KB', () => {
    for (const p of flat(ART)) expect(existsSync('public' + p), p).toBe(true);
    for (const p of nonScene()) expect(statSync('public' + p).size, p).toBeLessThan(150 * 1024);
  });

  it('total non-scene art payload stays under 2.5 MB', () => {
    expect(nonScene().reduce((s, p) => s + statSync('public' + p).size, 0)).toBeLessThan(2.5 * 1024 * 1024);
  });

  it('artFor resolves and throws on unknown keys', () => {
    expect(artFor('lieutenant', 'hydre')).toBe('/art/lieutenants/hydre_cut.webp');
    expect(() => artFor('lieutenant', 'medusa')).toThrow();
  });
});
