// Hotspot geometry of the hub (hub_camp.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md and checked with `?debug` (UI3 Ruling B3). The nest and the cabin overhang the
// 4:3 safe zone in the art and are clipped at 12.5 / 87.5. The library tent's box starts at its eaves
// (y 42) and the oracle's ends at the upper stairs (y 31), so the oracle's plaque fits between them;
// the war tent's box starts at the spear heads (y 44.5), so the battle path's plaque fits above it
// with its two lines (the locked path's « Encore n ruses », final review M12).
// The battle arch's box starts at its top beam (y 22), under the weekly ribbon (Camp.svelte).
// The two overlaps UI3a left open (oracle/parchemins, dossier/cabin labels) are what these bounds and
// the label positions in camp.ts solve; scenes-camp.spec.ts proves labelOverlaps() is empty.
import type { ShapeMap } from '../../scene/types';

export const CAMP_SHAPES = {
  dragon: { kind: 'polygon', points: [[12.5, 44], [23, 42], [25, 50], [24, 66], [12.5, 66]] },
  oracle: { kind: 'polygon', points: [[22.5, 14], [36, 14], [36, 22], [33, 31], [27, 31], [22.5, 22]] },
  parchemins: { kind: 'polygon', points: [[33, 42], [51, 42], [51, 61], [33, 61]] },
  dossier: { kind: 'polygon', points: [[54, 44.5], [74, 44.5], [74, 70], [54, 70]] },
  boss: { kind: 'polygon', points: [[65, 22], [75, 22], [75, 33], [65, 33]] },
  // The roof line: the left eave at y 61, rising to the ridge (x 86, y 54.5); its plaque is inked on
  // the wall (camp.ts), so nothing of the cabin hangs on the olive tree above it (Task 7 review).
  cabin: { kind: 'polygon', points: [[76, 61], [86, 54.5], [87.5, 55], [87.5, 78], [76, 78]] },
} satisfies ShapeMap;
