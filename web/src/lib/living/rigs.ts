// The living dragon's rigs (spec 2026-10-02 living dragon, "Rigs"; plan Ruling R1): the per-vertex
// weights tools/art/rig.py bakes from tools/art/rig.json, one lazily imported chunk per stage. A stage
// lives only once its rig is baked; the egg never does.
import type { DragonStage } from '../world/types';
import type { Pivots } from './pose';
import { BONES, GRID, VERTS, type Bone } from './skin';

export const LIVING_STAGES = ['hatchling', 'young', 'adult', 'illustre', 'ancestral'] as const;
export type LivingStage = (typeof LIVING_STAGES)[number];
/** DragonFigure's `data-motion`: loading (the still picture shows), living (the canvas), still. */
export type Motion = 'pending' | 'living' | 'still';

export interface RigFile {
  stage: string;
  source: string;
  grid: number;
  pivots: Record<Bone, [number, number]>;
  /** The feet box [x0, y0, x1, y1] in frame px: every vertex inside has zero weight. */
  feet: [number, number, number, number];
  /** base64 of VERTS x VERTS x 6 bytes. */
  weights: string;
}

export interface Rig {
  stage: LivingStage;
  pivots: Pivots;
  feet: readonly [number, number, number, number];
  weights: Uint8Array;
}

const FILES = import.meta.glob<RigFile>('./rig/dragon_*.json', { import: 'default' });
const LOADERS = new Map(Object.entries(FILES).map(([path, load]) => [path.slice('./rig/dragon_'.length, -'.json'.length), load]));

export function livingStage(stage: DragonStage): LivingStage | null {
  return stage !== 'egg' && LOADERS.has(stage) ? stage : null;
}

export function decodeRig(f: RigFile): Rig {
  if (f.grid !== GRID) throw new Error(`rig ${f.stage} has a ${f.grid} grid, the game draws ${GRID}`);
  const weights = Uint8Array.from(atob(f.weights), (c) => c.charCodeAt(0));
  if (weights.length !== VERTS * VERTS * BONES.length) throw new Error(`rig ${f.stage} has ${weights.length} weight bytes, not ${VERTS * VERTS * BONES.length}`);
  for (const b of BONES) if (!f.pivots[b]) throw new Error(`rig ${f.stage} has no pivot for ${b}`);
  return { stage: f.stage as LivingStage, pivots: f.pivots, feet: f.feet, weights };
}

const cache = new Map<LivingStage, Promise<Rig>>();

export function loadRig(stage: LivingStage): Promise<Rig> {
  let p = cache.get(stage);
  if (!p) {
    const load = LOADERS.get(stage);
    p = load ? load().then(decodeRig) : Promise.reject(new Error(`no rig for ${stage}`));
    p.catch(() => cache.delete(stage));
    cache.set(stage, p);
  }
  return p;
}
