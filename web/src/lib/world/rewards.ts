// Reward words shared by the places (final review M3, M4): the boss's reward known in advance (SP3
// decisions 9/12) on the hub, the quest wall and the battle screen, and the cabin shelf's count.
import { plural } from '../text/french';
import type { CampResponse, WorldCatalog } from './types';

/** The fight on offer or under way: the tier open, else the active boss quest's (an old fight resumed
 *  after migration 006 has no tier open). Null when Éris hides. Shared by the wall and the battle screen. */
export function bossTier(camp: CampResponse | null): number | null {
  if (!camp) return null;
  return camp.boss.tier_available ?? camp.quests.find((q) => q.kind === 'boss' && q.status === 'active')?.goal.tier ?? null;
}

/** The reward id a boss tier grants, or null (no tier, or the catalog not loaded yet). */
export function bossRewardId(tier: number | null, catalog: WorldCatalog | null): string | null {
  if (tier === null) return null;
  return catalog?.boss_rewards[String(tier)] ?? null;
}

/** The name of the reward a boss tier grants: the gear of the first three fights, then its XP (spec
 *  2026-09-29 lieutenant levels §4), or a generic phrase while the catalog loads. */
export function bossRewardName(tier: number | null, catalog: WorldCatalog | null): string {
  const id = bossRewardId(tier, catalog);
  const name = id ? catalog?.rewards[id]?.name : undefined;
  if (name) return name;
  if (tier !== null && catalog && !id) return `${catalog.quest_bonus.boss} XP`;
  return 'une récompense';
}

/** « 1 trésor », « 2 trésors », « Aucun trésor encore » (the cabin's shelf). */
export function treasureCaption(n: number): string {
  return n <= 0 ? 'Aucun trésor encore' : plural(n, 'trésor', 'trésors');
}

// How to win each reward, said to the player (UI3b playability #13: said to the player, the
// pronoun agreed with the reward: la teinte, les sandales, le tapis). Mirrors server/app/world/catalog.py REWARDS' `source`.
const HOW_TO_WIN: Record<string, string> = {
  'tint:ecume': "Gagne-la dans une quête de l'Oracle.",
  'tint:olivier': "Gagne-la dans une quête de l'Oracle.",
  'tint:braise': "Gagne-la dans une quête de l'Oracle.",
  'tint:jade': "Gagne-la dans une quête de l'Oracle.",
  'tint:argent': "Gagne-la dans une quête de l'Oracle.",
  sandales_hermes: 'Bats Éris une première fois pour les gagner.',
  egide: 'Bats Éris une deuxième fois pour la gagner.',
  foudre_zeus: 'Bats Éris une troisième fois pour la gagner.',
  'decor:lanterne': 'Termine deux quêtes du mur pour la gagner.',
  'decor:tapis': 'Termine quatre quêtes du mur pour le gagner.',
  'decor:bibliotheque': 'Termine six quêtes du mur pour la gagner.',
  'decor:trophee': 'Termine huit quêtes du mur pour le gagner.',
  'decor:fresque': "Termine une sixième quête de l'Oracle pour la gagner.",
};

/** How to win a reward, as a sentence to the player (the catalog's own words for an unknown id). */
export function howToWin(id: string, source: string): string {
  return HOW_TO_WIN[id] ?? `À gagner\u202f: ${source.charAt(0).toLowerCase()}${source.slice(1)}.`;
}

/** The reward ids that have a sentence (the catalog's, rewards.test.ts). */
export const HOW_TO_WIN_IDS = Object.keys(HOW_TO_WIN);
