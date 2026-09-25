import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse } from '../types';
import { LIBRARY_HOTSPOTS, LIBRARY_SCENE, OWL_LAYER, owlGreeting } from './library';

const state = (id: string, camp: Partial<CampResponse> | null) =>
  LIBRARY_HOTSPOTS.find((h) => h.id === id)!.state({ camp: camp as CampResponse | null, catalog: null });

describe('library tent (UI3 Ruling A1, A16)', () => {
  it('is a valid scene with the plaque echoing the hub label', () => {
    expect(validateScene(LIBRARY_SCENE)).toEqual([]);
    expect(LIBRARY_SCENE).toMatchObject({ id: 'library', title: 'La tente des parchemins', background: '/art/scenes/library_tent.webp' });
  });

  it('preloads the camp, its only way out (final review M8)', () => {
    expect(LIBRARY_SCENE.preload).toEqual(['/art/scenes/camp.webp']);
  });

  it('routes its four objects to the legacy routes, pinned to their landmarks', () => {
    expect(LIBRARY_HOTSPOTS.map((h) => [h.id, h.target])).toEqual([
      ['shelves', 'library'],
      ['desk', 'text-new'],
      ['lens', 'text-scan'],
      ['portal', 'alexandria'],
    ]);
    for (const h of LIBRARY_HOTSPOTS) expect(h.leader, h.id).toBe(true);
    expect(LIBRARY_HOTSPOTS.slice(1).map((h) => h.icon)).toEqual([
      '/art/icons/add-text.webp',
      '/art/icons/add-scan.webp',
      '/art/icons/add-alexandria.webp',
    ]);
  });

  it('keeps the old « add » menu captions on the three ways to bring a text in', () => {
    expect(['desk', 'lens', 'portal'].map((id) => state(id, null).caption)).toEqual([
      'Taper ou coller un texte',
      'Scanner une feuille',
      'Des textes classiques',
    ]);
  });

  it('points a new hero at the shelves', () => {
    expect(state('shelves', { xp: { total: 0 } } as Partial<CampResponse>)).toMatchObject({ isNew: true, caption: 'Choisis un texte à défendre' });
    expect(state('shelves', { xp: { total: 40 } } as Partial<CampResponse>).isNew).toBe(false);
  });

  it('seats the owl on the side table and lets it greet with one static line', () => {
    expect(OWL_LAYER).toMatchObject({ src: '/art/characters/owl_cut.webp', x: 80, y: 58, depth: 1 });
    expect(owlGreeting()).toEqual([
      expect.objectContaining({ speaker: 'owl', name: "La chouette d'Athéna", portrait: '/art/characters/owl_cut.webp' }),
    ]);
  });
});
