// The hero's cabin (scenes UI spec §3 "Cabin scene", UI3 Ruling B6): the trophy shelf (rewards),
// the journal on the desk (stats), the lamp and the lyre (settings). Displayed decor hangs on the
// walls. The hero panel is an overlay here too (Ruling B2, Task 6).
import { SCENE_MUSIC } from '../../audio/catalog';
import { ART } from '../art';
import { st, type Box, type DialogueLine, type HotspotDef, type HotspotShape, type SceneDef } from '../../scene/types';
import { treasureCaption } from '../rewards';
import { HOUSE_NAMES } from '../shop';
import type { DragonOut, House } from '../types';
import { CABIN_SHAPES, PALAIS_SHAPES, VILLA_SHAPES } from './cabin.shapes';
import { dragonSays } from './speakers';
import { sayKey } from '../../dialogue/select';
import { countWord } from '../../text/french';

/** The three places of a room (spec 2026-09-29 drachmes §3: every house keeps them, in its own boxes). */
function houseHotspots(shapes: Record<'trophies' | 'journal' | 'lyre', HotspotShape>): HotspotDef[] {
  return [
    {
      id: 'trophies',
      label: 'Tes trésors',
      target: 'cabin',
      query: { panel: 'tresors' },
      shape: shapes.trophies,
      labelPos: 'below',
      leader: true,
      state: ({ camp }) => st({ caption: camp ? treasureCaption(camp.rewards_count) : null }),
    },
    { id: 'journal', label: 'Ton journal', target: 'stats', shape: shapes.journal, labelPos: 'above', leader: true, state: () => st() },
    { id: 'lyre', label: 'La lyre', target: 'settings', shape: shapes.lyre, labelPos: 'above', leader: true, state: () => st() },
  ];
}

export const CABIN_HOTSPOTS: HotspotDef[] = houseHotspots(CABIN_SHAPES);

export const CABIN_SCENE: SceneDef = {
  id: 'cabin',
  title: HOUSE_NAMES.cabin,
  background: ART.scenes.cabin,
  layers: [],
  hotspots: CABIN_HOTSPOTS,
  ambience: { particles: 'dust', music: SCENE_MUSIC.cabin },
  narrator: { enter: 'cabin.enter', tour: 'cabin' },
  preload: [ART.scenes.hubCamp],
};

/** Spec 2026-09-29 drachmes §3 (R21): the houses bought from Hermès, the cabin place in a richer room. */
export const VILLA_SCENE: SceneDef = { ...CABIN_SCENE, title: HOUSE_NAMES.villa, background: ART.scenes.villa, hotspots: houseHotspots(VILLA_SHAPES) };
export const PALAIS_SCENE: SceneDef = { ...CABIN_SCENE, title: HOUSE_NAMES.palais, background: ART.scenes.palais, hotspots: houseHotspots(PALAIS_SHAPES) };

/** The room of the highest house owned (the camp's `house`). */
export function houseScene(house: House): SceneDef {
  return house === 'palais' ? PALAIS_SCENE : house === 'villa' ? VILLA_SCENE : CABIN_SCENE;
}

/** Bare wall of each room (art %, x = px / 2048, y = px / 1152), measured on the paintings: nothing
 *  painted inside these boxes. */
export const BARE_WALLS: Record<House, Record<string, Box>> = {
  // cabin.webp: no beam, lintel, window frame, shelf, plant, lamp or bed. The ceiling beam's
  // underside is at y ~= 20; the lintels run at y ~= 25-27.5 over x ~= 43.5-58 and 69-83; the left
  // window's frame spans x ~= 46.5-56, the right one's x ~= 71.5-80.5; the room's inner corner is at
  // x ~= 41; the hanging plant ends at y ~= 40 and the pillow starts at y ~= 58 on the right-hand
  // wall (x ~= 81-88). Between the windows: under the beam and above the lamp's chimney (y ~= 38.7);
  // left of the window: between the room's inner corner and the left window, under its lintel; the
  // right wall: under the plant and above the pillow (inside the safe zone).
  cabin: {
    betweenWindows: { x: 56.5, y: 21, w: 12.5, h: 16.5 },
    leftOfWindow: { x: 41.5, y: 28, w: 4.5, h: 16 },
    rightWall: { x: 81.5, y: 41, w: 6, h: 16.5 },
  },
  // villa.webp: the back wall under the frieze (it ends at y ~= 23) between and beside the arched
  // windows (x ~= 48.5-55 and 73-79.5), above the lyre (from y ~= 42); the left wall right of the
  // medals (they end at x ~= 27, y ~= 62) and below them, left of the painted pot (x ~= 29.5-37).
  villa: {
    betweenWindows: { x: 56.5, y: 24, w: 15, h: 16 },
    leftOfLeftWindow: { x: 41.5, y: 25, w: 6, h: 16 },
    rightOfRightWindow: { x: 80, y: 26, w: 6.5, h: 24 },
    rightOfMedals: { x: 32, y: 46, w: 6.5, h: 14 },
    lowerLeftWall: { x: 13, y: 69, w: 15.5, h: 11 },
  },
  // palais.webp: the marble wall over the doorway, between the frieze (it ends at y ~= 15.2) and the
  // door's cornice (it starts at y ~= 20.7), between the columns' shafts (x ~= 37.4-62.6); the 5.5 %
  // band is lower than a medallion (7.2 %), which overlaps each moulding by about 1 %. The left
  // marble wall: left of the medals (their ribbons start at x ~= 20.5) under the lower shelf (its
  // hooks end at y ~= 44.5), and under the shelf's plaque (it ends at y ~= 71.4 at 1280x720), above
  // the red baseboard, whose top edge rises from y ~= 93.7 at x 15 to y ~= 81 at x 25 and ~= 73 at x 30.
  palais: {
    overDoor: { x: 38.2, y: 14.3, w: 23.3, h: 7.4 },
    leftOfMedals: { x: 12.5, y: 45.5, w: 4.5, h: 41.5 },
    lowerLeftWall: { x: 12.6, y: 71.7, w: 13.9, h: 7.6 },
  },
};

