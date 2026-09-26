// Registry of every scene definition. UI3b lanes each add their own line inside their fence.
import type { SceneDef } from '../../scene/types';
import { CAMP_SCENE } from './camp';
import { DELPHI_SCENE } from './delphi';
import { LIBRARY_SCENE } from './library';
import { TITLE_SCENE } from './title';
// --- lane W (Task 2): import { WAR_SCENE } from './war';

// --- lane H (Task 4): import { NEST_SCENE } from './nest';

// --- lane H (Task 5): import { CABIN_SCENE } from './cabin';

/** Scenes UI spec §4: "≤ 600 KB WebP per scene background". */
export const SCENE_BUDGET_BYTES = 600 * 1024;

export const SCENES: SceneDef[] = [
  CAMP_SCENE,
  TITLE_SCENE,
  LIBRARY_SCENE,
  DELPHI_SCENE,
  // --- lane W (Task 2): WAR_SCENE,

  // --- lane H (Task 4): NEST_SCENE,

  // --- lane H (Task 5): CABIN_SCENE,
];
