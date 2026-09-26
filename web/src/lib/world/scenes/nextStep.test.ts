// Carry recommendation 6 / playability #11 (Rulings W14, B9): at most one "next step" glow per
// scene, whatever the camp state. The place glows read the shared nextStep(camp) (../nextStep.ts).
import { describe, expect, it } from 'vitest';
import type { CampResponse } from '../types';
import { LIBRARY_SCENE } from './library';
import { DELPHI_SCENE } from './delphi';
import { TITLE_SCENE } from './title';
import { CAMP_SCENE } from './camp';
import { NEST_SCENE } from './nest';
import { CABIN_SCENE } from './cabin';

const noBoss = { tier_available: null, tiers_won: [], active_quest_id: null };
const base = { dragon: { name: null, stage: 'egg' }, lieutenants: [], rewards_count: 0, boss: noBoss, prophecies: [] };
const prophecy = (days: number) => [{ text_id: 1, title: 'La mer', due_date: '2026-09-29', days_left: days }];
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
  // The week chosen, a prophecy due in 2 days.
  { ...base, xp: { total: 90 }, oracle: { status: 'chosen' }, quests: [], prophecies: prophecy(2) },
  // A battle open with a prophecy due tomorrow (and a new hero's scrolls sealed).
  { ...base, xp: { total: 0 }, oracle: { status: 'sealed' }, quests: [], prophecies: prophecy(1), boss: { tier_available: 1, tiers_won: [], active_quest_id: null } },
] as unknown as (CampResponse | null)[];

describe('one glow per scene', () => {
  it.each([LIBRARY_SCENE, DELPHI_SCENE, TITLE_SCENE, CAMP_SCENE, NEST_SCENE, CABIN_SCENE])('$id', (scene) => {
    for (const camp of camps) {
      const lit = scene.hotspots.filter((h) => h.state({ camp, catalog: null }).isNew).map((h) => h.id);
      expect(lit.length, `${scene.id} with ${JSON.stringify(camp?.xp ?? null)}: ${lit}`).toBeLessThanOrEqual(1);
    }
  });
});
