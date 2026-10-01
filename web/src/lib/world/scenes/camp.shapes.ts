// Hotspot geometry of the hub (hub_camp.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md and checked with `?debug` (UI3 Ruling B3). The nest and the cabin overhang the
// 4:3 safe zone in the art and are clipped at 12.5 / 87.5. The library tent's box starts at its eaves
// (y 42) and the oracle's ends at the upper stairs (y 31), so the oracle's plaque fits between them;
// the war tent's box starts at y 44 (UI3b ruling B-d: back up by half a point from 44.5, toward its
// spear tips at 43; the battle path's two-line plaque now slides right of the finial, camp.ts
// `labelDx`, but at 1280x720 the locked plaque, its lock icon and its caption still reach y ~43.3,
// so the full 43 would put it on the tent's box - scenes-camp.spec.ts labelOverlaps).
// The battle arch's box starts at its top beam (y 22), under the weekly ribbon (Camp.svelte).
// The cabin's box ends at the middle of its door (y 72.5), where the leader pins its plaque: the
// plaque hangs over the door's foot, above the dialogue dock (y 80+) at every tested size.
// The two overlaps UI3a left open (oracle/parchemins, dossier/cabin labels) are what these bounds and
// the label positions in camp.ts solve; scenes-camp.spec.ts proves labelOverlaps() is empty.
// Hermès's stall (sub-project 4, `hub_camp.webp` now carries it; style guide phase 3: box x 10.5-21.8,
// y 20.8-44.8) is clipped to the iPad safe zone on the left and ends at y 40, above the dragon's head,
// which covers the counter below (R18). Its name is inked on the counter (camp.ts, `on`), and the
// temple's plaque slides right off it (camp.ts `labelDx`). The counter's foot (y 40-44.8) is not the
// stall's: the nest's box keeps its top at y 42-44 there, since the grown dragon's head is drawn over
// the counter's foot and a tap on the dragon belongs to the nest (Task 5 review, minor 1: kept).
import type { ShapeMap } from '../../scene/types';

export const CAMP_SHAPES = {
  dragon: { kind: 'polygon', points: [[12.5, 44], [23, 42], [25, 50], [24, 66], [12.5, 66]] },
  stall: { kind: 'polygon', points: [[12.5, 21], [21.8, 21], [21.8, 40], [12.5, 40]] },
  oracle: { kind: 'polygon', points: [[22.5, 14], [36, 14], [36, 22], [33, 31], [27, 31], [22.5, 22]] },
  parchemins: { kind: 'polygon', points: [[33, 42], [51, 42], [51, 61], [33, 61]] },
  dossier: { kind: 'polygon', points: [[54, 44], [74, 44], [74, 70], [54, 70]] },
  boss: { kind: 'polygon', points: [[65, 22], [75, 22], [75, 33], [65, 33]] },
  // The roof line: the left eave at y 61, rising to the ridge (x 86, y 54.5), down to the middle of
  // the door; its plaque hangs below, pinned there (camp.ts), so nothing of the cabin hangs on the
  // olive tree above it (Task 7 review) and the tap reaches the door and the plaque alike.
  cabin: { kind: 'polygon', points: [[76, 61], [86, 54.5], [87.5, 55], [87.5, 72.5], [76, 72.5]] },
} satisfies ShapeMap;
