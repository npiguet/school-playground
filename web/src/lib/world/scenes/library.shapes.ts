// Hotspot geometry of the library tent (library_tent.webp), art % of the 16:9 frame, authored by
// hand from docs/art/scenes.md and checked with `?debug`. The desk stops at x 46 (controller
// ruling U6): the brief's original x 46.5 made the lens plaque and the desk labels overlap in
// `labelOverlaps` at 1280x720 and 1180x820, once the plaques actually render (not just their data
// boxes). Its y 64 is a deliberate crop for the same reason - the painted landmark reaches y 71
// (docs/art/scenes.md: desk box x 33-49, y 36-71) - checked visually with `?debug` at both sizes.
// Four objects share ~60 % of the width, so the plaques are short (« Le pupitre »...) and
// staggered: shelves and desk above, lens and portal below.
import type { ShapeMap } from '../../scene/types';

export const LIBRARY_SHAPES = {
  shelves: { kind: 'polygon', points: [[17, 19], [32, 19], [32, 74], [17, 74]] },
  desk: { kind: 'polygon', points: [[33.5, 45], [40.5, 40], [46, 43], [46, 64], [33.5, 64]] },
  lens: { kind: 'ellipse', cx: 52.5, cy: 49.5, rx: 5.5, ry: 16.5 },
  portal: { kind: 'polygon', points: [[61, 64], [61, 31], [64, 25], [68.5, 22], [73, 25], [76, 31], [76, 64]] },
} satisfies ShapeMap;
