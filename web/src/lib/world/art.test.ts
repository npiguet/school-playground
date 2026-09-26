import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import type { WorldCatalog } from './types';
import {
  ADD_ICONS,
  ART,
  AVATAR_ICONS,
  LIEUTENANT_ICONS,
  MARK_ICONS,
  PLACE_ICONS,
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

  it('ships the overlay textures and objects within their budgets (immersion wave W3)', () => {
    // Parchment retry (2026-09-25): prompted explicitly as a low-contrast text background (no
    // "tone variation") plus `--tiling` and uiart.py's new `flatten()` pass, seed 903 passed first
    // try — no vignette, no seam, no blotch grid (docs/art/style-guide.md §5).
    expect(ART.textures).toEqual({
      marble: '/art/textures/marble.webp',
      parchment: '/art/textures/parchment.webp',
      woodBoard: '/art/textures/wood_board.webp',
    });
    expect(ART.ui).toEqual({ scrollRolled: '/art/ui/scroll_rolled.webp' });
    for (const p of flat(ART.textures)) expect(statSync('public' + p).size, p).toBeLessThanOrEqual(150 * 1024);
    for (const p of flat(ART.ui)) expect(statSync('public' + p).size, p).toBeLessThanOrEqual(60 * 1024);
    expect(PLACE_ICONS).toEqual({ portal: '/art/icons/portal-arch.webp' });
  });

  it('maps the 36 painted icons, each within its own budget (UI3 Ruling A12)', () => {
    const icons = flat(ART.icons);
    expect(icons).toHaveLength(36);
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

  it('prefers the camp catalog\'s own kind over the id-prefix/RELIC_OF guess when it is given (review round 1 #7)', () => {
    const catalog = {
      rewards: { egide: { id: 'egide', kind: 'decor', name: 'Égide', desc: '', source: '' } },
    } as unknown as WorldCatalog;
    // Without a catalog, `egide` isn't a tint/decor id nor a relic, so the fallback guesses 'gear'.
    expect(rewardKindOf('egide')).toBe('gear');
    // A catalog that (hypothetically) disagrees wins.
    expect(rewardKindOf('egide', catalog)).toBe('decor');
    // A catalog that doesn't know this id at all still falls back to the guess.
    expect(rewardKindOf('egide', { rewards: {} } as unknown as WorldCatalog)).toBe('gear');
    expect(rewardKindOf('egide', null)).toBe('gear');
  });

  it('names the four battle backdrops (UI4)', () => {
    expect(ART.scenes.battleRiver).toBe('/art/scenes/battle_river.webp');
    expect(ART.scenes.battleCoast).toBe('/art/scenes/battle_coast.webp');
    expect(ART.scenes.battleTemple).toBe('/art/scenes/battle_temple.webp');
    expect(ART.scenes.erisLair).toBe('/art/scenes/eris_lair.webp');
  });

  it('ships the painted chest and Éris\'s flustered pose within their own budgets (UI4 Task A)', () => {
    expect(ART.battle).toEqual({
      chestClosed: '/art/battle/chest_closed.webp',
      chestOpen: '/art/battle/chest_open.webp',
    });
    expect(ART.erisFlustered).toBe('/art/characters/eris_flustered_cut.webp');
    for (const p of flat(ART.battle)) expect(statSync('public' + p).size, p).toBeLessThanOrEqual(60 * 1024);
    expect(statSync('public' + ART.erisFlustered).size, ART.erisFlustered).toBeLessThanOrEqual(120 * 1024);
  });
});

describe('reward kinds before the catalog has loaded (final review M6)', () => {
  // Medallion resolves the kind itself and falls back to the id guess until /world arrives: the
  // guess must already agree with the server's catalog (server/app/world/catalog.py) for every
  // reward, or a medallion would flicker from one look to another.
  it('guesses the same kind as the server catalog for every reward', () => {
    const source = readFileSync('../server/app/world/catalog.py', 'utf-8');
    const rewards = [...source.matchAll(/_r\("([^"]+)", "([a-z]+)"/g)].map((m) => [m[1], m[2]]);
    expect(rewards.length).toBeGreaterThan(15);
    for (const [id, kind] of rewards) expect(rewardKindOf(id), id).toBe(kind);
  });
});
