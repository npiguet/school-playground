import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { ART, artFor } from './art';

function flat(o: unknown): string[] {
  return typeof o === 'string' ? [o] : Object.values(o as object).flatMap(flat);
}

describe('art map', () => {
  // Scene backgrounds have their own 600 KB budget (scenes UI spec §4, scenes/budget.test.ts).
  const nonScene = () => flat(ART).filter((p) => !p.startsWith('/art/scenes/'));

  it('every path exists under public/, non-scene art is under 150 KB', () => {
    for (const p of flat(ART)) expect(existsSync('public' + p), p).toBe(true);
    for (const p of nonScene()) expect(statSync('public' + p).size, p).toBeLessThan(150 * 1024);
  });

  it('total non-scene art payload stays under 2.5 MB', () => {
    expect(nonScene().reduce((s, p) => s + statSync('public' + p).size, 0)).toBeLessThan(2.5 * 1024 * 1024);
  });

  it('artFor resolves and throws on unknown keys', () => {
    expect(artFor('lieutenant', 'hydre')).toBe('/art/lieutenants/hydre_cut.webp');
    expect(() => artFor('lieutenant', 'medusa')).toThrow();
  });

  it('maps the UI2 scenes, characters and props (docs/art/scenes.md)', () => {
    expect(ART.scenes.titleGates).toBe('/art/scenes/title_gates.webp');
    expect(ART.scenes.hubCamp).toBe('/art/scenes/hub_camp.webp');
    expect(ART.scenes.libraryTent).toBe('/art/scenes/library_tent.webp');
    expect(ART.scenes.delphi).toBe('/art/scenes/delphi.webp');
    expect(ART.scenes.warTent).toBe('/art/scenes/war_tent.webp');
    expect(ART.scenes.nest).toBe('/art/scenes/nest.webp');
    expect(ART.scenes.cabin).toBe('/art/scenes/cabin.webp');
    expect(ART.characters).toEqual({ pythia: '/art/characters/pythia_cut.webp', owl: '/art/characters/owl_cut.webp' });
    expect(ART.props).toEqual({
      votiveTablets: '/art/props/votive_tablets_cut.webp',
      codexLectern: '/art/props/codex_lectern_cut.webp',
      trophyShelf: '/art/props/trophy_shelf_cut.webp',
    });
  });
});
