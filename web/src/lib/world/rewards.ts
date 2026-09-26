// Reward words shared by the places (final review M3, M4): the boss's reward known in advance (SP3
// decisions 9/12) on the hub, the quest wall and the battle screen, and the cabin shelf's count.
import { plural } from '../text/french';
import type { WorldCatalog } from './types';

/** The reward id a boss tier grants, or null (no tier, or the catalog not loaded yet). */
export function bossRewardId(tier: number | null, catalog: WorldCatalog | null): string | null {
  if (tier === null) return null;
  return catalog?.boss_rewards[String(tier)] ?? null;
}

/** The name of the reward a boss tier grants, or a generic phrase. */
export function bossRewardName(tier: number | null, catalog: WorldCatalog | null): string {
  const id = bossRewardId(tier, catalog);
  return (id ? catalog?.rewards[id]?.name : undefined) ?? 'une récompense';
}

/** « 1 trésor », « 2 trésors », « Aucun trésor encore » (the cabin's shelf). */
export function treasureCaption(n: number): string {
  return n <= 0 ? 'Aucun trésor encore' : plural(n, 'trésor', 'trésors');
}
