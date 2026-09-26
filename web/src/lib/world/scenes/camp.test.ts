import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, LieutenantState, QuestOut, WorldCatalog } from '../types';
import { nextStep, HUB_PLACE } from '../nextStep';
import { prophecyWhen } from '../prophecy';
import {
  CAMP_HOTSPOTS,
  CAMP_SCENE,
  bossLockLine,
  campDragonLayer,
  campGreeting,
  campNews,
  bossLockCaption,
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
const state = (id: string, c: CampResponse | null, cat: WorldCatalog | null = null) => CAMP_HOTSPOTS.find((h) => h.id === id)!.state({ camp: c, catalog: cat });
const ready = (over: Partial<CampResponse> = {}) => camp({ boss: { tier_available: 1, tiers_won: [], active_quest_id: null }, ...over });
const seasoned = { total: 40, rank: 1, title: 'Recrue du camp', next_threshold: 150, rank_floor: 0 };
const chosen = { week: 'w', status: 'chosen' as const, reward_id: null };
const hatchling = { ...camp().dragon, stage: 'hatchling' as const };
const echoStirs = [{ key: 'echo', name: 'Écho', stirring: true, neutralised: false, available: true }] as LieutenantState[];
const prophecy = (days: number) => [{ text_id: 1, title: 'La mer', due_date: '2026-09-27', days_left: days }];

describe('the hub on hub_camp.webp (UI3 Ruling B3)', () => {
  it('is a valid scene with the six places of the painted camp, each pinned to its landmark', () => {
    expect(validateScene(CAMP_SCENE)).toEqual([]);
    expect(CAMP_SCENE).toMatchObject({ title: 'Le camp', background: '/art/scenes/hub_camp.webp' });
    expect(Object.fromEntries(CAMP_HOTSPOTS.map((h) => [h.id, h.target]))).toEqual({
      dragon: 'dragon',
      oracle: 'delphi',
      parchemins: 'library-tent',
      dossier: 'war-tent',
      cabin: 'cabin',
      boss: 'boss',
    });
    for (const h of CAMP_HOTSPOTS) expect(h.leader === true || h.labelPos === 'on', h.id).toBe(true);
    expect(CAMP_HOTSPOTS.find((h) => h.id === 'cabin')!.labelPos).toBe('on');
  });

  it('always shows the path to battle, locked until Éris can be fought', () => {
    for (const h of CAMP_HOTSPOTS) expect(h.state({ camp: null, catalog: null }).visible, h.id).toBe(true);
    expect(state('boss', null).locked).toBe(true);
    // Final review M12: the lock says how to get past it without a tap.
    expect(state('boss', camp())).toMatchObject({ locked: true, caption: 'Encore 2 ruses', isNew: false });
    // Final review M10: the fight's number as the battle screen writes it (Roman).
    expect(state('boss', ready(), catalog)).toMatchObject({ locked: false, isNew: true, caption: "Combat I : Sandales d'Hermès" });
    expect(state('boss', ready(), null).caption).toBe('Combat I : une récompense');
  });

  it("explains the locked path in the dragon's words", () => {
    expect(bossLockLine(camp())).toBe('Éris se cache encore. Neutralise encore 2 ruses et elle sortira.');
    expect(bossLockLine(camp({ dragon: { ...camp().dragon, neutralised: 1 } }))).toBe('Éris se cache encore. Neutralise encore une ruse et elle sortira.');
    expect(bossLockLine(camp({ boss: { tier_available: null, tiers_won: [1, 2, 3], active_quest_id: null } }))).toBe('Éris est vaincue trois fois. Elle boude, loin du camp.');
    expect(bossLockCaption(camp({ dragon: { ...camp().dragon, neutralised: 1 } }))).toBe('Encore 1 ruse');
    expect(bossLockCaption(camp({ boss: { tier_available: null, tiers_won: [1, 2, 3], active_quest_id: null } }))).toBe('Éris boude, loin du camp');
  });

  it('captions only the places with news, three at most, in priority order', () => {
    expect(campNews(camp({ xp: seasoned, oracle: chosen }), null)).toEqual({});
    const busy = ready({ xp: seasoned, prophecies: prophecy(2), dragon: hatchling, lieutenants: echoStirs });
    expect(campNews(busy, catalog)).toEqual({ boss: "Combat I : Sandales d'Hermès", oracle: `Une prophétie, ${prophecyWhen(2)}`, dragon: 'Il attend un nom' });
    expect(state('dossier', busy, catalog).caption).toBeNull();
    expect(campNews(camp({ xp: seasoned, dragon: hatchling, lieutenants: echoStirs }), null)).toEqual({
      oracle: 'Trois rouleaux à ouvrir',
      dragon: 'Il attend un nom',
      dossier: "Écho s'agite",
    });
    expect(campNews(camp(), null)).toEqual({ oracle: 'Trois rouleaux à ouvrir', parchemins: 'Choisis un texte à défendre' });
  });

  it('glows on at most one place: the one the shared next step names (Ruling B9)', () => {
    const cases = [camp(), ready(), camp({ xp: seasoned, prophecies: prophecy(3), oracle: chosen }), camp({ xp: seasoned }), camp({ xp: seasoned, oracle: chosen })];
    for (const c of cases) {
      const glowing = CAMP_HOTSPOTS.filter((h) => h.state({ camp: c, catalog }).isNew).map((h) => h.id);
      const step = nextStep(c);
      expect(glowing).toEqual(step ? [HUB_PLACE[step]] : []);
    }
  });

  it('carries the quest count on the Delphi plaque and the foiled tricks on the war-tent plaque', () => {
    const quests = [{ status: 'active' }, { status: 'active' }, { status: 'done' }] as QuestOut[];
    expect(state('oracle', camp({ quests })).badge).toBe(2);
    expect(state('oracle', camp()).badge).toBeNull();
    const lieutenants = [{ key: 'hydre', neutralised: true }, { key: 'echo', neutralised: false }] as LieutenantState[];
    expect(state('dossier', camp({ lieutenants })).badge).toBe(1);
    expect(state('dossier', camp()).badge).toBeNull();
  });

  it('greets with three static dragon lines, the last one naming the next step', () => {
    const lines = campGreeting('Ariane', camp());
    expect(lines.map((l) => l.text)).toEqual([
      'Bienvenue au camp, Ariane.',
      "L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.",
      "Les parchemins t'attendent, sous la tente.",
    ]);
    expect(lines[0]).toMatchObject({ speaker: 'dragon', name: "L'œuf", portrait: '/art/dragon/dragon_egg_cut.webp', portraitFilter: 'none' });
  });

  it('seats the dragon in the painted nest, on a shallow plane; preloads every place it leads to', () => {
    expect(campDragonLayer('egg')).toMatchObject({ x: 17, y: 55, depth: 1 });
    expect(campDragonLayer('adult').scale).toBeGreaterThan(campDragonLayer('egg').scale);
    // Final review M14: none of the hub's destinations loads cold on its first tap.
    expect(CAMP_SCENE.preload).toEqual([
      '/art/scenes/library_tent.webp',
      '/art/scenes/delphi.webp',
      '/art/scenes/war_tent.webp',
      '/art/scenes/nest.webp',
      '/art/scenes/cabin.webp',
      '/art/scenes/battle.webp',
    ]);
  });

  it('keeps the words the other places use', () => {
    expect(weeklyCaption({ week: 'w', target: 3, done: 1, reached: false })).toBe('Cette semaine : 1 / 3 parchemins défendus');
    expect(weeklyCaption({ week: 'w', target: 3, done: 3, reached: true })).toBe('Objectif atteint ! Les Muses sont fières.');
  });
});
