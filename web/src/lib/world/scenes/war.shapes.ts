// Hotspot geometry of the war tent (war_tent.webp), art % of the 16:9 frame, authored by hand from
// docs/art/scenes.md (six blank sheets: columns x 21.5-27.5 / 30-36 / 39-45, rows y 22-37 / 40-55;
// the map table's hotspot kept above y 78; the lectern and its codex x 69-85) and checked with `?debug`.
import type { ShapeMap } from '../../scene/types';

export const WAR_SHAPES = {
  hydre: { kind: 'polygon', points: [[21.5, 22], [27.5, 22], [27.5, 37], [21.5, 37]] },
  echo: { kind: 'polygon', points: [[30, 22], [36, 22], [36, 37], [30, 37]] },
  chimere: { kind: 'polygon', points: [[39, 22], [45, 22], [45, 37], [39, 37]] },
  protee: { kind: 'polygon', points: [[21.5, 40], [27.5, 40], [27.5, 55], [21.5, 55]] },
  sirenes: { kind: 'polygon', points: [[30, 40], [36, 40], [36, 55], [30, 55]] },
  lethe: { kind: 'polygon', points: [[39, 40], [45, 40], [45, 55], [39, 55]] },
  dossier: { kind: 'polygon', points: [[20, 64], [66, 64], [68, 78], [18, 78]] },
  bestiary: { kind: 'polygon', points: [[69, 42], [85, 42], [85, 78], [69, 78]] },
} satisfies ShapeMap;

/** Not hotspots: areas the tour rings (UI5 playability #10). The wall is the six sheets' bounds. */
export const WAR_TOUR_AREAS = {
  portraits: { kind: 'polygon', points: [[21.5, 22], [45, 22], [45, 55], [21.5, 55]] },
} satisfies ShapeMap;
