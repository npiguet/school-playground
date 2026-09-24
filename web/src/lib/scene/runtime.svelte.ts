// Per-stage reactive runtime shared with every scene component through Svelte context: the
// pointer position for parallax, reduced motion, the ?debug flag, and the single "a place is being
// entered" guard.
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
  /** Final review M3: true from a hotspot tap until its navigation fires. One flag per stage, so
   *  two places tapped within the 160 ms flash can never both navigate. */
  activating: boolean;
}

const KEY = Symbol('scene-runtime');
const STATIC: SceneRuntime = { nx: 0, ny: 0, reduced: true, debug: false, artW: 0, artH: 0, activating: false };

export function createSceneRuntime(init: Partial<SceneRuntime> = {}): SceneRuntime {
  const rt = $state<SceneRuntime>({ nx: 0, ny: 0, reduced: false, debug: false, artW: 0, artH: 0, activating: false, ...init });
  return rt;
}

export function provideSceneRuntime(rt: SceneRuntime): void {
  setContext(KEY, rt);
}

export function useSceneRuntime(): SceneRuntime {
  return getContext<SceneRuntime | undefined>(KEY) ?? STATIC;
}
