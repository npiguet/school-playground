// Hotspot geometry of the dragon's nest, one painting per stage (nest_<stage>.webp, spec 2026-10-02
// nest by stage), art % of the 16:9 frame: an ellipse on the dragon's body (head to belly) at its
// place in NEST_STAGES (nest.ts), its bottom 10 % above the dialogue dock so the « Ton dragon »
// plaque hangs clear of it. Tuned with tools/art/nest_preview.py and checked with `?debug`.
import type { DragonStage } from '../types';
import type { EllipseShape } from '../../scene/types';

export const NEST_SHAPES: Record<DragonStage, { dragon: EllipseShape }> = {
  egg: { dragon: { kind: 'ellipse', cx: 50, cy: 40, rx: 7, ry: 14 } },
  hatchling: { dragon: { kind: 'ellipse', cx: 50, cy: 36.5, rx: 9.5, ry: 18.5 } },
  young: { dragon: { kind: 'ellipse', cx: 51.5, cy: 37, rx: 13, ry: 23 } },
  adult: { dragon: { kind: 'ellipse', cx: 44, cy: 40, rx: 15, ry: 22 } },
  illustre: { dragon: { kind: 'ellipse', cx: 44, cy: 42, rx: 17, ry: 24 } },
  ancestral: { dragon: { kind: 'ellipse', cx: 44, cy: 42.5, rx: 20, ry: 27.5 } },
};
