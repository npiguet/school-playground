// The battle's foes (spec 2026-10-03 living battle; plan Rulings B3, B6): every opponent has a rig of its
// own name, Éris routed has hers, every foe lives (its rig baked), and each sprite is the game's.
import { describe, expect, it } from 'vitest';
import { ART } from '../world/art';
import { LIEUTENANT_ORDER } from '../world/types';
import { FOE_SPRITES } from './foes';
import { FOE_ASPECT, FOE_RIGS, FOE_WIDTH, foeRigFor, isFoeRig, isLivingRig, livingFoe } from './stages';

describe('the foes', () => {
  it('rigs every opponent under its own id, and Éris routed under hers', () => {
    for (const k of [...LIEUTENANT_ORDER, 'eris' as const]) {
      expect(isFoeRig(k), k).toBe(true);
      expect(foeRigFor(k, false)).toBe(k);
    }
    expect(foeRigFor('eris', true)).toBe('eris_flustered');
    expect(foeRigFor('hydre', true)).toBe('hydre');
  });

  it('tells a rig id from anything else', () => {
    expect(isLivingRig('adult')).toBe(true);
    expect(isLivingRig('sirenes')).toBe(true);
    expect(isLivingRig('egg')).toBe(false);
    expect(isLivingRig('griffon')).toBe(false);
  });

  it('lives, every one of them', () => {
    for (const r of FOE_RIGS) expect(livingFoe(r), r).toBe(r);
  });

  it("draws each foe from the game's own picture, a 585 x 1024 portrait", () => {
    expect(FOE_SPRITES.eris).toBe(ART.eris);
    expect(FOE_SPRITES.eris_flustered).toBe(ART.erisFlustered);
    for (const k of LIEUTENANT_ORDER) expect(FOE_SPRITES[k]).toBe(ART.lieutenants[k]);
    expect(Object.keys(FOE_SPRITES).sort()).toEqual([...FOE_RIGS].sort());
    expect(FOE_WIDTH).toBe(585);
    expect(FOE_ASPECT).toBeCloseTo(585 / 1024, 9);
  });
});
