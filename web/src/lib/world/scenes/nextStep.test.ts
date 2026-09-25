// Carry recommendation 6 / playability #11 (Ruling W14): at most one "next step" glow per scene,
// whatever the camp state. (The hub-wide nextStep(camp) is UI3b.)
import { describe, expect, it } from 'vitest';
import type { CampResponse } from '../types';
import { LIBRARY_SCENE } from './library';
import { DELPHI_SCENE } from './delphi';
import { TITLE_SCENE } from './title';
import { CAMP_SCENE } from './camp';

const noBoss = { tier_available: null, tiers_won: [], active_quest_id: null };
const base = { dragon: { name: null, stage: 'egg' }, lieutenants: [], rewards_count: 0, boss: noBoss };
const camps = [
  null,
  // A new hero: nothing defended yet, the week's scrolls sealed.
  { ...base, xp: { total: 0 }, oracle: { status: 'sealed' }, quests: [] },
  // A battle tier open (and the scrolls still sealed).
  { ...base, xp: { total: 400 }, oracle: { status: 'sealed' }, quests: [], boss: { tier_available: 1, tiers_won: [], active_quest_id: null } },
  // Mid-game: the week chosen, quests running.
  { ...base, xp: { total: 90 }, oracle: { status: 'chosen' }, quests: [{ id: 1, kind: 'board', status: 'active' }] },
  // Mid-game with the scrolls sealed and a fight engaged.
  { ...base, xp: { total: 900 }, oracle: { status: 'sealed' }, quests: [{ id: 9, kind: 'boss', status: 'active' }], boss: { tier_available: 2, tiers_won: [1], active_quest_id: 9 } },
] as unknown as (CampResponse | null)[];

describe('one glow per scene', () => {
  it.each([LIBRARY_SCENE, DELPHI_SCENE, TITLE_SCENE, CAMP_SCENE])('$id', (scene) => {
    for (const camp of camps) {
      const lit = scene.hotspots.filter((h) => h.state({ camp, catalog: null }).isNew).map((h) => h.id);
      expect(lit.length, `${scene.id} with ${JSON.stringify(camp?.xp ?? null)}: ${lit}`).toBeLessThanOrEqual(1);
    }
  });
});
