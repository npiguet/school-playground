import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import { DRAGON_STAGES, type CampResponse, type LieutenantState, type QuestOut, type WorldCatalog } from '../types';
import { nextStep, HUB_PLACE } from '../nextStep';
import { prophecyWhen } from '../prophecy';
import { variantsOf } from '../../../testing/dialogue';
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
import { CAMP_SHAPES } from './camp.shapes';

function camp(over: Partial<CampResponse> = {}): CampResponse {
  return {
    profile: { id: 7, name: 'Ariane' } as CampResponse['profile'],
    xp: { total: 0, floor: 0, next: 100 },
    dragon: { name: null, tint: 'bronze', stage: 'egg', unlocked_tints: ['bronze'], worn: [] },
    lieutenants: [],
    quests: [],
    oracle: { week: '2026-W39', status: 'sealed', reward_id: null },
    prophecies: [],
    weekly: { week: '2026-W39', target: 3, done: 0, reached: false },
    boss: { tier_available: null, tiers_won: [], active_quest_id: null, fights: 10, next: { tier: 1, level: 1, missing: 2 } },
    rewards_count: 0,
    small_tricks: { traps: 0, caught: 0 },
    drachmes: 0,
    house: 'cabin',
    affordable: 0,
    ...over,
  };
}
const catalog = {
  boss_rewards: { '1': 'sandales' },
  rewards: { sandales: { id: 'sandales', kind: 'gear', name: "Sandales d'Hermès", desc: '', source: '' } },
} as unknown as WorldCatalog;
const state = (id: string, c: CampResponse | null, cat: WorldCatalog | null = null) => CAMP_HOTSPOTS.find((h) => h.id === id)!.state({ camp: c, catalog: cat });
const ready = (over: Partial<CampResponse> = {}) => camp({ boss: { tier_available: 1, tiers_won: [], active_quest_id: null, fights: 10, next: null }, ...over });
const seasoned = { total: 40, floor: 0, next: 100 };
const chosen = { week: 'w', status: 'chosen' as const, reward_id: null };
const hatchling = { ...camp().dragon, stage: 'hatchling' as const };
const prophecy = (days: number) => [{ text_id: 1, title: 'La mer', due_date: '2026-09-27', days_left: days }];

