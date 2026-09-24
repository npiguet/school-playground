// HUD XP laurel data (scenes UI spec §4 "Hud (slim: hero, XP laurel, ...)").
import type { CampResponse } from '../world/types';

export function hudXp(xp: CampResponse['xp']): { label: string; value: number; max: number } {
  const label = `${xp.title} · ${xp.total} XP`;
  if (xp.next_threshold === null) return { label, value: 1, max: 1 };
  return { label, value: xp.total - xp.rank_floor, max: xp.next_threshold - xp.rank_floor };
}
