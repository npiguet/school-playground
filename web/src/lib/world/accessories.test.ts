import { describe, expect, it } from 'vitest';
import { ACCESSORY_MANIFEST, DRAW_ORDER, SLOTS, SLOT_NAMES, WEARING, accessoryLayers, accessoryPicture, wears, wornAfter } from './accessories';

// Spec 2026-09-29 drachmes §4 (review focus 4).
describe('the dragon wears its pieces', () => {
  it('knows the slots, their order and the stages that wear them', () => {
    expect(SLOTS).toEqual(['cou', 'queue', 'dos', 'tete']);
    expect(DRAW_ORDER).toEqual(['queue', 'dos', 'cou', 'tete']);
    expect(WEARING).toEqual(['young', 'adult', 'illustre', 'ancestral']);
    expect(SLOT_NAMES).toEqual({ cou: 'Au cou', queue: 'À la queue', dos: 'Sur le dos', tete: 'Sur la tête' });
    expect([wears('egg'), wears('hatchling'), wears('young'), wears('ancestral')]).toEqual([false, false, true, true]);
  });

  it('places each overlay as percentages of the stage picture, back to front', () => {
    const e = ACCESSORY_MANIFEST['hydre-cou'].adult!;
    const [queue, cou] = accessoryLayers(['hydre-cou', 'echo-queue'], 'adult');
    expect(queue.item).toBe('echo-queue');
    expect(cou).toMatchObject({ item: 'hydre-cou', src: `/art/dragon/accessories/${e.src}` });
    expect(cou.left).toBeCloseTo(e.x * 100, 6);
    expect(cou.top).toBeCloseTo(e.y * 100, 6);
    expect(cou.width).toBeCloseTo(e.w * 100, 6);
    expect(cou.height).toBeCloseTo(e.h * 100, 6);
    expect(accessoryLayers(['lethe-tete', 'hydre-dos', 'sirenes-cou', 'chimere-queue'], 'young').map((l) => l.item)).toEqual([
      'chimere-queue', 'hydre-dos', 'sirenes-cou', 'lethe-tete',
    ]);
  });

  it('keeps the pieces on the egg and the hatchling without drawing them, and skips what it does not know', () => {
    expect(accessoryLayers(['hydre-cou'], 'egg')).toEqual([]);
    expect(accessoryLayers(['hydre-cou'], 'hatchling')).toEqual([]);
    expect(accessoryLayers(['medusa-cou', 'hydre-aile'], 'adult')).toEqual([]);
    expect(accessoryLayers(['hydre-cou', 'echo-cou'], 'adult').map((l) => l.item)).toEqual(['hydre-cou']); // one per slot
  });

  it('pictures a piece at the dragon\'s stage, the adult\'s before it wears', () => {
    expect(accessoryPicture('echo-dos', 'illustre')).toBe(`/art/dragon/accessories/${ACCESSORY_MANIFEST['echo-dos'].illustre!.src}`);
    expect(accessoryPicture('echo-dos', 'egg')).toBe(`/art/dragon/accessories/${ACCESSORY_MANIFEST['echo-dos'].adult!.src}`);
    expect(accessoryPicture('medusa-dos', 'adult')).toBeNull();
  });

  it('swaps a piece in its slot, or takes it off', () => {
    expect(wornAfter(['echo-queue', 'hydre-cou'], 'cou', 'lethe-cou')).toEqual(['echo-queue', 'lethe-cou']);
    expect(wornAfter(['echo-queue', 'hydre-cou'], 'cou', null)).toEqual(['echo-queue']);
    expect(wornAfter([], 'tete', 'hydre-tete')).toEqual(['hydre-tete']);
    expect(wornAfter(['hydre-tete'], 'queue', 'echo-queue')).toEqual(['echo-queue', 'hydre-tete']);
  });
});
