// Hotspot geometry of the cabin (cabin.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (trophy shelf clipped to x 12.5-41 and below the HUD band; the journal on the
// desk; the lamp and the lyre on the small table) and checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const CABIN_SHAPES = {
  trophies: { kind: 'polygon', points: [[12.5, 14], [40, 14], [40, 64], [12.5, 64]] },
  journal: { kind: 'polygon', points: [[41, 47], [58, 47], [58, 78], [41, 78]] },
  lyre: { kind: 'polygon', points: [[59, 38], [73, 38], [73, 70], [59, 70]] },
} satisfies ShapeMap;

// Spec 2026-09-29 drachmes §3: the villa and the palais keep the cabin's room plan (style guide,
// "Progression redesign, phase 3": landmarks by eye, ±2 %), so the three places keep their roles; each
// room has its own boxes. The villa's shelf box steps in to x 31 below y 44, so the wall right of its
// medals stays free for decor. The journal's box starts at x 40 (the desk at x ~= 37, its book at
// x ~= 43): a place's tappable box is its shape's bounding box, and the shelf's reaches x 40.
export const VILLA_SHAPES = {
  trophies: { kind: 'polygon', points: [[12.5, 14], [40, 14], [40, 44], [31, 44], [31, 62], [12.5, 62]] },
  journal: { kind: 'polygon', points: [[40, 46], [57.5, 46], [57.5, 78], [40, 78]] },
  lyre: { kind: 'polygon', points: [[59, 42], [72.5, 42], [72.5, 72], [59, 72]] },
} satisfies ShapeMap;

// The palais's shelf box steps in to x 19.5 below its lower shelf (y 45), where its medals begin, so
// the bare marble left of them holds decor.
export const PALAIS_SHAPES = {
  trophies: { kind: 'polygon', points: [[12.5, 14], [33.5, 14], [33.5, 62], [19.5, 62], [19.5, 45], [12.5, 45]] },
  journal: { kind: 'polygon', points: [[39, 50], [58, 50], [58, 78], [39, 78]] },
  lyre: { kind: 'polygon', points: [[59.5, 43], [72, 43], [72, 76], [59.5, 76]] },
} satisfies ShapeMap;
