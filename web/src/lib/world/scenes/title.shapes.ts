// Hotspot geometry of the title scene (title_gates.webp), art % of the 16:9 frame, authored by
// hand from docs/art/scenes.md (gate doors x 43-56, y 45-79) and checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const TITLE_SHAPES = {
  gate: { kind: 'polygon', points: [[43, 50], [45.5, 46.5], [49.5, 44.5], [53.5, 46.5], [56, 50], [56, 79], [43, 79]] },
} satisfies ShapeMap;
