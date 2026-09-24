import { describe, it, expect } from 'vitest';
import { BESTIARY, entry } from './bestiary';
import { LIEUTENANT_ORDER } from './types';

describe('bestiary', () => {
  it('has an entry per lieutenant plus Éris, four tools, the Muses, Delphes and the dragon', () => {
    for (const k of LIEUTENANT_ORDER) expect(entry(k)?.kind).toBe('monster');
    expect(BESTIARY.map((e) => e.key)).toEqual([
      ...LIEUTENANT_ORDER,
      'eris',
      'argus',
      'ariane',
      'persee',
      'athena',
      'muses',
      'delphes',
      'dragon',
    ]);
  });

  it('every entry separates myth from game fiction and cites sources', () => {
    for (const e of BESTIARY) {
      expect(e.facts.length).toBeGreaterThanOrEqual(3);
      expect(e.sources.length).toBeGreaterThan(5);
      expect(e.inGame.length).toBeGreaterThan(10);
      expect(e.art.startsWith('/art/')).toBe(true);
    }
  });
});
