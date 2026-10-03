// Which dragon stages and which battle foes live (spec 2026-10-02 living dragon, "Rigs"; spec
// 2026-10-03 living battle): those whose rig tools/art/rig.py has baked; the egg never does. Kept
// apart from rigs.ts so the nest, the camp and the battle can ask without loading the living dragon's
// code (lazy.test.ts): the globs below only list the rig files, each one stays its own lazily imported
// chunk.
import type { DragonStage } from '../world/types';
import type { OpponentId } from '../battle/battle';

export const LIVING_STAGES = ['hatchling', 'young', 'adult', 'illustre', 'ancestral'] as const;
export type LivingStage = (typeof LIVING_STAGES)[number];
/** DragonFigure's `data-motion`: loading (the still picture shows), living (the canvas), still. */
export type Motion = 'pending' | 'living' | 'still';

const BAKED = new Set(Object.keys(import.meta.glob('./rig/dragon_*.json')).map((path) => path.slice('./rig/dragon_'.length, -'.json'.length)));

export function livingStage(stage: DragonStage): LivingStage | null {
  return stage !== 'egg' && BAKED.has(stage) ? stage : null;
}

/** The battle's foes with a rig (spec 2026-10-03 living battle, plan Ruling B3): the seven opponents
 *  under their own ids and Éris's routed (flustered) picture. Their portraits are FOE_WIDTH x 1024,
 *  padded, centred, into the 1024 frame (plan Ruling B2). */
export const FOE_RIGS = ['eris', 'eris_flustered', 'hydre', 'chimere', 'echo', 'lethe', 'protee', 'sirenes'] as const;
export type FoeRig = (typeof FOE_RIGS)[number];
export type LivingRig = LivingStage | FoeRig;
export const FOE_WIDTH = 585;
/** A foe's box: its portrait's width over its height (the frame's 1024). */
export const FOE_ASPECT = FOE_WIDTH / 1024;

const BAKED_FOES = new Set(Object.keys(import.meta.glob('./rig/foe_*.json')).map((path) => path.slice('./rig/foe_'.length, -'.json'.length)));

export function isFoeRig(r: string): r is FoeRig {
  return (FOE_RIGS as readonly string[]).includes(r);
}

export function isLivingRig(r: string): r is LivingRig {
  return isFoeRig(r) || (LIVING_STAGES as readonly string[]).includes(r);
}

/** A foe lives once its rig is baked (tools/art/rig.py). */
export function livingFoe(rig: FoeRig): FoeRig | null {
  return BAKED_FOES.has(rig) ? rig : null;
}

/** The rig of the picture the battle shows (plan Ruling B6): Éris routed has her own. */
export function foeRigFor(opponent: OpponentId, flustered: boolean): FoeRig {
  return opponent === 'eris' && flustered ? 'eris_flustered' : opponent;
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
