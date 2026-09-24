// Hotspot geometry of the camp scene, in art % (0-100) of the 16:9 art frame.
// Authored by hand from docs/art/scenes.md; checked visually with the `?debug` overlay.
import type { ShapeMap } from '../../scene/types';

export const CAMP_SHAPES = {
  dragon: { kind: 'ellipse', cx: 18, cy: 71, rx: 5, ry: 8.5 },
  oracle: { kind: 'ellipse', cx: 17, cy: 22, rx: 4.5, ry: 7 },
  quests: { kind: 'ellipse', cx: 64, cy: 38, rx: 5, ry: 7 },
  parchemins: { kind: 'ellipse', cx: 30, cy: 53, rx: 7.5, ry: 8 },
  dossier: { kind: 'ellipse', cx: 68.5, cy: 59, rx: 7, ry: 8.5 },
  bestiary: { kind: 'ellipse', cx: 50, cy: 50, rx: 7, ry: 6 },
  cabin: { kind: 'ellipse', cx: 81.5, cy: 64, rx: 6, ry: 10 },
  boss: { kind: 'ellipse', cx: 78, cy: 29, rx: 6, ry: 6 },
} satisfies ShapeMap;
