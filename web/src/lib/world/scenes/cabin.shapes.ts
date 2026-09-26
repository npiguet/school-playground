// Hotspot geometry of the cabin (cabin.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (trophy shelf clipped to x 12.5-41 and below the HUD band; the journal on the
// desk; the lamp and the lyre on the small table) and checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const CABIN_SHAPES = {
  trophies: { kind: 'polygon', points: [[12.5, 14], [40, 14], [40, 64], [12.5, 64]] },
  journal: { kind: 'polygon', points: [[41, 47], [58, 47], [58, 78], [41, 78]] },
  lyre: { kind: 'polygon', points: [[59, 38], [73, 38], [73, 70], [59, 70]] },
} satisfies ShapeMap;
