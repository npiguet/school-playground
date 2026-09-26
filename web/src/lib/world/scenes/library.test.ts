import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import { variantsOf } from '../../../testing/dialogue';
import type { CampResponse } from '../types';
import { LIBRARY_HOTSPOTS, LIBRARY_SCENE, OWL_LAYER, owlGreeting, owlHint } from './library';

const state = (id: string, camp: Partial<CampResponse> | null) =>
  LIBRARY_HOTSPOTS.find((h) => h.id === id)!.state({ camp: camp as CampResponse | null, catalog: null });

describe('library tent (UI3 Ruling A1, A16)', () => {
  it('is a valid scene with the plaque echoing the hub label', () => {
    expect(validateScene(LIBRARY_SCENE)).toEqual([]);
    expect(LIBRARY_SCENE).toMatchObject({ id: 'library', title: 'La tente des parchemins', background: '/art/scenes/library_tent.webp' });
  });

  it('preloads the hub, its only way out (final review M8)', () => {
    expect(LIBRARY_SCENE.preload).toEqual(['/art/scenes/hub_camp.webp']);
  });

  it('routes its four objects to the legacy routes, pinned to their landmarks; the owl handles her own tap', () => {
    expect(LIBRARY_HOTSPOTS.map((h) => [h.id, h.target])).toEqual([
      ['shelves', 'library'],
      ['desk', 'text-new'],
      ['lens', 'text-scan'],
      ['portal', 'alexandria'],
      ['owl', null],
    ]);
    for (const h of LIBRARY_HOTSPOTS.slice(0, 4)) expect(h.leader, h.id).toBe(true);
    expect(LIBRARY_HOTSPOTS.slice(0, 4).map((h) => h.icon)).toEqual([
      '/art/icons/add-alexandria.webp',
      '/art/icons/add-text.webp',
      '/art/icons/add-scan.webp',
      '/art/icons/portal-arch.webp',
    ]);
  });

  it("captions the three ways to bring a text in with the camp's words (playability #20)", () => {
    expect(['desk', 'lens', 'portal'].map((id) => state(id, null).caption)).toEqual([
      'Écrire un nouveau parchemin',
      'Déchiffrer une feuille',
      "Les livres d'Alexandrie",
    ]);
  });

  it('makes the owl a plaque-less speaker (playability #23)', () => {
    const owl = LIBRARY_HOTSPOTS.find((h) => h.id === 'owl')!;
    expect(owl).toMatchObject({ label: '', ariaLabel: "La chouette d'Athéna", target: null });
    expect(owl.leader).toBeUndefined();
  });

  it('gives the owl a hint from her lines that never repeats the one she just said', () => {
    let last = '';
    for (let i = 0; i < 12; i++) {
      const line = owlHint();
      expect(line).toMatchObject({ key: 'library.owl', speaker: 'owl', name: "La chouette d'Athéna", portrait: '/art/characters/owl_cut.webp' });
      expect(variantsOf('library.owl')).toContain(line.text);
      expect(line.text).not.toBe(last);
      last = line.text;
    }
  });

  it('points a new hero at the shelves, unless a prophecy within a week comes first (Ruling B9)', () => {
    const base = { quests: [], prophecies: [], oracle: { status: 'sealed' }, boss: { tier_available: null, active_quest_id: null } };
    const at = (over: object) => ({ ...base, ...over }) as unknown as Partial<CampResponse>;
    expect(state('shelves', at({ xp: { total: 0 } }))).toMatchObject({ isNew: true, caption: 'Choisis un texte à défendre' });
    expect(state('shelves', at({ xp: { total: 40 } })).isNew).toBe(false);
    const soon = [{ text_id: 1, title: 'La mer', due_date: '2026-09-28', days_left: 2 }];
    expect(state('shelves', at({ xp: { total: 0 }, prophecies: soon }))).toMatchObject({ isNew: false, caption: 'Choisis un texte à défendre' });
  });

  it('seats the owl on the side table and lets it greet with one line of library.enter', () => {
    expect(OWL_LAYER).toMatchObject({ src: '/art/characters/owl_cut.webp', x: 80, y: 58, depth: 1 });
    const lines = owlGreeting();
    expect(lines).toEqual([
      expect.objectContaining({ key: 'library.enter', speaker: 'owl', name: "La chouette d'Athéna", portrait: '/art/characters/owl_cut.webp' }),
    ]);
    expect(variantsOf('library.enter')).toContain(lines[0].text);
  });
});
