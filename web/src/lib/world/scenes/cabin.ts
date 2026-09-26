// The hero's cabin (scenes UI spec §3 "Cabin scene", UI3 Ruling B6): the trophy shelf (rewards),
// the journal on the desk (stats), the lamp and the lyre (settings). Displayed decor hangs on the
// walls. The hero panel is an overlay here too (Ruling B2, Task 6).
import { SCENE_MUSIC } from '../../audio/catalog';
import { ART } from '../art';
import { st, type DialogueLine, type HotspotDef, type SceneDef } from '../../scene/types';
import { treasureCaption } from '../rewards';
import type { DragonOut } from '../types';
import { CABIN_SHAPES } from './cabin.shapes';
import { dragonSays } from './speakers';

export const CABIN_HOTSPOTS: HotspotDef[] = [
  {
    id: 'trophies',
    label: 'Tes trésors',
    target: 'cabin',
    query: { panel: 'tresors' },
    shape: CABIN_SHAPES.trophies,
    labelPos: 'below',
    leader: true,
    state: ({ camp }) => st({ caption: camp ? treasureCaption(camp.rewards_count) : null }),
  },
  { id: 'journal', label: 'Ton journal', target: 'stats', shape: CABIN_SHAPES.journal, labelPos: 'above', leader: true, state: () => st() },
  { id: 'lyre', label: 'La lyre', target: 'settings', shape: CABIN_SHAPES.lyre, labelPos: 'above', leader: true, state: () => st() },
];

export const CABIN_SCENE: SceneDef = {
  id: 'cabin',
  title: 'Ta cabane',
  background: ART.scenes.cabin,
  layers: [],
  hotspots: CABIN_HOTSPOTS,
  ambience: { particles: 'dust', music: SCENE_MUSIC.cabin },
  narrator: { enter: 'cabin.enter', firstVisit: 'cabin.first' },
  preload: [ART.scenes.hubCamp],
};

/** The bare whitewashed wall of cabin.webp (art %, x = px / 2048, y = px / 1152), measured on the
 *  painting: nothing painted inside these rectangles (no beam, lintel, window frame, shelf, plant,
 *  lamp or bed). The ceiling beam's underside is at y ~= 20; the lintels run at y ~= 25-27.5 over
 *  x ~= 43.5-58 and 69-83; the left window's frame spans x ~= 46.5-56, the right one's x ~= 71.5-80.5;
 *  the room's inner corner is at x ~= 41; the hanging plant ends at y ~= 40 and the pillow starts at
 *  y ~= 58 on the right-hand wall (x ~= 81-88). */
export const BARE_WALL = {
  /** Between the windows, under the beam and above the lamp's chimney (y ~= 38.7). */
  betweenWindows: { x: 56.5, y: 21, w: 12.5, h: 16.5 },
  /** Between the room's inner corner and the left window, under its lintel. */
  leftOfWindow: { x: 41.5, y: 28, w: 4.5, h: 16 },
  /** The right-hand wall, under the plant and above the pillow (inside the safe zone). */
  rightWall: { x: 81.5, y: 41, w: 6, h: 16.5 },
} as const;

/** Where the displayed decor hangs (medallion centres, art %), each on BARE_WALL and clear of the
 *  lyre's and the journal's plaques (the lyre's sits at x ~= 62.5-69.5 above its lamp): left of the
 *  lyre's leader between the windows, the wall left of the left window, twice on the right-hand
 *  wall. One piece per slot: the walls hold MAX_DISPLAYED_DECOR pieces (below). */
export const DECOR_SLOTS: { x: number; y: number }[] = [
  { x: 60, y: 31 },
  { x: 84.5, y: 45 },
  { x: 43.8, y: 35 },
  { x: 84.5, y: 53 },
];

/** The walls hold one piece per slot (UI3b ruling): a fifth piece would hang over the first. The
 *  server refuses it too (409, `MAX_DISPLAYED_DECOR` and the same line in server/app/routers/world.py). */
export const MAX_DISPLAYED_DECOR = DECOR_SLOTS.length;
export const WALLS_FULL_LINE = "Les murs sont pleins : range d'abord une pièce.";

// UI3b playability #7: the cabin is home, and the dragon (the narrator, spec §2.5) speaks here too:
// a greeting once per page load, and a line on the voice plate of the shelf, the journal and the
// lyre (the hero panel is a short menu and has none).

/** The cabin's greeting. */
export function cabinGreeting(d: DragonOut): DialogueLine[] {
  return [dragonSays(d, 'Ta cabane. Tout ce que tu as gagné est rangé ici.')];
}

const COUNT_WORDS = ['', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six'];

/** The shelf's line: how many relics are still to win (`missing` null while the rewards load). */
export function trophiesLine(d: DragonOut, missing: number | null): DialogueLine {
  if (missing === null) return dragonSays(d, 'Chaque ruse neutralisée laisse une relique.');
  if (missing <= 0) return dragonSays(d, 'Chaque ruse neutralisée a laissé sa relique : elles sont toutes là !');
  const n = COUNT_WORDS[missing] ?? String(missing);
  return dragonSays(d, `Chaque ruse neutralisée laisse une relique. Il en manque encore ${n} !`);
}

export function journalLine(d: DragonOut): DialogueLine {
  return dragonSays(d, 'Ton journal se souvient de chaque texte défendu.');
}

export function lyreLine(d: DragonOut): DialogueLine {
  return dragonSays(d, 'Ici, tu choisis la voix qui te lit la dictée, et si le camp fait du bruit.');
}
