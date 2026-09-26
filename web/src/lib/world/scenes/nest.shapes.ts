// Hotspot geometry of the dragon's nest (nest.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (dragon spot x 34-68, y 30-66; feet at about y 62, centred at x 50) and
// checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const NEST_SHAPES = {
  dragon: { kind: 'ellipse', cx: 51, cy: 47, rx: 17, ry: 19 },
} satisfies ShapeMap;
