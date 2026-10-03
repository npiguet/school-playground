import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { DRAGON_STAGES, LIEUTENANT_ORDER, type WorldCatalog } from './types';
import {
  ADD_ICONS,
  ART,
  AVATAR_ICONS,
  LIEUTENANT_ICONS,
  MARK_ICONS,
  PLACE_ICONS,
  REWARD_ICONS,
  TOOL_ICONS,
  artFor,
  avatarIcon,
  dragonArt,
  lieutenantIcon,
  rewardIcon,
  rewardKindOf,
  trophyIcon,
} from './art';
import { ACCESSORY_MANIFEST, accessorySrc } from './accessories';
import { TINT_SPECS } from './dragon';
import type { Tint } from './types';
import { DECOR_PIECES, GEAR_PIECES } from './scenes/treasures';
import { webpSize } from '../../testing/webp';

const TINTS_BAKED = (Object.keys(TINT_SPECS) as Tint[]).filter((t) => TINT_SPECS[t] !== null);

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

  it('total non-scene art payload, the accessories included, stays under 4.75 MiB (raised for the 96 overlays, art spec Phase 4, then the twelve room treasures)', () => {
    // Measured with the twelve room treasures (spec 2026-10-02 house treasures): 4768410 bytes.
    const accessories = readdirSync('public/art/dragon/accessories').map((f) => statSync(`public/art/dragon/accessories/${f}`).size);
    const total = nonScene().reduce((s, p) => s + statSync('public' + p).size, 0) + accessories.reduce((s, n) => s + n, 0);
    expect(total).toBeLessThan(4.75 * 1024 * 1024);
  });

  it('ships the baked tints within their own budget (amended 2026-10-03, baked tints)', () => {
    // Each stage under each of the five tints, baked at the sources' WebP quality (bake_tints.py), so
    // each file stays near its sprite (0.95x to 1.07x) and under the sprites' own 150 KB cap. Measured
    // 2026-10-03: the 30 files total 3,449,604 bytes, the largest 142,284 (ancestral, argent); the cap
    // leaves about 6 % for a re-bake of the same sprites. A re-cut sprite that bakes larger raises these
    // caps (measured again, here); they are never to be met by lowering the bake's WebP quality.
    const baked = DRAGON_STAGES.flatMap((s) => TINTS_BAKED.map((t) => 'public' + dragonArt(s, t)));
    expect(baked).toHaveLength(30);
    for (const p of baked) expect(statSync(p).size, p).toBeLessThan(150 * 1024);
    expect(baked.reduce((s, p) => s + statSync(p).size, 0)).toBeLessThan(3.5 * 1024 * 1024);
  });

  it('ships the twelve treasures of the rooms, each within its budget (spec 2026-10-02 house treasures)', () => {
    expect(Object.keys(ART.treasures).sort()).toEqual([...GEAR_PIECES, ...DECOR_PIECES].sort());
    const files = Object.values(ART.treasures);
    const onDisk = readdirSync('public/art/treasures').filter((f) => f.endsWith('.webp')).map((f) => `/art/treasures/${f}`);
    expect([...onDisk].sort()).toEqual([...files].sort());
    for (const p of files) expect(statSync('public' + p).size, p).toBeLessThanOrEqual(90 * 1024);
    expect(files.reduce((s, p) => s + statSync('public' + p).size, 0)).toBeLessThanOrEqual(700 * 1024);
    expect(statSync('public/art/icons/decor-trophee.webp').size).toBeLessThanOrEqual(20 * 1024);
  });

  // Spec 2026-09-29 drachmes §4, §6: every piece at every wearing stage, inside the stage's picture,
  // its fractions matching its own crop (review focus 4); nothing on disk the manifest does not name.
  it('has a manifest entry for the 24 pieces at the four wearing stages, and each one fits', () => {
    const lts = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'];
    const items = lts.flatMap((lt) => ['cou', 'queue', 'dos', 'tete'].map((s) => `${lt}-${s}`));
    expect(Object.keys(ACCESSORY_MANIFEST).sort()).toEqual([...items].sort());
    const files: string[] = [];
    for (const item of items) {
      for (const stage of ['young', 'adult', 'illustre', 'ancestral'] as const) {
        const e = ACCESSORY_MANIFEST[item][stage];
        expect(e, `${item} ${stage}`).toBeDefined();
        const where = `${item} ${stage}`;
        const pic = webpSize('public' + ART.dragon[stage]);
        const crop = webpSize('public' + accessorySrc(e!.src));
        files.push(e!.src);
        expect(e!.w > 0 && e!.h > 0 && e!.x >= 0 && e!.y >= 0, where).toBe(true);
        expect(e!.x + e!.w, where).toBeLessThanOrEqual(1 + 1e-4);
        expect(e!.y + e!.h, where).toBeLessThanOrEqual(1 + 1e-4);
        expect(Math.abs(e!.w * pic.w - crop.w), where).toBeLessThanOrEqual(1.5);
        expect(Math.abs(e!.h * pic.h - crop.h), where).toBeLessThanOrEqual(1.5);
        expect(statSync('public' + accessorySrc(e!.src)).size, where).toBeLessThan(150 * 1024);
      }
    }
    expect(readdirSync('public/art/dragon/accessories').sort()).toEqual([...files].sort());
  });

  it('maps the 30 trophies twice, as icons and for the close view (spec 2026-09-29 lieutenant levels §1)', () => {
    expect(Object.keys(ART.trophies.icons)).toEqual([...LIEUTENANT_ORDER]);
    for (const k of LIEUTENANT_ORDER) {
      expect(ART.trophies.icons[k]).toEqual([1, 2, 3, 4, 5].map((l) => `/art/trophies/trophy-${k}-${l}.webp`));
      expect(ART.trophies.large[k]).toEqual([1, 2, 3, 4, 5].map((l) => `/art/trophies/large/trophy-${k}-${l}.webp`));
    }
    const onDisk = (dir: string) => readdirSync(`public/art/${dir}`).filter((f) => f.endsWith('.webp')).map((f) => `/art/${dir}/${f}`).sort();
    expect(onDisk('trophies')).toEqual(flat(ART.trophies.icons).sort());
    expect(onDisk('trophies/large')).toEqual(flat(ART.trophies.large).sort());
    for (const p of flat(ART.trophies.icons)) expect(statSync('public' + p).size, p).toBeLessThanOrEqual(20 * 1024);
    expect(trophyIcon('hydre', 2)).toBe('/art/trophies/trophy-hydre-2.webp');
    expect(trophyIcon('lethe', 5, true)).toBe('/art/trophies/large/trophy-lethe-5.webp');
    expect([trophyIcon('medusa', 1), trophyIcon('hydre', 0), trophyIcon('hydre', 6)]).toEqual([null, null, null]);
    expect(rewardIcon('trophy:echo:3')).toBe('/art/trophies/trophy-echo-3.webp');
    expect(rewardIcon('trophy:echo:9')).toBeNull();
    expect(rewardKindOf('trophy:echo:3')).toBe('trophy');
  });

  it('paints the dragon at each of its six stages (spec 2026-09-29 dragon growth §3)', () => {
    expect(Object.keys(ART.dragon)).toEqual([...DRAGON_STAGES]);
    for (const s of DRAGON_STAGES) expect(ART.dragon[s]).toBe(`/art/dragon/dragon_${s}_cut.webp`);
  });

  it('artFor resolves and throws on unknown keys', () => {
    expect(artFor('lieutenant', 'hydre')).toBe('/art/lieutenants/hydre_cut.webp');
    expect(() => artFor('lieutenant', 'medusa')).toThrow();
  });

  // The living engine's frame (spec 2026-10-03 living battle, plan Ruling B2): atlas.ts padToFrame
  // throws (the still picture) on any other size, so a re-cut picture of another size is caught here.
  it('draws every dragon stage on the 1024 x 1024 frame and every battle foe on a 585 x 1024 portrait', () => {
    for (const stage of DRAGON_STAGES) expect(webpSize('public' + ART.dragon[stage]), stage).toEqual({ w: 1024, h: 1024 });
    const foes = [ART.eris, ART.erisFlustered, ...Object.values(ART.lieutenants)];
    expect(foes).toHaveLength(8);
    for (const p of foes) expect(webpSize('public' + p), p).toEqual({ w: 585, h: 1024 });
  });

  it('maps the UI2 scenes, characters and props (docs/art/scenes.md)', () => {
    expect(ART.scenes.titleGates).toBe('/art/scenes/title_gates.webp');
    expect(ART.scenes.hubCamp).toBe('/art/scenes/hub_camp.webp');
    expect(ART.scenes.libraryTent).toBe('/art/scenes/library_tent.webp');
    expect(ART.scenes.delphi).toBe('/art/scenes/delphi.webp');
    expect(ART.scenes.warTent).toBe('/art/scenes/war_tent.webp');
    // Spec 2026-10-02 nest by stage: one painting per stage, 2048x1152; the old single nest is gone.
    expect(ART.nest).toEqual(Object.fromEntries(DRAGON_STAGES.map((s) => [s, `/art/scenes/nest_${s}.webp`])));
    for (const p of Object.values(ART.nest)) expect(webpSize('public' + p), p).toEqual({ w: 2048, h: 1152 });
    expect(existsSync('public/art/scenes/nest.webp')).toBe(false);
    expect('nest' in ART.scenes).toBe(false);
    expect(ART.scenes.cabin).toBe('/art/scenes/cabin.webp');
    expect(ART.characters).toEqual({ pythia: '/art/characters/pythia_cut.webp', owl: '/art/characters/owl_cut.webp', hermes: '/art/characters/hermes_cut.webp' });
    expect([ART.scenes.villa, ART.scenes.palais]).toEqual(['/art/scenes/villa.webp', '/art/scenes/palais.webp']);
    expect(ART.props).toEqual({
      votiveTablets: '/art/props/votive_tablets_cut.webp',
      codexLectern: '/art/props/codex_lectern_cut.webp',
      trophyShelf: '/art/props/trophy_shelf_cut.webp',
    });
  });

  it('ships the camp with Hermès\'s stall in place of the old one, and Hermès within budget (spec 2026-09-29 drachmes §2)', () => {
    expect(ART.scenes.hubCamp).toBe('/art/scenes/hub_camp.webp');
    expect(existsSync('public/art/scenes/hub_camp_stall.webp')).toBe(false);
    expect(statSync('public' + ART.characters.hermes).size).toBeLessThanOrEqual(80 * 1024);
    for (const id of ['amphore', 'chouette', 'mosaique', 'bouclier', 'trophee']) expect(statSync(`public/art/icons/decor-${id}.webp`).size, id).toBeLessThanOrEqual(20 * 1024);
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
    expect(Object.keys(TOOL_ICONS)).toEqual(['persee', 'athena', 'ariane', 'argus', 'palamede']);
    expect(ART.emblems.palamede).toBe('/art/emblems/palamede_cut.webp');
    expect(Object.keys(ADD_ICONS)).toEqual(['text', 'scan', 'alexandria']);
    expect(MARK_ICONS).toEqual({ oracleSeal: '/art/icons/seal-oracle.webp', lock: '/art/icons/lock.webp', drachme: '/art/icons/drachme.webp' });
  });

  it('has a painted icon for every gear and decor reward of the server catalog, and a trophy per lieutenant and seal', () => {
    const py = readFileSync('../server/app/world/catalog.py', 'utf-8');
    const ids = [...py.matchAll(/_r\("([^"]+)", "(gear|decor)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(12);
    expect(Object.keys(REWARD_ICONS).sort()).toEqual([...ids].sort());
    expect(py).not.toMatch(/"relic"/);
    expect(rewardIcon('decor:lanterne')).toBe('/art/icons/decor-lanterne.webp');
    expect(rewardIcon('decor:mosaique')).toBe('/art/icons/decor-mosaique.webp');
    expect([rewardKindOf('accessory:hydre-cou'), rewardKindOf('house:villa')]).toEqual(['accessory', 'house']);
    expect(rewardIcon('sandales_hermes')).toBe('/art/icons/sandales_hermes.webp');
    expect(rewardIcon('tint:ecume')).toBeNull();
    expect([rewardKindOf('tint:jade'), rewardKindOf('decor:tapis'), rewardKindOf('egide'), rewardKindOf('trophy:hydre:1')]).toEqual(['tint', 'decor', 'gear', 'trophy']);
  });

  it('falls back to the owl for an unknown avatar and to nothing for an unknown lieutenant', () => {
    expect(avatarIcon('trident')).toBe('/art/icons/avatar-trident.webp');
    expect(avatarIcon('medusa')).toBe('/art/icons/avatar-chouette.webp');
    expect(lieutenantIcon('hydre')).toBe('/art/icons/lt-hydre.webp');
    expect(lieutenantIcon('medusa')).toBeNull();
  });

  it('prefers the camp catalog\'s own kind over the id-prefix guess when it is given (review round 1 #7)', () => {
    const catalog = {
      rewards: { egide: { id: 'egide', kind: 'decor', name: 'Égide', desc: '', source: '' } },
    } as unknown as WorldCatalog;
    // Without a catalog, `egide` isn't a tint/decor/trophy id, so the fallback guesses 'gear'.
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
    expect(rewards).toHaveLength(19);
    for (const [id, kind] of rewards) expect(rewardKindOf(id), id).toBe(kind);
    for (const k of LIEUTENANT_ORDER) for (const l of [1, 2, 3, 4, 5]) expect(rewardKindOf(`trophy:${k}:${l}`)).toBe('trophy');
  });
});
