// The house shows its treasures (spec 2026-10-02 house treasures): every reward that belongs in a
// room has a fixed place in every house, painted at full size in the room's perspective. Pure: the
// places are measured on the paintings (treasure-places.json, docs/art/scenes.md); the room draws
// what `shownPieces` returns, as plain images (depth 0, no idle, no parallax, not tappable).
import { ART_ASPECT } from '../../scene/geometry';
import type { Box } from '../../scene/types';
import { TREASURE_ART, trophyIcon } from '../art';
import { highestTrophies } from '../seals';
import { LIEUTENANT_ORDER, type House, type LieutenantKey, type RewardOut } from '../types';
import PLACES from './treasure-places.json';

export const GEAR_PIECES = ['sandales_hermes', 'egide', 'foudre_zeus'] as const;
export const DECOR_PIECES = [
  'decor:lanterne',
  'decor:tapis',
  'decor:bibliotheque',
  'decor:trophee',
  'decor:fresque',
  'decor:amphore',
  'decor:chouette',
  'decor:mosaique',
  'decor:bouclier',
] as const;
export type GearPiece = (typeof GEAR_PIECES)[number];
export type DecorPiece = (typeof DECOR_PIECES)[number];
export type RoomPiece = GearPiece | DecorPiece;
/** A lieutenant's place holds its highest trophy; the others their own piece. */
export type PieceId = LieutenantKey | RoomPiece;
export const PIECE_IDS: readonly PieceId[] = [...LIEUTENANT_ORDER, ...GEAR_PIECES, ...DECOR_PIECES];

/** Where a piece goes, art %: x its centre, y its bottom edge (where it stands, or the foot of a
 *  hanging piece), w its width. Its height follows from its picture. */
export interface Place {
  x: number;
  y: number;
  w: number;
}

export const TREASURE_PLACES = PLACES as Record<House, Record<PieceId, Place>>;

/** How a piece sits (ruling R3): a trophy or a standing piece casts the CSS contact shadow, a
 *  hanging one a faint drop shadow on the wall, the rug lies flat with none. */
export type Pose = 'trophy' | 'stands' | 'hangs' | 'lies';
export const POSES: Record<PieceId, Pose> = {
  hydre: 'trophy',
  echo: 'trophy',
  chimere: 'trophy',
  protee: 'trophy',
  sirenes: 'trophy',
  lethe: 'trophy',
  sandales_hermes: 'stands',
  egide: 'hangs',
  foudre_zeus: 'stands',
  'decor:lanterne': 'hangs',
  'decor:tapis': 'lies',
  'decor:bibliotheque': 'stands',
  'decor:trophee': 'stands',
  'decor:fresque': 'hangs',
  'decor:amphore': 'stands',
  'decor:chouette': 'stands',
  'decor:mosaique': 'hangs',
  'decor:bouclier': 'hangs',
};

/** The trophies' WebPs keep a 6.5 % transparent margin under the base (measured: 0.064-0.066 on all
 *  thirty); the new cut-outs are trimmed to the object (foot 0). */
export const TROPHY_FOOT = 0.065;

/** Each piece's picture in pixels (its WebP's own size; all thirty trophies are 512 px squares), so
 *  the room sizes its box before the file loads: no piece pops in or grows upward from its line.
 *  treasures.test.ts reads every file against it. */
export const PIECE_SIZES: Record<PieceId, { w: number; h: number }> = {
  hydre: { w: 512, h: 512 },
  echo: { w: 512, h: 512 },
  chimere: { w: 512, h: 512 },
  protee: { w: 512, h: 512 },
  sirenes: { w: 512, h: 512 },
  lethe: { w: 512, h: 512 },
  sandales_hermes: { w: 476, h: 512 },
  egide: { w: 494, h: 512 },
  foudre_zeus: { w: 150, h: 512 },
  'decor:lanterne': { w: 231, h: 512 },
  'decor:tapis': { w: 768, h: 132 },
  'decor:bibliotheque': { w: 452, h: 768 },
  'decor:trophee': { w: 434, h: 512 },
  'decor:fresque': { w: 768, h: 361 },
  'decor:amphore': { w: 235, h: 512 },
  'decor:chouette': { w: 292, h: 512 },
  'decor:mosaique': { w: 614, h: 672 },
  'decor:bouclier': { w: 511, h: 512 },
};

/** The box a piece covers in art %, for a picture of `aspect` (height / width) whose base sits
 *  `foot` of its height above its bottom edge (the room's CSS and tools/art/treasure_preview.py). */
export function placeBox(p: Place, aspect: number, foot = 0): Box {
  const h = p.w * aspect * ART_ASPECT;
  return { x: p.x - p.w / 2, y: p.y - h * (1 - foot), w: p.w, h };
}

export interface ShownPiece {
  id: PieceId;
  src: string;
  place: Place;
  pose: Pose;
  foot: number;
  /** Its picture's size in pixels (PIECE_SIZES). */
  size: { w: number; h: number };
  /** The seal of a trophy (1-5), null for the other pieces. */
  level: number | null;
}

const ROOM_PIECES: ReadonlySet<string> = new Set<string>([...GEAR_PIECES, ...DECOR_PIECES]);

/** What the room shows, back to front (a lower bottom edge is nearer, so drawn later): each
 *  lieutenant's highest trophy at its place, at full size, and the gear and decor on display. A
 *  reward with no place in a room (a tint, an accessory, a house, an id that left the catalog) shows
 *  nothing. */
export function shownPieces(house: House, owned: readonly Pick<RewardOut, 'id' | 'equipped'>[]): ShownPiece[] {
  const places = TREASURE_PLACES[house];
  const out: ShownPiece[] = [];
  const highest = highestTrophies([...owned]);
  for (const lt of LIEUTENANT_ORDER) {
    const level = highest[lt];
    const src = level ? trophyIcon(lt, level, true) : null;
    if (level && src) out.push({ id: lt, src, place: places[lt], pose: 'trophy', foot: TROPHY_FOOT, size: PIECE_SIZES[lt], level });
  }
  for (const r of owned) {
    if (!r.equipped || !ROOM_PIECES.has(r.id)) continue;
    const id = r.id as RoomPiece;
    out.push({ id, src: TREASURE_ART[id], place: places[id], pose: POSES[id], foot: 0, size: PIECE_SIZES[id], level: null });
  }
  return out.sort((a, b) => a.place.y - b.place.y);
}
