// Hotspot geometry of the hub (hub_camp.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md and checked with `?debug` (UI3 Ruling B3). The nest and the cabin overhang the
// 4:3 safe zone in the art and are clipped at 12.5 / 87.5. The library tent's box starts at its eaves
// (y 42) and the oracle's ends at the upper stairs (y 31), so the oracle's plaque fits between them;
// the war tent's box starts under the spear tips (y 43), so the battle path's plaque fits above it.
// The battle arch's box starts at its top beam (y 21), under the weekly ribbon (Camp.svelte).
// The two overlaps UI3a left open (oracle/parchemins, dossier/cabin labels) are what these bounds and
// the label positions in camp.ts solve; scenes-camp.spec.ts proves labelOverlaps() is empty.
import type { ShapeMap } from '../../scene/types';

export const CAMP_SHAPES = {
  dragon: { kind: 'polygon', points: [[12.5, 44], [23, 42], [25, 50], [24, 66], [12.5, 66]] },
  oracle: { kind: 'polygon', points: [[22.5, 14], [36, 14], [36, 22], [33, 31], [27, 31], [22.5, 22]] },
  parchemins: { kind: 'polygon', points: [[33, 42], [51, 42], [51, 61], [33, 61]] },
  dossier: { kind: 'polygon', points: [[54, 43], [74, 43], [74, 70], [54, 70]] },
  boss: { kind: 'polygon', points: [[65, 21], [75, 21], [75, 33], [65, 33]] },
  cabin: { kind: 'polygon', points: [[76, 56], [86, 54], [87.5, 60], [87.5, 78], [76, 78]] },
} satisfies ShapeMap;
