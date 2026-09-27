import { describe, expect, it } from 'vitest';
import { boxInside, boxesOverlap, shapeBox } from '../../scene/geometry';
import { variantsOf } from '../../../testing/dialogue';
import { validateScene } from '../../scene/validate';
import type { CampResponse } from '../types';
import type { DragonOut } from '../types';
import { BARE_WALL, CABIN_HOTSPOTS, CABIN_SCENE, DECOR_SLOTS, MAX_DISPLAYED_DECOR, WALLS_FULL_LINE, cabinGreeting, journalLine, lyreLine, trophiesLine } from './cabin';

const dragon = { name: 'Braise', tint: 'bronze', stage: 'young', neutralised: 2, available: 6, next_stage_at: 4, unlocked_tints: ['bronze'] } as DragonOut;

describe('the cabin (UI3 Ruling B6)', () => {
  it('is a valid scene whose plaque echoes the hub label', () => {
    expect(validateScene(CABIN_SCENE)).toEqual([]);
    expect(CABIN_SCENE).toMatchObject({ id: 'cabin', title: 'Ta cabane', background: '/art/scenes/cabin.webp' });
    expect(CABIN_SCENE.preload).toEqual(['/art/scenes/hub_camp.webp']);
  });

  it('lets the dragon speak at home: a greeting and a line on each overlay but the hero panel (UI3b playability #7)', () => {
    const greeting = cabinGreeting(dragon);
    expect(greeting).toEqual([expect.objectContaining({ key: 'cabin.enter', speaker: 'dragon', name: 'Braise' })]);
    expect(variantsOf('cabin.enter')).toContain(greeting[0].text);
    expect(trophiesLine(dragon, 4).text).toBe('Chaque ruse neutralisée laisse une relique. Il en manque encore quatre\u202f!');
    expect(trophiesLine(dragon, 1).text).toBe('Chaque ruse neutralisée laisse une relique. Il en manque encore une\u202f!');
    expect(trophiesLine(dragon, 0).text).toBe('Chaque ruse neutralisée a laissé sa relique\u202f: elles sont toutes là\u202f!');
    expect(trophiesLine(dragon, null).text).toBe('Chaque ruse neutralisée laisse une relique.');
    expect(journalLine(dragon).text).toBe('Ton journal se souvient de chaque texte défendu.');
    expect(lyreLine(dragon).text).toBe('Choisis ici qui te lit la dictée, et règle la musique et les bruitages à ton goût.');
    for (const l of [trophiesLine(dragon, 4), journalLine(dragon), lyreLine(dragon), ...cabinGreeting(dragon)]) {
      expect(l.text.length).toBeLessThanOrEqual(160);
      expect(l.portrait).toBe('/art/dragon/dragon_young_cut.webp');
    }
  });

  it('opens the trophies, the journal and the lyre', () => {
    expect(CABIN_HOTSPOTS.map((h) => [h.id, h.target, h.query ?? null, h.label])).toEqual([
      ['trophies', 'cabin', { panel: 'tresors' }, 'Tes trésors'],
      ['journal', 'stats', null, 'Ton journal'],
      ['lyre', 'settings', null, 'La lyre'],
    ]);
    expect(CABIN_HOTSPOTS[0].state({ camp: { rewards_count: 2 } as CampResponse, catalog: null }).caption).toBe('2 trésors');
  });

  it('hangs the displayed decor on free wall spots inside the safe zone', () => {
    expect(DECOR_SLOTS).toHaveLength(4);
    for (const s of DECOR_SLOTS) {
      expect(s.x).toBeGreaterThan(14.5);
      expect(s.x).toBeLessThan(85.5);
      expect(s.y).toBeGreaterThan(17);
      const spot = { x: s.x - 2, y: s.y - 3.5, w: 4, h: 7 };
      for (const h of CABIN_HOTSPOTS) expect(boxesOverlap(spot, shapeBox(h.shape)), `${s.x},${s.y} vs ${h.id}`).toBe(false);
    }
  });

  it('hangs every piece on measured bare wall, never on a beam, a lintel or a window (fix round 1)', () => {
    const walls = Object.values(BARE_WALL);
    for (const s of DECOR_SLOTS) {
      // A 52 px medallion is at most ~4.1 % of the art's width (1280x720) and ~7.3 % of its height.
      const spot = { x: s.x - 2.05, y: s.y - 3.65, w: 4.1, h: 7.3 };
      expect(walls.some((w) => boxInside(spot, w)), `${s.x},${s.y} on bare wall`).toBe(true);
    }
    // Two pieces never hang on the same spot.
    for (const [i, a] of DECOR_SLOTS.entries())
      for (const b of DECOR_SLOTS.slice(i + 1)) expect(boxesOverlap({ x: a.x - 2.05, y: a.y - 3.65, w: 4.1, h: 7.3 }, { x: b.x - 2.05, y: b.y - 3.65, w: 4.1, h: 7.3 })).toBe(false);
  });

  it('holds one piece per wall spot and says so in words when they are all taken', () => {
    expect(MAX_DISPLAYED_DECOR).toBe(4);
    expect(MAX_DISPLAYED_DECOR).toBe(DECOR_SLOTS.length);
    expect(WALLS_FULL_LINE).toBe("Les murs sont pleins\u202f: range d'abord une pièce.");
  });
});
