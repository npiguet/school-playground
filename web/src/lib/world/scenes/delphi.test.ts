import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, QuestOut } from '../types';
import { DELPHI_HOTSPOTS, DELPHI_SCENE, PYTHIA_LAYER, pythiaGreeting, scrollTitle } from './delphi';

function camp(over: Partial<CampResponse> = {}): CampResponse {
  return {
    xp: { total: 40 },
    oracle: { week: 'w', status: 'sealed', reward_id: null },
    quests: [],
    prophecies: [],
    boss: { tier_available: null, tiers_won: [], active_quest_id: null },
    ...over,
  } as CampResponse;
}
const chosen = { week: 'w', status: 'chosen', reward_id: null } as const;
const soon = [{ text_id: 1, title: 'La mer', due_date: '2026-09-28', days_left: 2 }];
const state = (id: string, c: CampResponse | null) => DELPHI_HOTSPOTS.find((h) => h.id === id)!.state({ camp: c, catalog: null });

describe('Delphi (UI3 Ruling A1, A10)', () => {
  it('is a valid scene: the Pythia and the votive-tablet wall', () => {
    expect(validateScene(DELPHI_SCENE)).toEqual([]);
    expect(DELPHI_SCENE).toMatchObject({ id: 'delphi', title: 'Le temple de Delphes', background: '/art/scenes/delphi.webp' });
    expect(DELPHI_HOTSPOTS.map((h) => [h.id, h.target])).toEqual([
      ['pythia', 'oracle'],
      ['tablets', 'quests'],
    ]);
  });

  it('preloads the camp, its only way out (final review M8)', () => {
    expect(DELPHI_SCENE.preload).toEqual(['/art/scenes/camp.webp']);
  });

  it('seats the Pythia on the painted tripod', () => {
    expect(PYTHIA_LAYER).toMatchObject({ src: '/art/characters/pythia_cut.webp', x: 32.5, y: 77, scale: 16 });
  });

  it('glows on the Pythia only when the next step is hers (Ruling B9); counts active quests on the tablets', () => {
    expect(state('pythia', camp())).toMatchObject({ isNew: true, caption: 'Trois rouleaux à ouvrir' });
    expect(state('pythia', camp({ oracle: chosen }))).toMatchObject({ isNew: false, caption: 'Quête en cours' });
    // A new hero's next step is the tent; an open battle outranks the scrolls.
    expect(state('pythia', camp({ xp: { total: 0 } as CampResponse['xp'] }))).toMatchObject({ isNew: false, caption: 'Trois rouleaux à ouvrir' });
    expect(state('pythia', camp({ boss: { tier_available: 1, tiers_won: [], active_quest_id: null } })).isNew).toBe(false);
    // A prophecy within a week comes first, the week chosen or not, even for a new hero.
    expect(state('pythia', camp({ oracle: chosen, prophecies: soon }))).toMatchObject({ isNew: true, caption: 'Quête en cours' });
    expect(state('pythia', camp({ xp: { total: 0 } as CampResponse['xp'], prophecies: soon })).isNew).toBe(true);
    const quests = [{ status: 'active' }, { status: 'active' }, { status: 'done' }] as QuestOut[];
    expect(state('tablets', camp({ quests })).badge).toBe(2);
    expect(state('tablets', camp()).badge).toBeNull();
  });

  it('lets the Pythia greet with one static line', () => {
    expect(pythiaGreeting(camp()).map((l) => l.text)).toEqual(["Approche. Trois rouleaux scellés t'attendent cette semaine."]);
    expect(pythiaGreeting(camp({ oracle: { week: 'w', status: 'chosen', reward_id: null } })).map((l) => l.text)).toEqual([
      "La quête de la semaine est choisie. L'Oracle parlera de nouveau lundi.",
    ]);
    expect(pythiaGreeting(camp())[0]).toMatchObject({ speaker: 'pythia', name: 'La Pythie', portrait: '/art/characters/pythia_cut.webp' });
  });

  it('hangs the tablets plaque on the wall, not on the altar (playability #16)', () => {
    expect(DELPHI_HOTSPOTS.find((h) => h.id === 'tablets')!.labelPos).toBe('above');
  });

  it('relabels the « école » scroll client-side (carry #13)', () => {
    expect(scrollTitle('ecole', "Ce qui arrive à l'école")).toBe('Ce que prépare ta classe');
    expect(scrollTitle('faible', 'Le point faible')).toBe('Le point faible');
  });
});
