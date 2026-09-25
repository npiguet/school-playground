import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, QuestOut } from '../types';
import { DELPHI_HOTSPOTS, DELPHI_SCENE, PYTHIA_LAYER, pythiaGreeting, scrollTitle } from './delphi';

function camp(over: Partial<CampResponse> = {}): CampResponse {
  return {
    oracle: { week: 'w', status: 'sealed', reward_id: null },
    quests: [],
    ...over,
  } as CampResponse;
}
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

  it('seats the Pythia on the painted tripod', () => {
    expect(PYTHIA_LAYER).toMatchObject({ src: '/art/characters/pythia_cut.webp', x: 32.5, y: 77, scale: 16 });
  });

  it('glows on the Pythia while the week is sealed; counts active quests on the tablets', () => {
    expect(state('pythia', camp())).toMatchObject({ isNew: true, caption: 'Trois rouleaux scellés' });
    expect(state('pythia', camp({ oracle: { week: 'w', status: 'chosen', reward_id: null } }))).toMatchObject({ isNew: false, caption: 'Quête en cours' });
    const quests = [{ status: 'active' }, { status: 'active' }, { status: 'done' }] as QuestOut[];
    expect(state('tablets', camp({ quests })).badge).toBe(2);
    expect(state('tablets', camp()).badge).toBeNull();
  });

  it('lets the Pythia greet with one static line', () => {
    expect(pythiaGreeting(camp()).map((l) => l.text)).toEqual(["Approche, héros. Trois rouleaux scellés t'attendent cette semaine."]);
    expect(pythiaGreeting(camp({ oracle: { week: 'w', status: 'chosen', reward_id: null } })).map((l) => l.text)).toEqual([
      "La quête de la semaine est choisie. L'Oracle parlera de nouveau lundi.",
    ]);
    expect(pythiaGreeting(camp())[0]).toMatchObject({ speaker: 'pythia', name: 'La Pythie', portrait: '/art/characters/pythia_cut.webp' });
  });

  it('relabels the « école » scroll client-side (carry #13)', () => {
    expect(scrollTitle('ecole', "Ce qui arrive à l'école")).toBe('Ce que prépare ta classe');
    expect(scrollTitle('faible', 'Le point faible')).toBe('Le point faible');
  });
});
