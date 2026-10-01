// HUD XP laurel data (scenes UI spec §4 "Hud (slim: hero, XP laurel, ...)"). Spec 2026-09-29 dragon
// growth §2: one gauge, the dragon's: the way to its next stage, named by its stage.
import { gaugeOf, stageLabel } from '../world/dragon';
import { thousands } from '../text/french';
import type { CampResponse, DragonStage } from '../world/types';

export function hudXp(xp: CampResponse['xp'], stage: DragonStage): { label: string; value: number; max: number } {
  return { label: `${stageLabel(stage)} · ${thousands(xp.total)} XP`, ...gaugeOf(xp.total, xp) };
}
