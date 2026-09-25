// Hotspot geometry of the camp scene, in art % (0-100) of the 16:9 art frame.
// Authored by hand from docs/art/scenes.md; checked visually with the `?debug` overlay.
import type { ShapeMap } from '../../scene/types';

export const CAMP_SHAPES = {
  // Task 9 review round 1: dragon and cabin reach the ground low enough that a "below" label with
  // a caption (always 2 lines: name + activity/treasure count) landed inside the DialogueBox's own
  // dock (y 80-100 %) - dragon substantially, cabin by a few px. Their tops (cy - ry) are kept
  // exactly where they were (62.5 % / 54 %) - that's what already cleared their neighbours (the
  // parchemins tent above the dragon, the war tent above the cabin) - only ry shrinks, pulling the
  // bottom (and so the label) up clear of the dock at both 1280x720 and 1180x820. Re-checked with
  // `?debug`: the reduced dragon ellipse still centres on the egg's upper body.
  dragon: { kind: 'ellipse', cx: 18, cy: 66.5, rx: 5, ry: 4 },
  oracle: { kind: 'ellipse', cx: 17, cy: 22, rx: 4.5, ry: 7 },
  quests: { kind: 'ellipse', cx: 64, cy: 38, rx: 5, ry: 7 },
  parchemins: { kind: 'ellipse', cx: 30, cy: 53, rx: 7.5, ry: 8 },
  dossier: { kind: 'ellipse', cx: 68.5, cy: 59, rx: 7, ry: 8.5 },
  bestiary: { kind: 'ellipse', cx: 50, cy: 50, rx: 7, ry: 6 },
  cabin: { kind: 'ellipse', cx: 81.5, cy: 62, rx: 6, ry: 8 },
  boss: { kind: 'ellipse', cx: 78, cy: 29, rx: 6, ry: 6 },
} satisfies ShapeMap;
