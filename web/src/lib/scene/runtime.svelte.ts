// Per-stage reactive runtime shared with every scene component through Svelte context: the
// pointer position for parallax, reduced motion, and the ?debug flag.
import { getContext, setContext } from 'svelte';

export interface SceneRuntime {
  /** Pointer position in [-1, 1] across the viewport (0 = centre). */
  nx: number;
  ny: number;
  reduced: boolean;
  debug: boolean;
  /** The art box's current size in viewport px (SceneStage's `stageBox`), so layers can convert
   *  their art-% parallax offset into a `transform: translate(px, px)`. */
  artW: number;
  artH: number;
}

const KEY = Symbol('scene-runtime');
const STATIC: SceneRuntime = { nx: 0, ny: 0, reduced: true, debug: false, artW: 0, artH: 0 };

export function createSceneRuntime(init: Partial<SceneRuntime> = {}): SceneRuntime {
  const rt = $state<SceneRuntime>({ nx: 0, ny: 0, reduced: false, debug: false, artW: 0, artH: 0, ...init });
  return rt;
}

export function provideSceneRuntime(rt: SceneRuntime): void {
  setContext(KEY, rt);
}

export function useSceneRuntime(): SceneRuntime {
  return getContext<SceneRuntime | undefined>(KEY) ?? STATIC;
}
