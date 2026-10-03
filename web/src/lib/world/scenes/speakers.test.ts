import { describe, expect, it } from 'vitest';
import type { DragonOut } from '../types';
import { dragonSays, dragonSpeaker } from './speakers';

const egg = { name: null, tint: 'bronze', stage: 'egg' } as DragonOut;

describe('the dragon as a speaker (UI1 greeting, reused by every place)', () => {
  it('is « L\'œuf » before it hatches, its name after, « Ton dragon » while unnamed', () => {
    expect(dragonSpeaker(egg)).toEqual({ speaker: 'dragon', name: "L'œuf", portrait: '/art/dragon/dragon_egg_cut.webp', portraitTint: 'bronze' });
    expect(dragonSpeaker({ ...egg, stage: 'hatchling' }).name).toBe('Ton dragon');
    expect(dragonSpeaker({ ...egg, stage: 'young', name: 'Braise', tint: 'ecume' })).toMatchObject({
      name: 'Braise',
      // The baked picture of the stage in its tint (amended 2026-10-03, baked tints).
      portrait: '/art/dragon/dragon_young_ecume.webp',
      portraitTint: 'ecume',
    });
  });

  it('says a line', () => {
    expect(dragonSays(egg, 'Bonjour.')).toMatchObject({ speaker: 'dragon', text: 'Bonjour.' });
  });
});
