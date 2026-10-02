// Which dragon stages live (spec 2026-10-02 living dragon, "Rigs"): those whose rig tools/art/rig.py
// has baked; the egg never does. Kept apart from rigs.ts so the nest and the camp can ask without
// loading the living dragon's code (lazy.test.ts): the glob below only lists the rig files, each one
// stays its own lazily imported chunk.
import type { DragonStage } from '../world/types';

export const LIVING_STAGES = ['hatchling', 'young', 'adult', 'illustre', 'ancestral'] as const;
export type LivingStage = (typeof LIVING_STAGES)[number];
/** DragonFigure's `data-motion`: loading (the still picture shows), living (the canvas), still. */
export type Motion = 'pending' | 'living' | 'still';

const BAKED = new Set(Object.keys(import.meta.glob('./rig/dragon_*.json')).map((path) => path.slice('./rig/dragon_'.length, -'.json'.length)));

export function livingStage(stage: DragonStage): LivingStage | null {
  return stage !== 'egg' && BAKED.has(stage) ? stage : null;
}
