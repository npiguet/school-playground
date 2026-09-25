import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, LieutenantState, QuestOut, WorldCatalog } from '../types';
import {
  CAMP_DRAGON_LAYER,
  CAMP_HOTSPOTS,
  CAMP_SCENE,
  bestiaryCaption,
  campGreeting,
  dragonCaption,
  nearestProphecy,
  nextStepLine,
  prophecyWhen,
  treasureCaption,
  weeklyCaption,
} from './camp';

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
      oracle: 'delphi',
      quests: 'quests',
      parchemins: 'library-tent',
      dossier: 'dossier',
      bestiary: 'bestiaire',
      cabin: 'cabin',
      boss: 'boss',
    });
  });

  it('shows every place but the battle path before /camp has loaded', () => {
    for (const h of CAMP_HOTSPOTS) expect(h.state({ camp: null, catalog: null }).visible, h.id).toBe(h.id !== 'boss');
  });

  it('captions the dragon with its name, or its stage before it is named, plus its short ambient activity', () => {
    expect(dragonCaption(camp().dragon)).toBe('Un œuf de dragon');
    expect(dragonCaption({ ...camp().dragon, stage: 'hatchling' })).toBe('Dragonnet');
    expect(state('dragon', camp()).caption).toBe('Un œuf de dragon · Frémit');
    expect(state('dragon', camp({ dragon: { ...camp().dragon, stage: 'hatchling', name: 'Braise' } })).caption).toBe(
      'Braise · Curieux',
    );
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
    expect(state('bestiary', camp({ lieutenants })).caption).toBe("1 ruse d'Éris déjouée");
    expect(state('cabin', camp({ rewards_count: 3 })).caption).toBe('3 trésors');
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

  it('greets with three static dragon lines, the last one pointing at the next step', () => {
    const lines = campGreeting('Ariane', camp());
    expect(lines.map((l) => l.text)).toEqual([
      'Bienvenue au camp, Ariane.',
      "L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.",
      "Les parchemins t'attendent, sous la tente.",
    ]);
    expect(lines[0]).toMatchObject({ speaker: 'dragon', name: "L'œuf", portrait: '/art/dragon/dragon_egg_cut.webp', portraitFilter: 'none' });
  });
});

describe('camp hub wording (playability #2, #6, #16)', () => {
  it('pluralises the treasures and the foiled tricks properly', () => {
    expect([0, 1, 2].map(treasureCaption)).toEqual(['Aucun trésor encore', '1 trésor', '2 trésors']);
    expect([0, 1, 2].map(bestiaryCaption)).toEqual(["Les ruses d'Éris t'attendent", "1 ruse d'Éris déjouée", "2 ruses d'Éris déjouées"]);
  });

  it('says when a prophecy falls due in words', () => {
    expect([0, 1, 3].map(prophecyWhen)).toEqual(["aujourd'hui", 'demain', 'dans 3 jours']);
  });

  it('shows the weekly goal as parchments defended', () => {
    expect(weeklyCaption({ week: 'w', target: 3, done: 1, reached: false })).toBe('Cette semaine : 1 / 3 parchemins défendus');
    expect(weeklyCaption({ week: 'w', target: 3, done: 3, reached: true })).toBe('Objectif atteint ! Les Muses sont fières.');
  });

  it('points the new hero at the parchments tent, with a caption and the new glow', () => {
    expect(state('parchemins', camp())).toMatchObject({ caption: 'Choisis un texte à défendre', isNew: true });
    expect(state('parchemins', camp({ xp: { total: 40, rank: 1, title: 'Recrue du camp', next_threshold: 150, rank_floor: 0 } })).isNew).toBe(false);
  });

  it('ends the greeting on the next step: a near prophecy, else a ready battle, else the tent', () => {
    const prophecies = [
      { text_id: 2, title: 'Les fées', due_date: '2026-10-01', days_left: 7 },
      { text_id: 1, title: 'La mer', due_date: '2026-09-27', days_left: 3 },
    ];
    expect(nearestProphecy(camp({ prophecies }))?.title).toBe('La mer');
    expect(nextStepLine(camp({ prophecies }))).toBe('La Pythie a vu ta prochaine épreuve, dans 3 jours. Viens la réviser !');
    const ready = camp({ boss: { tier_available: 1, tiers_won: [], active_quest_id: null } });
    expect(nextStepLine(ready)).toBe("Le sentier de la bataille est ouvert : Éris t'attend.");
    expect(nextStepLine(camp())).toBe("Les parchemins t'attendent, sous la tente.");
  });

  it('keeps the dragon cut-out on a shallow parallax plane and preloads the likely next scenes', () => {
    expect(CAMP_DRAGON_LAYER.depth).toBeLessThanOrEqual(1);
    expect(CAMP_SCENE.preload).toEqual(['/art/scenes/library_tent.webp', '/art/scenes/delphi.webp']);
  });
});
