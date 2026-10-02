import { describe, expect, it } from 'vitest';
import { boxInside, boxesOverlap, shapeBox } from '../../scene/geometry';
import { variantsOf } from '../../../testing/dialogue';
import { validateScene } from '../../scene/validate';
import type { CampResponse } from '../types';
import type { DragonOut } from '../types';
import {
  BARE_WALLS,
  CABIN_HOTSPOTS,
  CABIN_SCENE,
  DECOR_SLOTS,
  PALAIS_SCENE,
  VILLA_SCENE,
  cabinGreeting,
  guideLine,
  houseScene,
  journalLine,
  lyreLine,
  trophiesLine,
} from './cabin';

const dragon = { name: 'Braise', tint: 'bronze', stage: 'young', unlocked_tints: ['bronze'], worn: [] } as DragonOut;

/** Whether a point lies inside a polygon (even-odd rule; art %). */
function inPolygon(x: number, y: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Spec 2026-09-29 drachmes §3 (R21, review focus 5).
describe('the three houses', () => {
  it('each shows its own room, its own name, the same three places', () => {
    expect([houseScene('cabin').title, houseScene('villa').title, houseScene('palais').title]).toEqual(['Ta cabane', 'Ta villa', 'Ton palais']);
    expect([VILLA_SCENE.background, PALAIS_SCENE.background]).toEqual(['/art/scenes/villa.webp', '/art/scenes/palais.webp']);
    for (const s of [VILLA_SCENE, PALAIS_SCENE]) {
      expect(s.id).toBe('cabin');
      expect(s.hotspots.map((h) => [h.id, h.label, h.target])).toEqual(CABIN_SCENE.hotspots.map((h) => [h.id, h.label, h.target]));
      expect(s.narrator).toEqual(CABIN_SCENE.narrator);
      expect(validateScene(s), s.title).toEqual([]);
    }
  });

  it('keeps no display limit (spec 2026-10-02 house treasures)', async () => {
    const mod = await import('./cabin');
    expect('MAX_DISPLAYED_DECOR' in mod).toBe(false);
    expect('WALLS_FULL_LINE' in mod).toBe(false);
  });

  // A 52 px medallion is ~4.1 % of the art's width and ~7.2 % of its height at 1280x720: each slot's
  // medallion stays on its house's bare wall, apart from the others, off every place's shape and plaque.
  it("each interior's slots sit on its bare wall, apart, off the places and their plaques", () => {
    const HALF = { x: 2.1, y: 3.7 };
    const inside = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
      p.x - HALF.x >= b.x && p.x + HALF.x <= b.x + b.w && p.y - HALF.y >= b.y && p.y + HALF.y <= b.y + b.h;
    const clear = (p: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
      p.x + HALF.x <= b.x || p.x - HALF.x >= b.x + b.w || p.y + HALF.y <= b.y || p.y - HALF.y >= b.y + b.h;
    for (const [house, scene] of [['cabin', CABIN_SCENE], ['villa', VILLA_SCENE], ['palais', PALAIS_SCENE]] as const) {
      const slots = DECOR_SLOTS[house];
      for (const s of slots) expect(Object.values(BARE_WALLS[house]).some((b) => inside(s, b)), `${house} ${JSON.stringify(s)}`).toBe(true);
      for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
        const apart = Math.abs(slots[i].x - slots[j].x) >= 2 * HALF.x || Math.abs(slots[i].y - slots[j].y) >= 2 * HALF.y;
        expect(apart, `${house} ${i} ${j}`).toBe(true);
      }
      for (const h of scene.hotspots) {
        const points = (h.shape as { points: [number, number][] }).points;
        // The place's shape itself, sampled over the medallion every 0.1 % (the villa's shelf steps in
        // below y 44 to leave the wall right of its medals free, so its bounding box would not do).
        for (const s of slots) {
          let off = true;
          for (let x = s.x - HALF.x; x <= s.x + HALF.x && off; x += 0.1)
            for (let y = s.y - HALF.y; y <= s.y + HALF.y && off; y += 0.1) if (inPolygon(x, y, points)) off = false;
          expect(off, `${house} ${JSON.stringify(s)} in ${h.id}`).toBe(true);
        }
        // Its plaque's band, 6 % either side of its middle (the widest, « Ton journal », measures 11.6 %
        // at 1280x720): 7 % above its box (a name alone), 9.5 % below it (the shelf's plaque carries its
        // caption, « 12 trésors »: a 1.7 % leader and a 7.7 % plaque).
        const xs = points.map((p) => p[0]);
        const ys = points.map((p) => p[1]);
        const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
        const mid = box.x + box.w / 2;
        const plaque = h.labelPos === 'above' ? { x: mid - 6, y: box.y - 7, w: 12, h: 7 } : { x: mid - 6, y: box.y + box.h, w: 12, h: 9.5 };
        for (const s of slots) expect(clear(s, plaque), `${house} ${JSON.stringify(s)} on ${h.id}'s plaque`).toBe(true);
      }
      // The room's name (SceneStage's plaque, from y 9.5 %): « Ton palais », the widest, measures
      // x 43-57 and ends at y 15.6 at 1280x720.
      for (const s of slots) expect(clear(s, { x: 43, y: 9.5, w: 14, h: 6.1 }), `${house} ${JSON.stringify(s)} under the room's name`).toBe(true);
    }
  });
});

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
    // Task 7 fix round 1: the greeting is heard in every house, so it names none of them.
    expect(variantsOf('cabin.enter').length).toBeGreaterThanOrEqual(3);
    for (const v of variantsOf('cabin.enter')) expect(v).not.toMatch(/cabane|villa|palais/i);
    expect(trophiesLine(dragon, null, 30).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère.");
    expect(trophiesLine(dragon, 0, 30).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère. Le premier sera en bois\u202f!");
    expect(trophiesLine(dragon, 2, 30).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère. Il en reste 28 à gagner\u202f!");
    expect(trophiesLine(dragon, 24, 25).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère. Il en reste un à gagner\u202f!");
    expect(trophiesLine(dragon, 30, 30).text).toBe("Tous les sceaux sont gagnés\u202f: l'étagère brille d'orichalque\u202f!");
    expect(journalLine(dragon).text).toBe('Ton journal se souvient de chaque texte défendu.');
    expect(lyreLine(dragon).text).toBe("Règle ici la musique, les bruitages et la voix qui te lit la dictée\u202f; les visites du camp et son guide t'attendent aussi.");
    expect(guideLine(dragon).text).toBe('Tout ce que je sais du camp est écrit ici. Relis-le quand tu veux.');
    for (const l of [trophiesLine(dragon, 4, 30), journalLine(dragon), lyreLine(dragon), guideLine(dragon), ...cabinGreeting(dragon)]) {
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
    expect(DECOR_SLOTS.cabin).toHaveLength(4);
    for (const s of DECOR_SLOTS.cabin) {
      expect(s.x).toBeGreaterThan(14.5);
      expect(s.x).toBeLessThan(85.5);
      expect(s.y).toBeGreaterThan(17);
      const spot = { x: s.x - 2, y: s.y - 3.5, w: 4, h: 7 };
      for (const h of CABIN_HOTSPOTS) expect(boxesOverlap(spot, shapeBox(h.shape)), `${s.x},${s.y} vs ${h.id}`).toBe(false);
    }
  });

  it('hangs every piece on measured bare wall, never on a beam, a lintel or a window (fix round 1)', () => {
    const walls = Object.values(BARE_WALLS.cabin);
    for (const s of DECOR_SLOTS.cabin) {
      // A 52 px medallion is at most ~4.1 % of the art's width (1280x720) and ~7.3 % of its height.
      const spot = { x: s.x - 2.05, y: s.y - 3.65, w: 4.1, h: 7.3 };
      expect(walls.some((w) => boxInside(spot, w)), `${s.x},${s.y} on bare wall`).toBe(true);
    }
    // Two pieces never hang on the same spot.
    for (const [i, a] of DECOR_SLOTS.cabin.entries())
      for (const b of DECOR_SLOTS.cabin.slice(i + 1)) expect(boxesOverlap({ x: a.x - 2.05, y: a.y - 3.65, w: 4.1, h: 7.3 }, { x: b.x - 2.05, y: b.y - 3.65, w: 4.1, h: 7.3 })).toBe(false);
  });
});
