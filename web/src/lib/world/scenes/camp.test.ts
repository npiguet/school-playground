import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, LieutenantState, QuestOut, WorldCatalog } from '../types';
import { CAMP_HOTSPOTS, CAMP_SCENE, campGreeting, dragonCaption } from './camp';

function camp(over: Partial<CampResponse> = {}): CampResponse {
  return {
    profile: { id: 7, name: 'Ariane' } as CampResponse['profile'],
    xp: { total: 0, rank: 1, title: 'Recrue du camp', next_threshold: 150, rank_floor: 0 },
    dragon: { name: null, tint: 'bronze', stage: 'egg', neutralised: 0, available: 6, next_stage_at: 1, unlocked_tints: ['bronze'] },
    lieutenants: [],
    quests: [],
    oracle: { week: '2026-W39', status: 'sealed', reward_id: null },
    prophecies: [],
    weekly: { week: '2026-W39', target: 3, done: 0, reached: false },
    boss: { tier_available: null, tiers_won: [], active_quest_id: null },
    rewards_count: 0,
    small_tricks: { traps: 0, caught: 0 },
    ...over,
  };
}
const catalog = {
  boss_rewards: { '1': 'sandales' },
  rewards: { sandales: { id: 'sandales', kind: 'gear', name: "Sandales d'Hermès", desc: '', source: '' } },
} as unknown as WorldCatalog;
const state = (id: string, c: CampResponse | null, cat: WorldCatalog | null = null) =>
  CAMP_HOTSPOTS.find((h) => h.id === id)!.state({ camp: c, catalog: cat });

describe('camp hub scene', () => {
  it('is a valid scene: safe zone, HUD band, dialogue dock, no overlaps', () => {
    expect(validateScene(CAMP_SCENE)).toEqual([]);
  });

  it('routes every place to its existing screen', () => {
    expect(Object.fromEntries(CAMP_HOTSPOTS.map((h) => [h.id, h.target]))).toEqual({
      dragon: 'dragon',
      oracle: 'oracle',
      quests: 'quests',
      parchemins: 'library',
      dossier: 'dossier',
      bestiary: 'bestiaire',
      cabin: 'cabin',
      boss: 'boss',
    });
  });

  it('shows every place but the battle path before /camp has loaded', () => {
    for (const h of CAMP_HOTSPOTS) expect(h.state({ camp: null, catalog: null }).visible, h.id).toBe(h.id !== 'boss');
  });

  it('captions the dragon with its name, or its stage before it is named', () => {
    expect(dragonCaption(camp().dragon)).toBe('Un œuf de dragon');
    expect(dragonCaption({ ...camp().dragon, stage: 'hatchling' })).toBe('Dragonnet');
    expect(state('dragon', camp({ dragon: { ...camp().dragon, stage: 'hatchling', name: 'Braise' } })).caption).toBe('Braise');
  });

  it('marks the sealed Oracle as new, counts active quests, counts neutralised tricks', () => {
    expect(state('oracle', camp())).toMatchObject({ isNew: true, caption: 'Trois rouleaux scellés' });
    expect(state('oracle', camp({ oracle: { week: 'w', status: 'chosen', reward_id: null } }))).toMatchObject({
      isNew: false,
      caption: 'Quête en cours',
    });
    const quests = [
      { id: 1, kind: 'board', status: 'active' },
      { id: 2, kind: 'oracle', status: 'active' },
      { id: 3, kind: 'board', status: 'done' },
    ] as QuestOut[];
    expect(state('quests', camp({ quests })).badge).toBe(2);
    expect(state('quests', camp()).badge).toBeNull();
    const lieutenants = [
      { neutralised: true, available: true },
      { neutralised: false, available: true },
      { neutralised: false, available: false },
    ] as LieutenantState[];
    expect(state('bestiary', camp({ lieutenants })).caption).toBe('1 / 2 ruses neutralisées · les vrais mythes');
    expect(state('cabin', camp({ rewards_count: 3 })).caption).toBe('3 trésor(s)');
  });

  it('opens the battle path only when Éris can be fought, naming the reward known in advance', () => {
    expect(state('boss', camp()).visible).toBe(false);
    const ready = camp({ boss: { tier_available: 1, tiers_won: [], active_quest_id: null } });
    expect(state('boss', ready, catalog)).toMatchObject({ visible: true, isNew: true, caption: "Combat 1 : Sandales d'Hermès" });
    expect(state('boss', ready, null).caption).toBe('Combat 1 : une récompense');
    const engaged = camp({
      boss: { tier_available: 1, tiers_won: [], active_quest_id: 9 },
      quests: [{ id: 9, kind: 'boss', status: 'active' }] as QuestOut[],
    });
    expect(state('boss', engaged, catalog)).toMatchObject({ visible: true, isNew: false, caption: 'Un combat est déjà engagé contre Éris.' });
  });

  it('greets with two static dragon lines', () => {
    const lines = campGreeting('Ariane', camp());
    expect(lines.map((l) => l.text)).toEqual([
      'Bienvenue au camp, Ariane.',
      "L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.",
    ]);
    expect(lines[0]).toMatchObject({ speaker: 'dragon', name: "L'œuf", portrait: '/art/dragon/dragon_egg_cut.webp', portraitFilter: 'none' });
  });
});
