// The hero's cabin (scenes UI spec §3 "Cabin scene", UI3 Ruling B6): the trophy shelf (rewards),
// the journal on the desk (stats), the lamp and the lyre (settings). Displayed decor hangs on the
// walls. The hero panel is an overlay here too (Ruling B2, Task 6).
import { ART } from '../art';
import { IDLE_HOTSPOT, type HotspotDef, type HotspotState, type SceneDef } from '../../scene/types';
import { treasureCaption } from './camp';
import { CABIN_SHAPES } from './cabin.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

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
  ambience: { particles: 'dust', music: null },
  narrator: { enter: 'cabin.enter', firstVisit: 'cabin.first' },
  preload: [ART.scenes.hubCamp],
};

/** Free wall spots for the displayed decor (medallion centres, art %): the back wall between the
 *  windows, the right-hand wall, the wall above the desk. Cycled if more decor is displayed. */
export const DECOR_SLOTS: { x: number; y: number }[] = [
  { x: 63.5, y: 22 },
  { x: 80, y: 26 },
  { x: 80, y: 42 },
  { x: 46, y: 30 },
];
