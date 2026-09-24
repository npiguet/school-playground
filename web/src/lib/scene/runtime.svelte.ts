// Per-stage reactive runtime shared with every scene component through Svelte context: the
// pointer position for parallax, reduced motion, and the ?edit flag.
import { getContext, setContext } from 'svelte';

export interface SceneRuntime {
  /** Pointer position in [-1, 1] across the viewport (0 = centre). */
  nx: number;
  ny: number;
  reduced: boolean;
  editing: boolean;
}

const KEY = Symbol('scene-runtime');
const STATIC: SceneRuntime = { nx: 0, ny: 0, reduced: true, editing: false };

export function createSceneRuntime(init: Partial<SceneRuntime> = {}): SceneRuntime {
  const rt = $state<SceneRuntime>({ nx: 0, ny: 0, reduced: false, editing: false, ...init });
  return rt;
}

export function provideSceneRuntime(rt: SceneRuntime): void {
  setContext(KEY, rt);
}

export function useSceneRuntime(): SceneRuntime {
  return getContext<SceneRuntime | undefined>(KEY) ?? STATIC;
}
