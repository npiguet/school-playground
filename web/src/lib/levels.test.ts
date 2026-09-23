import { describe, it, expect } from 'vitest';
import { levelIndex, includesParticiplesInVerbPass } from './levels';

describe('levelIndex', () => {
  it('orders HarmoS levels', () => {
    expect(levelIndex('5H')).toBe(0);
    expect(levelIndex('11H')).toBe(6);
  });
});

describe('includesParticiplesInVerbPass', () => {
  it('gates participles to levels >= 8H', () => {
    expect(includesParticiplesInVerbPass('7H')).toBe(false);
    expect(includesParticiplesInVerbPass('8H')).toBe(true);
  });
});
