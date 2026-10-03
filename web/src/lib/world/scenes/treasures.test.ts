import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { boxesOverlap, shapeBox } from '../../scene/geometry';
import type { Box } from '../../scene/types';
import { webpSize } from '../../../testing/webp';
import { ART } from '../art';
import { LIEUTENANT_ORDER, type House, type LieutenantKey } from '../types';
import { houseScene } from './cabin';
import { HUD_LINE_SHORT } from './nest';
import {
  DECOR_PIECES,
  GEAR_PIECES,
  PIECE_IDS,
  PIECE_SIZES,
  POSES,
  TREASURE_PLACES,
  TROPHY_FOOT,
  placeBox,
  shownPieces,
  type PieceId,
  type RoomPiece,
} from './treasures';
import CHECKS from './treasure-checks.json';

const HOUSES: House[] = ['cabin', 'villa', 'palais'];
const isTrophy = (id: PieceId): id is LieutenantKey => (LIEUTENANT_ORDER as readonly string[]).includes(id);
/** A piece's picture, read from its file (all thirty trophies are 512 px squares: the orichalque one stands for them). */
const aspectOf = (id: PieceId) => {
  const s = webpSize('public' + (isTrophy(id) ? ART.trophies.large[id][4] : ART.treasures[id as RoomPiece]));
  return s.h / s.w;
};
const boxOf = (house: House, id: PieceId) => placeBox(TREASURE_PLACES[house][id], aspectOf(id), isTrophy(id) ? TROPHY_FOOT : 0);

/** The room's fixed boxes the pieces stay clear of (the name plaques, the exit sign, the places'
 *  plaques and leaders), in art %: one model shared with tools/art/treasure_preview.py, its notes
 *  in its `_doc`. */
const NAME_PLAQUES: Box[] = CHECKS.nameplates;
const EXIT_SIGN: Box = CHECKS.exitSign;
const PLAQUES: Record<string, { w: number; h: number }> = CHECKS.plaques;
const L = CHECKS.leaderPx;
const LEADER = { len: (L.len / L.artH) * 100, pinH: (L.pinH / L.artH) * 100, pinW: (L.pinW / L.artW) * 100 };

