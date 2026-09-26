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

// How to win each reward, said to the player (UI3b playability #13: « Comment l'obtenir :
// Neutraliser la Chimère » was the register of a help page). The pronoun agrees with the reward
// (la crinière, le pavot, les sandales). Mirrors server/app/world/catalog.py REWARDS' `source`.
const HOW_TO_WIN: Record<string, string> = {
  ecaille_hydre: "Neutralise l'Hydre pour la gagner.",
  voix_echo: 'Neutralise Écho pour la gagner.',
  criniere_chimere: 'Neutralise la Chimère pour la gagner.',
  perle_protee: 'Neutralise Protée pour la gagner.',
  plume_sirene: 'Neutralise les Sirènes pour la gagner.',
  pavot_lethe: 'Neutralise Léthé pour le gagner.',
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
