// Carry recommendation 6 / playability #11 (Ruling W14): at most one "next step" glow per scene,
// whatever the camp state. (The hub-wide nextStep(camp) is UI3b.)
import { describe, expect, it } from 'vitest';
import type { CampResponse } from '../types';
import { LIBRARY_SCENE } from './library';
import { DELPHI_SCENE } from './delphi';
import { TITLE_SCENE } from './title';

const camps = [null, { xp: { total: 0 }, oracle: { status: 'sealed' }, quests: [] }, { xp: { total: 90 }, oracle: { status: 'chosen' }, quests: [] }] as unknown as (CampResponse | null)[];

describe('one glow per scene', () => {
  it.each([LIBRARY_SCENE, DELPHI_SCENE, TITLE_SCENE])('$id', (scene) => {
    for (const camp of camps) {
      const lit = scene.hotspots.filter((h) => h.state({ camp, catalog: null }).isNew).map((h) => h.id);
      expect(lit.length, `${scene.id} with ${JSON.stringify(camp?.xp ?? null)}: ${lit}`).toBeLessThanOrEqual(1);
    }
  });
});
