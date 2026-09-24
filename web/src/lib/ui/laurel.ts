// The laurel XP bar (scenes UI spec §6): a branch of LAUREL_LEAVES leaves that light up toward
// the next rank. Rounds down, so the last leaf only lights when the rank is actually reached.
export const LAUREL_LEAVES = 10;

export function laurelLeaves(value: number, max: number, total = LAUREL_LEAVES): number {
  if (max <= 0) return total;
  const ratio = Math.min(1, Math.max(0, value / max));
  return Math.floor(ratio * total);
}
