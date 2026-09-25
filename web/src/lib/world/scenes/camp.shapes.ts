// Hotspot geometry of the camp scene, in art % (0-100) of the 16:9 art frame.
// Authored by hand from docs/art/scenes.md; checked visually with the `?debug` overlay.
import type { ShapeMap } from '../../scene/types';

export const CAMP_SHAPES = {
  // Task 9 review round 2: round 1 shrank dragon/cabin's `ry` to keep a "below" label clear of the
  // dialogue dock, but that also shrinks the *hotspot*, and `CAMP_DRAGON_LAYER` (camp.ts) still
  // draws the sprite at its full, unshrunk y 64-80 (bottom-anchored at 80, scale 9, square art) -
  // the lower ~60 % of the dragon, feet included, stopped being tappable. Both shapes are back to
  // their full, sprite/landmark-matching size; camp.ts moves their labels `on` the landmark
  // instead (ink on the egg / the cabin door) so the dock problem is solved on the label's side,
  // not the hotspot's. `above` was tried instead and rejected: it makes dragon's plaque overlap
  // the parchemins tent's own hotspot and label (checked with `labelOverlaps()`), and dragon has no
  // room to move sideways away from it (already flush with the safe zone's left edge).
  dragon: { kind: 'ellipse', cx: 18, cy: 71, rx: 5, ry: 8.5 },
  oracle: { kind: 'ellipse', cx: 17, cy: 22, rx: 4.5, ry: 7 },
  quests: { kind: 'ellipse', cx: 64, cy: 38, rx: 5, ry: 7 },
  parchemins: { kind: 'ellipse', cx: 30, cy: 53, rx: 7.5, ry: 8 },
  dossier: { kind: 'ellipse', cx: 68.5, cy: 59, rx: 7, ry: 8.5 },
  bestiary: { kind: 'ellipse', cx: 50, cy: 50, rx: 7, ry: 6 },
  cabin: { kind: 'ellipse', cx: 81.5, cy: 64, rx: 6, ry: 10 },
  boss: { kind: 'ellipse', cx: 78, cy: 29, rx: 6, ry: 6 },
} satisfies ShapeMap;
