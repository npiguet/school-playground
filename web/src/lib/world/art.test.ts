import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { ART, artFor } from './art';

function flat(o: unknown): string[] {
  return typeof o === 'string' ? [o] : Object.values(o as object).flatMap(flat);
}

describe('art map', () => {
  it('every path exists under public/ and is under 150 KB', () => {
    for (const p of flat(ART)) {
      const file = 'public' + p;
      expect(existsSync(file), file).toBe(true);
      expect(statSync(file).size, file).toBeLessThan(150 * 1024);
    }
  });

  it('total art payload stays under 2.5 MB', () => {
    expect(flat(ART).reduce((s, p) => s + statSync('public' + p).size, 0)).toBeLessThan(2.5 * 1024 * 1024);
  });

  it('artFor resolves and throws on unknown keys', () => {
    expect(artFor('lieutenant', 'hydre')).toBe('/art/lieutenants/hydre_cut.webp');
    expect(() => artFor('lieutenant', 'medusa')).toThrow();
  });
});
