// Reward words shared by the places (final review M3, M4): the boss's reward known in advance (SP3
// decisions 9/12) on the hub, the quest wall and the battle screen, and the cabin shelf's count.
import { rulesOf } from '../rules';
import { plural } from '../text/french';
import { drachmesText } from './shop';
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
 *  2026-09-29 lieutenant levels §4) and its drachmes (spec 2026-09-29 drachmes §1), or a generic
 *  phrase while the catalog loads. */
export function bossRewardName(tier: number | null, catalog: WorldCatalog | null): string {
  const id = bossRewardId(tier, catalog);
  const name = id ? catalog?.rewards[id]?.name : undefined;
  if (name) return name;
  if (tier !== null && catalog && !id) {
    const coins = rulesOf(catalog).drachmes.boss;
    return coins > 0 ? `${catalog.quest_bonus.boss} XP et ${drachmesText(coins)}` : `${catalog.quest_bonus.boss} XP`;
  }
  return 'une récompense';
}

/** « 150 XP » for a quest bonus the server serves (`quest_bonus[key]`), or '' before the catalogue
 *  has come: the client keeps no copy of the rule (SP4 final review M8). */
export function questXpText(catalog: WorldCatalog | null, key: string): string {
  const xp = catalog?.quest_bonus[key];
  return typeof xp === 'number' ? `${xp} XP` : '';
}

/** `rest` led by the served bonus (« 60 XP et rest »); just `rest` while there is no number to say. */
export function withQuestXp(catalog: WorldCatalog | null, key: string, rest: string): string {
  const xp = questXpText(catalog, key);
  if (!xp) return rest;
  return rest ? `${xp} et ${rest}` : xp;
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
  'decor:trophee': 'Termine huit quêtes du mur pour la gagner.',
  'decor:fresque': "Termine une sixième quête de l'Oracle pour la gagner.",
  // Spec 2026-09-29 drachmes §2: Hermès's decor, bought at his stall.
  'decor:amphore': 'Hermès la vend à son étal.',
  'decor:chouette': 'Hermès la vend à son étal.',
  'decor:mosaique': 'Hermès la vend à son étal.',
  'decor:bouclier': 'Hermès le vend à son étal.',
};

/** How to win a reward, as a sentence to the player (the catalog's own words for an unknown id).
 *  Module-private (final review M11): callers go through `howToEarn`, which knows the next fight. */
function howToWin(id: string, source: string): string {
  return HOW_TO_WIN[id] ?? `À gagner\u202f: ${source.charAt(0).toLowerCase()}${source.slice(1)}.`;
}

/** The reward ids that have a sentence (the catalog's, rewards.test.ts). */
export const HOW_TO_WIN_IDS = Object.keys(HOW_TO_WIN);

// The divine gear agrees with its pronoun (les sandales, l'égide, la foudre).
const GEAR_THEM: Record<string, string> = { sandales_hermes: 'les', egide: 'la', foudre_zeus: 'la' };

/** The fight whose reward is the next to win (spec 2026-09-29 explanations §4, R13): the lowest tier of
 *  the ladder not won yet; null once every fight is won or without the camp. */
export function nextFightTier(camp: Pick<CampResponse, 'boss'> | null): number | null {
  if (!camp) return null;
  for (let t = 1; t <= camp.boss.fights; t++) if (!camp.boss.tiers_won.includes(t)) return t;
  return null;
}

/** How to earn a reward not owned yet (spec §4): the next fight's gear says so; the rest keeps its sentence. */
export function howToEarn(id: string, source: string, o: { nextTier: number | null; catalog: WorldCatalog | null }): string {
  const tier = Object.entries(o.catalog?.boss_rewards ?? {}).find(([, rid]) => rid === id)?.[0];
  if (tier !== undefined && o.nextTier !== null && Number(tier) === o.nextTier) {
    return `Gagne le prochain combat contre Éris pour ${GEAR_THEM[id] ?? 'le'} gagner.`;
  }
  return howToWin(id, source);
}
