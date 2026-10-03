// The hero's house (scenes UI spec §3 "Cabin scene", UI3 Ruling B6): « Tes trésors » (rewards),
// the journal on the desk (stats) and the lyre (settings). Every trophy, piece of gear and decor on
// display stands at its own place in the room (spec 2026-10-02 house treasures, treasures.ts). The
// hero panel is an overlay here too (Ruling B2, Task 6).
import { SCENE_MUSIC } from '../../audio/catalog';
import { ART } from '../art';
import { st, type DialogueLine, type HotspotDef, type HotspotShape, type LabelPos, type SceneDef } from '../../scene/types';
import { treasureCaption } from '../rewards';
import { HOUSE_NAMES } from '../shop';
import type { DragonOut, House } from '../types';
import { CABIN_SHAPES, HOUSE_LABELS, PALAIS_SHAPES, VILLA_SHAPES, type HousePlace } from './cabin.shapes';
import { dragonSays } from './speakers';
import { sayKey } from '../../dialogue/select';
import { countWord } from '../../text/french';

/** The three places of a room (spec 2026-09-29 drachmes §3: every house keeps them, in its own boxes),
 *  each plaque on its house's side (spec 2026-10-02 house treasures: the journal's goes below where
 *  the lanterne hangs above the desk). */
function houseHotspots(shapes: Record<HousePlace, HotspotShape>, labels: Record<HousePlace, LabelPos>): HotspotDef[] {
  return [
    {
      id: 'trophies',
      label: 'Tes trésors',
      target: 'cabin',
      query: { panel: 'tresors' },
      shape: shapes.trophies,
      labelPos: labels.trophies,
      leader: true,
      state: ({ camp }) => st({ caption: camp ? treasureCaption(camp.rewards_count) : null }),
    },
    { id: 'journal', label: 'Ton journal', target: 'stats', shape: shapes.journal, labelPos: labels.journal, leader: true, state: () => st() },
    { id: 'lyre', label: 'La lyre', target: 'settings', shape: shapes.lyre, labelPos: labels.lyre, leader: true, state: () => st() },
  ];
}

export const CABIN_HOTSPOTS: HotspotDef[] = houseHotspots(CABIN_SHAPES, HOUSE_LABELS.cabin);

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
export const VILLA_SCENE: SceneDef = { ...CABIN_SCENE, title: HOUSE_NAMES.villa, background: ART.scenes.villa, hotspots: houseHotspots(VILLA_SHAPES, HOUSE_LABELS.villa) };
export const PALAIS_SCENE: SceneDef = { ...CABIN_SCENE, title: HOUSE_NAMES.palais, background: ART.scenes.palais, hotspots: houseHotspots(PALAIS_SHAPES, HOUSE_LABELS.palais) };

/** The room of the highest house owned (the camp's `house`). */
export function houseScene(house: House): SceneDef {
  return house === 'palais' ? PALAIS_SCENE : house === 'villa' ? VILLA_SCENE : CABIN_SCENE;
}

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
