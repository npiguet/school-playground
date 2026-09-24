import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import {
  ADD_ICONS,
  ART,
  AVATAR_ICONS,
  LIEUTENANT_ICONS,
  MARK_ICONS,
  RELIC_OF,
  REWARD_ICONS,
  TOOL_ICONS,
  artFor,
  avatarIcon,
  lieutenantIcon,
  rewardIcon,
  rewardKindOf,
} from './art';

function flat(o: unknown): string[] {
  return typeof o === 'string' ? [o] : Object.values(o as object).flatMap(flat);
}

describe('art map', () => {
  // Scene backgrounds have their own 600 KB budget (scenes/budget.test.ts), painted icons their
  // own (below, UI3 Ruling A12).
  const nonScene = () => flat(ART).filter((p) => !p.startsWith('/art/scenes/') && !p.startsWith('/art/icons/'));

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

  it('maps the 35 painted icons, each within its own budget (UI3 Ruling A12)', () => {
    const icons = flat(ART.icons);
    expect(icons).toHaveLength(35);
    for (const p of icons) expect(statSync('public' + p).size, p).toBeLessThanOrEqual(60 * 1024);
    expect(icons.reduce((s, p) => s + statSync('public' + p).size, 0)).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    const onDisk = readdirSync('public/art/icons').filter((f) => f.endsWith('.webp')).map((f) => `/art/icons/${f}`);
    expect([...onDisk].sort()).toEqual([...icons].sort());
    expect(Object.keys(AVATAR_ICONS)).toHaveLength(6);
    expect(Object.keys(LIEUTENANT_ICONS)).toHaveLength(6);
    expect(Object.keys(TOOL_ICONS)).toEqual(['persee', 'athena', 'ariane', 'argus']);
    expect(Object.keys(ADD_ICONS)).toEqual(['text', 'scan', 'alexandria']);
    expect(MARK_ICONS).toEqual({ oracleSeal: '/art/icons/seal-oracle.webp', lock: '/art/icons/lock.webp' });
  });

  it('has a painted icon for every non-tint reward of the server catalog, and a relic per lieutenant', () => {
    const py = readFileSync('../server/app/world/catalog.py', 'utf-8');
    const ids = [...py.matchAll(/_r\("([^"]+)", "(relic|gear|decor)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(14);
    expect(Object.keys(REWARD_ICONS).sort()).toEqual([...ids].sort());
    expect(rewardIcon('decor:lanterne')).toBe('/art/icons/decor-lanterne.webp');
    expect(rewardIcon('sandales_hermes')).toBe('/art/icons/sandales_hermes.webp');
    expect(rewardIcon('tint:ecume')).toBeNull();
    for (const [key, relic] of Object.entries(RELIC_OF)) {
      expect(py, key).toContain(`"relic": "${relic}"`);
      expect(rewardKindOf(relic)).toBe('relic');
    }
    expect([rewardKindOf('tint:jade'), rewardKindOf('decor:tapis'), rewardKindOf('egide')]).toEqual(['tint', 'decor', 'gear']);
  });

  it('falls back to the owl for an unknown avatar and to nothing for an unknown lieutenant', () => {
    expect(avatarIcon('trident')).toBe('/art/icons/avatar-trident.webp');
    expect(avatarIcon('medusa')).toBe('/art/icons/avatar-chouette.webp');
    expect(lieutenantIcon('hydre')).toBe('/art/icons/lt-hydre.webp');
    expect(lieutenantIcon('medusa')).toBeNull();
  });
});
