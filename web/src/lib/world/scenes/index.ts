// Registry of every scene definition.
import type { SceneDef } from '../../scene/types';
import { CABIN_SCENE, PALAIS_SCENE, VILLA_SCENE } from './cabin';
import { CAMP_SCENE } from './camp';
import { DELPHI_SCENE } from './delphi';
import { LIBRARY_SCENE } from './library';
import { NEST_SCENE } from './nest';
import { TITLE_SCENE } from './title';
import { WAR_SCENE } from './war';

/** Scenes UI spec §4: "≤ 600 KB WebP per scene background". */
export const SCENE_BUDGET_BYTES = 600 * 1024;

export const SCENES: SceneDef[] = [CAMP_SCENE, TITLE_SCENE, LIBRARY_SCENE, DELPHI_SCENE, WAR_SCENE, NEST_SCENE, CABIN_SCENE];

/** Spec 2026-09-29 drachmes §3: the cabin place's two other rooms (SCENES keeps the seven places). */
export const HOUSE_SCENES: SceneDef[] = [VILLA_SCENE, PALAIS_SCENE];
