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

let webgl2: boolean | null = null;

/** Whether this browser gives a WebGL2 context, asked once for the session (living-dragon final
 *  review): without one, DragonFigure goes straight to the still picture, never loading the living
 *  dragon's chunk, its rig and its sprite only to fail. The probe's canvas is 1 px and dropped; a
 *  later failure (a shader, a lost context) still falls back in LivingDragon itself. */
export function hasWebGL2(): boolean {
  if (webgl2 === null) {
    try {
      const probe = document.createElement('canvas');
      probe.width = 1;
      probe.height = 1;
      webgl2 = probe.getContext('webgl2') !== null;
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}