describe('the hub on hub_camp.webp (UI3 Ruling B3)', () => {
  it('is a valid scene with the six places of the painted camp and the stall, each pinned to its landmark', () => {
    expect(validateScene(CAMP_SCENE)).toEqual([]);
    expect(CAMP_SCENE).toMatchObject({ title: 'Le camp', background: '/art/scenes/hub_camp.webp' });
    expect(Object.fromEntries(CAMP_HOTSPOTS.map((h) => [h.id, h.target]))).toEqual({
      dragon: 'dragon',
      oracle: 'delphi',
      parchemins: 'library-tent',
      dossier: 'war-tent',
      cabin: 'cabin',
      boss: 'boss',
      stall: 'camp',
    });
    // UI3b playability #8: every place, the cabin too, has the same dark plaque pinned by a leader
    // (Hermès's stall is not a place: its name is inked on its counter, Task 5 review I1).
    for (const h of CAMP_HOTSPOTS) expect([h.labelPos, h.leader], h.id).toEqual(h.id === 'stall' ? ['on', undefined] : ['below', true]);
    // Playability #10: the battle path's plaque slides right, off the war tent's peak; the temple's
    // slides right off the stall (Task 5 review I1).
    expect(CAMP_HOTSPOTS.find((h) => h.id === 'boss')!.labelDx).toBeGreaterThan(0);
    expect(CAMP_HOTSPOTS.find((h) => h.id === 'oracle')!.labelDx).toBe(35);
  });

  it("puts Hermès's stall on its painted box, inside the safe zone, above the dragon (spec 2026-09-29 drachmes §2, R18)", () => {
    const stall = CAMP_HOTSPOTS.find((h) => h.id === 'stall')!;
    expect(stall).toMatchObject({ label: "L'étal d'Hermès", target: 'camp', query: { panel: 'etal' }, labelPos: 'on' });
    expect(CAMP_SHAPES.stall).toEqual({ kind: 'polygon', points: [[12.5, 21], [21.8, 21], [21.8, 40], [12.5, 40]] });
    // The temple keeps its whole painted box, its left wall included (Task 5 review I1).
    expect(CAMP_SHAPES.oracle.points[0]).toEqual([22.5, 14]);
    expect(validateScene(CAMP_SCENE)).toEqual([]);
    // No caption and no glow of its own: nothing at the stall ever calls the player in.
    for (const c of [camp(), ready({ xp: seasoned }), camp({ drachmes: 900 })]) expect(state('stall', c, catalog)).toMatchObject({ caption: null, isNew: false });
  });

  it('names the house on the camp\'s plaque (spec 2026-09-29 drachmes §3, R22)', () => {
    const cabin = CAMP_HOTSPOTS.find((h) => h.id === 'cabin')!;
    expect(cabin.label).toBe('Ta cabane');
    expect(cabin.state({ camp: null, catalog: null }).label).toBeNull();
    for (const [house, name] of [['cabin', 'Ta cabane'], ['villa', 'Ta villa'], ['palais', 'Ton palais']] as const) {
      expect(cabin.state({ camp: { ...camp(), house }, catalog: null }).label).toBe(name);
    }
  });

  it('always shows the path to battle, locked until Éris can be fought', () => {
    for (const h of CAMP_HOTSPOTS) expect(h.state({ camp: null, catalog: null }).visible, h.id).toBe(true);
    expect(state('boss', null).locked).toBe(true);
    // Final review M12: the lock says how to get past it without a tap.
    expect(state('boss', camp())).toMatchObject({ locked: true, caption: "Encore deux sceaux de bois et Éris t'attend.", isNew: false });
    // Final review M10: the fight's number as the battle screen writes it (Roman).
    expect(state('boss', ready(), catalog)).toMatchObject({ locked: false, isNew: true, caption: "Combat I\u202f: Sandales d'Hermès" });
    expect(state('boss', ready(), null).caption).toBe('Combat I\u202f: une récompense');
  });

  it("says what opens the next fight in words, on the plaque and in the dragon's mouth (spec §4, R9)", () => {
    const c = camp({ boss: { tier_available: null, tiers_won: [], active_quest_id: null, fights: 10, next: { tier: 1, level: 1, missing: 2 } } });
    expect(bossLockCaption(c)).toBe("Encore deux sceaux de bois et Éris t'attend.");
    expect(bossLockLine(c)).toBe("Encore deux sceaux de bois et Éris t'attend.");
    const done = camp({ boss: { tier_available: null, tiers_won: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], active_quest_id: null, fights: 10, next: null } });
    expect(bossLockCaption(done)).toBe('Éris boude, loin du camp');
    expect(bossLockLine(done)).toBe('Éris est vaincue à chaque combat. Elle boude, loin du camp.');
  });

  it('a fight past the third shows its XP and drachmes on the plaque (Combat IV)', () => {
    const fourth = camp({ boss: { tier_available: 4, tiers_won: [1, 2, 3], active_quest_id: null, fights: 10, next: null } });
    expect(state('boss', fourth, { ...catalog, quest_bonus: { boss: 300 } } as WorldCatalog).caption).toBe('Combat IV\u202f: 300 XP et 30 drachmes');
  });

  it('captions only the places with news, three at most, in priority order', () => {
    const won = { tier_available: null, tiers_won: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], active_quest_id: null, fights: 10, next: null };
    expect(campNews(camp({ xp: seasoned, oracle: chosen, boss: won }), null)).toEqual({ boss: 'Éris boude, loin du camp' });
    // Ruling B-d: the battle's news comes first, an open fight's as a locked path's; the fourth news
    // (the dragon's name) is the one left out.
    const open = campNews(ready({ dragon: hatchling }), catalog);
    expect(Object.keys(open)).toEqual(['boss', 'oracle', 'parchemins']);
    expect(open.boss).toBe("Combat I\u202f: Sandales d'Hermès");
    expect(campNews(camp({ dragon: hatchling }), null)).toEqual({
      boss: "Encore deux sceaux de bois et Éris t'attend.",
      oracle: 'Trois rouleaux à ouvrir',
      parchemins: 'Choisis un texte à défendre',
    });
    const busy = ready({ xp: seasoned, prophecies: prophecy(2), dragon: hatchling });
    expect(campNews(busy, catalog)).toEqual({ boss: "Combat I\u202f: Sandales d'Hermès", oracle: `Une prophétie, ${prophecyWhen(2)}`, dragon: 'Il attend un nom' });
    expect(state('dossier', busy, catalog).caption).toBeNull();
    expect(campNews(camp({ xp: seasoned, boss: won, dragon: hatchling }), null)).toEqual({
      boss: 'Éris boude, loin du camp',
      oracle: 'Trois rouleaux à ouvrir',
      dragon: 'Il attend un nom',
    });
    expect(campNews(camp(), null)).toEqual({ boss: "Encore deux sceaux de bois et Éris t'attend.", oracle: 'Trois rouleaux à ouvrir', parchemins: 'Choisis un texte à défendre' });
  });

  it('glows on at most one place: the one the shared next step names (Ruling B9)', () => {
    const cases = [camp(), ready(), camp({ xp: seasoned, prophecies: prophecy(3), oracle: chosen }), camp({ xp: seasoned }), camp({ xp: seasoned, oracle: chosen })];
    for (const c of cases) {
      const glowing = CAMP_HOTSPOTS.filter((h) => h.state({ camp: c, catalog }).isNew).map((h) => h.id);
      const step = nextStep(c);
      expect(glowing).toEqual(step ? [HUB_PLACE[step]] : []);
    }
  });

  it('carries the quest count on the Delphi plaque, the seals won on the war-tent plaque (spec 2026-09-29 lieutenant levels R14)', () => {
    const quests = [{ status: 'active' }, { status: 'active' }, { status: 'done' }] as QuestOut[];
    expect(state('oracle', camp({ quests })).badge).toBe(2);
    expect(state('oracle', camp()).badge).toBeNull();
    // UI3b playability #17: the coin means « something waits »; what is won is a seal.
    const lieutenants = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'].map((key, i) => ({ key, level: [2, 0, 1, 0, 0, 0][i] })) as LieutenantState[];
    expect(state('dossier', camp({ lieutenants }))).toMatchObject({ badge: null, seals: 3 });
    expect(state('dossier', camp())).toMatchObject({ badge: null, seals: 0 });
  });

  it('greets with her name, the dragon\'s stage, then the next step, from the content (Ruling E12)', () => {
    const lines = campGreeting('Ariane', camp());
    expect(lines.map((l) => l.key)).toEqual(['camp.enter', undefined, 'camp.next.first-text']);
    expect(variantsOf('camp.enter', { hero: 'Ariane' })).toContain(lines[0].text);
    // UI5 playability #12: after the greeting, the stage line says no second hello.
    expect(lines[1].text).toBe("Chaque piège d'Éris déjoué me fait frémir dans ma coquille.");
    expect(variantsOf('camp.next.first-text')).toContain(lines[2].text);
    expect(lines[0]).toMatchObject({ key: 'camp.enter', speaker: 'dragon', name: "L'œuf", portrait: '/art/dragon/dragon_egg_cut.webp', portraitFilter: 'none' });
  });

  it('praises the week\'s goal when it is reached, and names a prophecy\'s day', () => {
    const lines = campGreeting('Ariane', camp({ weekly: { week: 'w', target: 3, done: 3, reached: true }, prophecies: prophecy(2) }));
    expect(lines.map((l) => l.key)).toEqual(['camp.enter', undefined, 'camp.weekly', 'camp.next.prophecy']);
    expect(variantsOf('camp.weekly')).toContain(lines[2].text);
    expect(variantsOf('camp.next.prophecy', { when: prophecyWhen(2) })).toContain(lines[3].text);
    expect(campGreeting('Ariane', camp({ xp: seasoned, oracle: chosen, weekly: { week: 'w', target: 3, done: 3, reached: true } })).at(-1)!.key).toBe('camp.next.none');
  });

  // Spec 2026-09-29 explanations §1, R7: the line never repeats the greeting's content.
  it('never repeats itself: the name or the stage said as the next goal replaces the stage line', () => {
    const week = { week: 'w', target: 3, done: 3, reached: true };
    const close = camp({ weekly: week, xp: { total: 1150, floor: 100, next: 1200 }, dragon: { ...camp().dragon, stage: 'hatchling', name: 'Braise' } });
    expect(campGreeting('Ariane', close).map((l) => l.key)).toEqual(['camp.enter', 'camp.weekly', 'camp.next.stage']);
    const unnamed = camp({ weekly: week, xp: { total: 300, floor: 100, next: 1200 }, dragon: { ...camp().dragon, stage: 'hatchling', name: null } });
    expect(campGreeting('Ariane', unnamed).map((l) => l.key)).toEqual(['camp.enter', 'camp.weekly', 'camp.next.name']);
    const calm = camp({ weekly: week, oracle: chosen, xp: { total: 300, floor: 100, next: 1200 }, dragon: { ...camp().dragon, stage: 'hatchling', name: 'Braise' } });
    const lines = campGreeting('Ariane', calm);
    expect(lines.map((l) => l.key)).toEqual(['camp.enter', undefined, 'camp.weekly', 'camp.next.none']);
    expect(new Set(lines.map((l) => l.text)).size).toBe(lines.length);
  });

  it('speaks the seal line with its lieutenant and its seal', () => {
    const next = { level: 2, days: 3, chances: 18, correct: 0.9, complete: false, need: { days: 4, chances: 25, correct: 0.88 } };
    const lieutenants = [{ key: 'sirenes', name: 'Les Sirènes', available: true, level: 1, next }] as unknown as LieutenantState[];
    const last = campGreeting('Ariane', camp({ lieutenants, xp: { total: 300, floor: 100, next: 1200 } })).at(-1)!;
    expect(last.key).toBe('camp.next.seal');
    expect(variantsOf('camp.next.seal', { lieutenant: 'les Sirènes', seal: 'sceau de bronze' })).toContain(last.text);
    expect(last.text).toMatch(/Sirènes (auront|\.)|contre les Sirènes/);
  });

  it('seats the dragon in the painted nest, on a shallow plane; preloads every place it leads to', () => {
    expect(campDragonLayer('egg')).toMatchObject({ x: 17, y: 55, depth: 1 });
    const widths = DRAGON_STAGES.map((s) => campDragonLayer(s).scale);
    expect(widths.every((w, i) => i === 0 || w > widths[i - 1]), 'bigger at every stage').toBe(true);
    // Final review M14: none of the hub's destinations loads cold on its first tap.
    expect(CAMP_SCENE.preload).toEqual([
      '/art/scenes/library_tent.webp',
      '/art/scenes/delphi.webp',
      '/art/scenes/war_tent.webp',
      '/art/scenes/nest.webp',
      '/art/scenes/cabin.webp',
      '/art/scenes/eris_lair.webp',
    ]);
  });

  it('keeps the words the other places use', () => {
    expect(weeklyCaption({ week: 'w', target: 3, done: 1, reached: false })).toBe('Cette semaine\u202f: 1 / 3 parchemins défendus');
    expect(weeklyCaption({ week: 'w', target: 3, done: 3, reached: true })).toBe('Objectif atteint\u202f! Les Muses sont fières.');
  });
});
