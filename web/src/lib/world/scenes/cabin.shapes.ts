// Hotspot geometry of the three rooms (spec 2026-10-02 house treasures: repainted straight-on),
// art % of the 16:9 frame, measured on a 1 % grid (docs/art/scenes.md, tools/art/grid.py) and
// checked with `?debug`: « Tes trésors » around the cupboard, the journal around the desk, the
// lyre around its stool or stand. The pieces' places (treasure-places.json) stay clear of them and
// of their plaques (treasures.test.ts), but for the trophies and the gear, which stand in the
// cupboard: it is the « Tes trésors » place itself. tools/art/treasure_preview.py reads this file
// (the `points` lists and HOUSE_LABELS, in this layout), so its --check runs on these very values.
import type { LabelPos, ShapeMap } from '../../scene/types';
import type { House } from '../types';

export const CABIN_SHAPES = {
  trophies: { kind: 'polygon', points: [[29.5, 14], [70.5, 14], [70.5, 80], [29.5, 80]] },
  journal: { kind: 'polygon', points: [[12.5, 52], [17, 52], [17, 68], [12.5, 68]] },
  lyre: { kind: 'polygon', points: [[71, 52], [82.5, 52], [82.5, 80], [71, 80]] },
} satisfies ShapeMap;

// The villa's cupboard place starts at x 28, inside its left pillar (x 25-29): at 1024x640 the journal's
// plaque, pushed right by the safe zone's edge, reaches x ~= 26.1 (ruling H8 fix round).
export const VILLA_SHAPES = {
  trophies: { kind: 'polygon', points: [[28, 18], [74.5, 18], [74.5, 80], [28, 80]] },
  journal: { kind: 'polygon', points: [[13, 57], [25.5, 57], [25.5, 70], [13, 70]] },
  lyre: { kind: 'polygon', points: [[75, 55], [84, 55], [84, 75], [75, 75]] },
} satisfies ShapeMap;

// The palais's cupboard place ends at x 71, inside its right pillar (x 69.5-73): at 1024x640 the
// lyre's plaque above reaches left to x ~= 71.75 (ruling H8 fix round).
export const PALAIS_SHAPES = {
  trophies: { kind: 'polygon', points: [[27.5, 14], [71, 14], [71, 75], [27.5, 75]] },
  journal: { kind: 'polygon', points: [[13, 54], [27, 54], [27, 66], [13, 66]] },
  lyre: { kind: 'polygon', points: [[73, 54], [80, 54], [80, 75], [73, 75]] },
} satisfies ShapeMap;

export type HousePlace = 'trophies' | 'journal' | 'lyre';

/** Each place's plaque side, per house: the journal's plaque goes below in the villa and the
 *  palais, where the lanterne hangs from the hook above the desk; above in the cabin. */
export const HOUSE_LABELS: Record<House, Record<HousePlace, LabelPos>> = {
  cabin: { trophies: 'below', journal: 'above', lyre: 'above' },
  villa: { trophies: 'below', journal: 'below', lyre: 'above' },
  palais: { trophies: 'below', journal: 'below', lyre: 'above' },
};
