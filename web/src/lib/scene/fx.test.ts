import { describe, expect, it } from 'vitest';
import { FX_COUNTS, moteAlpha, spawnMote, stepMotes } from './fx';

function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('ambient particles', () => {
  it('spawns embers in the bottom quarter, rising', () => {
    const rand = seeded();
    for (let i = 0; i < 50; i++) {
      const m = spawnMote('embers', 1000, 600, rand);
      expect(m.y).toBeGreaterThanOrEqual(450);
      expect(m.y).toBeLessThanOrEqual(600);
      expect(m.vy).toBeLessThan(0);
      expect(m.age).toBe(0);
    }
  });

  it('moves living motes and respawns expired ones', () => {
    const rand = seeded(7);
    const m = { ...spawnMote('embers', 1000, 600, rand), age: 0, life: 3000 };
    const [moved] = stepMotes([m], 'embers', 1000, 600, 100, rand);
    expect(moved.y).toBeLessThan(m.y);
    expect(moved.age).toBe(100);
    const [fresh] = stepMotes([{ ...m, age: 2999 }], 'embers', 1000, 600, 10, rand);
    expect(fresh.age).toBe(0);
  });

  it('keeps a constant, finite population', () => {
    const rand = seeded(3);
    let motes = Array.from({ length: FX_COUNTS.dust }, () => spawnMote('dust', 800, 450, rand, true));
    for (let i = 0; i < 500; i++) motes = stepMotes(motes, 'dust', 800, 450, 16, rand);
    expect(motes).toHaveLength(FX_COUNTS.dust);
    for (const m of motes) expect(Number.isFinite(m.x) && Number.isFinite(m.y)).toBe(true);
  });

  it('fades in over the first fifth of a life and out after', () => {
    const m = spawnMote('dust', 100, 100, seeded());
    expect(moteAlpha({ ...m, age: 0, life: 1000 })).toBe(0);
    expect(moteAlpha({ ...m, age: 200, life: 1000 })).toBeCloseTo(1, 5);
    expect(moteAlpha({ ...m, age: 1000, life: 1000 })).toBe(0);
  });
});