// Spec 2026-10-02 house treasures, "Tests: unit".
describe('the places of the treasures', () => {
  it('has a place for every piece in every house, and for nothing else', () => {
    expect(Object.keys(TREASURE_PLACES).sort()).toEqual([...HOUSES].sort());
    for (const h of HOUSES) {
      expect(Object.keys(TREASURE_PLACES[h]).sort(), h).toEqual([...PIECE_IDS].sort());
      for (const id of PIECE_IDS) {
        const p = TREASURE_PLACES[h][id];
        expect([p.x, p.y, p.w].every(Number.isFinite) && p.w > 0, `${h} ${id}`).toBe(true);
      }
    }
  });

  it('names the gear and decor of the server catalog, one pose each', () => {
    const py = readFileSync('../server/app/world/catalog.py', 'utf-8');
    const ids = [...py.matchAll(/_r\("([^"]+)", "(gear|decor)"/g)].map((m) => m[1]);
    expect([...GEAR_PIECES, ...DECOR_PIECES].sort()).toEqual(ids.sort());
    expect(Object.keys(POSES).sort()).toEqual([...PIECE_IDS].sort());
  });

  it("knows every piece's picture size, so the room sizes its box before the file loads", () => {
    expect(Object.keys(PIECE_SIZES).sort()).toEqual([...PIECE_IDS].sort());
    for (const id of PIECE_IDS) {
      const files = isTrophy(id) ? ART.trophies.large[id] : [ART.treasures[id as RoomPiece]];
      expect(files.length, id).toBeGreaterThan(0);
      for (const f of files) expect(webpSize('public' + f), f).toEqual(PIECE_SIZES[id]);
    }
  });

  it('keeps every piece inside the frame and the safe zone, below the HUD, off the room name and the exit sign', () => {
    for (const h of HOUSES)
      for (const id of PIECE_IDS) {
        const b = boxOf(h, id);
        const where = `${h} ${id} ${JSON.stringify(b)}`;
        expect(b.x, where).toBeGreaterThanOrEqual(12.5);
        expect(b.x + b.w, where).toBeLessThanOrEqual(87.5);
        expect(b.y, where).toBeGreaterThanOrEqual(HUD_LINE_SHORT); // ruling H3 (nest.ts), 11.2 %
        expect(b.y + b.h, where).toBeLessThanOrEqual(100);
        for (const n of NAME_PLAQUES) expect(boxesOverlap(b, n), where).toBe(false);
        expect(boxesOverlap(b, EXIT_SIGN), `${where} under the exit sign`).toBe(false);
      }
  });

  it('stands the six trophies on their shelves at one size in each house', () => {
    for (const h of HOUSES) {
      const places = LIEUTENANT_ORDER.map((k) => TREASURE_PLACES[h][k]);
      // Three a shelf (Task 5 as built: the cupboard's top two shelves).
      expect(new Set(places.map((p) => p.y)).size, h).toBe(2);
      expect(new Set(places.map((p) => p.w)).size, h).toBe(1);
    }
  });

  it('keeps every piece off the three places, their plaques and leaders (the cupboard holds the trophies and the gear)', () => {
    for (const h of HOUSES) {
      for (const def of houseScene(h).hotspots) {
        const box = shapeBox(def.shape);
        const size = PLAQUES[def.id];
        const centre = box.x + box.w / 2 + ((def.labelDx ?? 0) * box.w) / 100;
        const left = Math.min(Math.max(centre - size.w / 2, 12.5), 87.5 - size.w);
        const plaque = { x: left, y: def.labelPos === 'above' ? box.y - size.h : box.y + box.h, ...size };
        const edge = def.labelPos === 'above' ? box.y : box.y + box.h;
        const leader = {
          x: box.x + box.w / 2 - LEADER.pinW / 2,
          y: def.labelPos === 'above' ? edge - LEADER.len : edge - LEADER.pinH,
          w: LEADER.pinW,
          h: LEADER.len + LEADER.pinH,
        };
        for (const id of PIECE_IDS) {
          const b = boxOf(h, id);
          expect(boxesOverlap(b, plaque), `${h} ${id} on ${def.id}'s plaque`).toBe(false);
          expect(boxesOverlap(b, leader), `${h} ${id} on ${def.id}'s leader`).toBe(false);
          // The cupboard is the « Tes trésors » place itself: its nine stand inside that one place.
          const inCupboard = def.id === 'trophies' && (isTrophy(id) || (GEAR_PIECES as readonly string[]).includes(id));
          if (!inCupboard) expect(boxesOverlap(b, box), `${h} ${id} in ${def.id}`).toBe(false);
        }
      }
    }
  });

  it('keeps every piece clear of every other piece', () => {
    for (const h of HOUSES)
      for (let i = 0; i < PIECE_IDS.length; i++)
        for (let j = i + 1; j < PIECE_IDS.length; j++)
          expect(boxesOverlap(boxOf(h, PIECE_IDS[i]), boxOf(h, PIECE_IDS[j])), `${h} ${PIECE_IDS[i]} vs ${PIECE_IDS[j]}`).toBe(false);
  });

  it('places a picture by its bottom edge: a trophy by its base, above its transparent foot', () => {
    expect(placeBox({ x: 50, y: 40, w: 9 }, 1)).toEqual({ x: 45.5, y: 40 - 16, w: 9, h: 16 });
    const t = placeBox({ x: 50, y: 40, w: 9 }, 1, TROPHY_FOOT);
    expect(t.y + t.h * (1 - TROPHY_FOOT)).toBeCloseTo(40, 9);
  });
});

describe('what the room shows', () => {
  const row = (id: string, equipped = false) => ({ id, equipped });

  it('shows nothing in a house with nothing won: only the painted fixtures', () => {
    for (const h of HOUSES) expect(shownPieces(h, [])).toEqual([]);
  });

  it("shows each lieutenant's highest trophy at its place, from the large file", () => {
    const p = shownPieces('villa', [row('trophy:hydre:1'), row('trophy:hydre:3'), row('trophy:echo:2')]);
    expect(p.map((x) => [x.id, x.level, x.src]).sort()).toEqual([
      ['echo', 2, '/art/trophies/large/trophy-echo-2.webp'],
      ['hydre', 3, '/art/trophies/large/trophy-hydre-3.webp'],
    ]);
    expect(p.find((x) => x.id === 'hydre')).toMatchObject({ place: TREASURE_PLACES.villa.hydre, pose: 'trophy', foot: TROPHY_FOOT });
  });

  it('shows gear and decor only while on display, each at its own place', () => {
    const p = shownPieces('cabin', [row('egide', true), row('foudre_zeus'), row('decor:tapis', true), row('decor:amphore')]);
    expect(p.map((x) => x.id).sort()).toEqual(['decor:tapis', 'egide']);
    expect(p.find((x) => x.id === 'egide')).toMatchObject({ src: '/art/treasures/egide.webp', place: TREASURE_PLACES.cabin.egide, pose: 'hangs', level: null });
    expect(p.find((x) => x.id === 'decor:tapis')).toMatchObject({ pose: 'lies', foot: 0 });
  });

  it('shows all eighteen at once: no display limit', () => {
    const all = [
      ...LIEUTENANT_ORDER.map((k) => row(`trophy:${k}:5`)),
      ...[...GEAR_PIECES, ...DECOR_PIECES].map((id) => row(id, true)),
    ];
    for (const h of HOUSES) expect(shownPieces(h, all), h).toHaveLength(18);
  });

  // Review Focus 1.
  it('ignores what has no place in a room: tints, accessories, houses, unknown ids, seals past the fifth', () => {
    expect(
      shownPieces('cabin', [
        row('tint:jade', true),
        row('accessory:hydre-cou', true),
        row('house:villa', true),
        row('decor:retired', true),
        row('trophy:hydre:9'),
        row('trophy:medusa:1'),
      ]),
    ).toEqual([]);
  });

  // Review Focus 2.
  it("follows the house: the same rewards at the palais's places", () => {
    const rows = [row('trophy:lethe:4'), row('decor:chouette', true)];
    const shown = shownPieces('palais', rows);
    expect(shown).toHaveLength(2);
    for (const p of shown) expect(p.place).toEqual(TREASURE_PLACES.palais[p.id]);
  });

  it('draws the nearer pieces last (a lower bottom edge)', () => {
    const all = [...LIEUTENANT_ORDER.map((k) => row(`trophy:${k}:1`)), ...[...GEAR_PIECES, ...DECOR_PIECES].map((id) => row(id, true))];
    const ys = shownPieces('cabin', all).map((p) => p.place.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });
});
