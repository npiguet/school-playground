// Registry of every scene definition (UI3 adds title, library, Delphi, war tent, nest, cabin).
import type { SceneDef } from '../../scene/types';
import { CAMP_SCENE } from './camp';
import { TITLE_SCENE } from './title';

/** Scenes UI spec §4: "≤ 600 KB WebP per scene background". */
export const SCENE_BUDGET_BYTES = 600 * 1024;

export const SCENES: SceneDef[] = [CAMP_SCENE, TITLE_SCENE];