/** Where the displayed decor hangs in each room (medallion centres, art %), one piece per slot, each
 *  on its room's BARE_WALLS, clear of the places and their plaques (cabin.test.ts proves it). The
 *  cabin: between the windows above the lyre's plaque (x 60.2: right of the left lintel's end at
 *  x ~= 58), the wall left of the left window, twice on the right-hand wall. */
export const DECOR_SLOTS: Record<House, { x: number; y: number }[]> = {
  cabin: [
    { x: 60.2, y: 27 },
    { x: 84.5, y: 45 },
    { x: 43.8, y: 35 },
    { x: 84.5, y: 53 },
  ],
  villa: [
    { x: 62, y: 31 },
    { x: 44.5, y: 32 },
    { x: 83.3, y: 36 },
    { x: 35.2, y: 53 },
    { x: 17, y: 76 },
    { x: 24, y: 76 },
  ],
  // The palais: over the doorway either side of the room's name (« Ton palais » covers x ~= 43-57,
  // y 9.5-15.6 at 1280x720), a column on the left wall, two more under the shelf's plaque.
  palais: [
    { x: 40.4, y: 18 },
    { x: 59.3, y: 18 },
    { x: 14.7, y: 49.5 },
    { x: 14.7, y: 57 },
    { x: 14.7, y: 64.5 },
    { x: 14.7, y: 75.5 },
    { x: 19.2, y: 75.5 },
    { x: 23.6, y: 75.5 },
    { x: 14.7, y: 83 },
  ],
};

// UI3b playability #7: the cabin is home, and the dragon (the narrator, spec §2.5) speaks here too:
// a greeting once per page load, and a line on the voice plate of the shelf, the journal and the
// lyre (the hero panel is a short menu and has none).

/** The cabin's greeting (UI5 Ruling E12). */
export function cabinGreeting(d: DragonOut): DialogueLine[] {
  return [sayKey('cabin.enter', { dragon: d })];
}

/** The shelf's line (spec 2026-09-29 lieutenant levels §5): the trophies still to win, five per
 *  lieutenant awake (`owned` null while the rewards load). */
export function trophiesLine(d: DragonOut, owned: number | null, max: number): DialogueLine {
  const head = "Chaque sceau que tu gagnes pose un trophée sur l'étagère.";
  if (owned === null) return dragonSays(d, head);
  if (owned >= max) return dragonSays(d, "Tous les sceaux sont gagnés\u202f: l'étagère brille d'orichalque\u202f!");
  if (owned === 0) return dragonSays(d, `${head} Le premier sera en bois\u202f!`);
  const left = max - owned;
  return dragonSays(d, `${head} Il en reste ${countWord(left)} à gagner\u202f!`);
}

export function journalLine(d: DragonOut): DialogueLine {
  return dragonSays(d, 'Ton journal se souvient de chaque texte défendu.');
}

export function lyreLine(d: DragonOut): DialogueLine {
  // UI5 playability #17; Kokoro plan preflight #6: the voice is no longer chosen here.
  return dragonSays(d, "Règle ici la musique, les bruitages et la voix qui te lit la dictée\u202f; les visites du camp et son guide t'attendent aussi.");
}

/** The guide's plate (spec 2026-09-29 explanations §3). */
export function guideLine(d: DragonOut): DialogueLine {
  return dragonSays(d, 'Tout ce que je sais du camp est écrit ici. Relis-le quand tu veux.');
}
