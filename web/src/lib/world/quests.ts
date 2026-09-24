// Pure quest label helpers (Task 7): the title/progress/reward strings shown on QuestCard, the
// Delphes Oracle screen and the quest board. Kept free of DOM/store access so they stay trivially
// unit-testable (brief step 1) and reusable across the three screens that render a quest.
import type { QuestOut, WorldCatalog } from './types';

// A leading French article on a monster's name ("L'Hydre", "Les Sirènes") reads oddly capitalised
// mid-sentence ("Tenir L'Hydre en échec") - lower-case it, same rule for every article.
const LEADING_ARTICLE = /^(L'|La |Le |Les )/;

// Exported so screens that build their own quest label from a differently-shaped quest object
// (e.g. `ProgressionReveal.svelte`'s `Progression['quests']`, which has no `QuestOut.goal.tier`)
// still lower the article the same way instead of re-deriving the regex.
export function lowerLeadingArticle(name: string): string {
  return name.replace(LEADING_ARTICLE, (m) => m.toLowerCase());
}

const ROMAN_TIERS = ['', 'I', 'II', 'III', 'IV', 'V'];

/** Roman numeral for a boss tier (1 -> 'I', 2 -> 'II', 3 -> 'III', ...). */
export function romanTier(n: number): string {
  return ROMAN_TIERS[n] ?? String(n);
}

/** A quest's display title. `names` maps a lieutenant key (and, for boss quests, `'eris'`) to its
 *  French name - callers usually build it from the world catalog or the camp's lieutenant list. */
export function questTitle(q: QuestOut, names: Record<string, string>): string {
  if (q.kind === 'boss') {
    const name = names.eris ?? 'Éris';
    return `Combat contre ${name} (${romanTier(q.goal.tier ?? 1)})`;
  }
  const name = names[q.target] ?? q.target;
  if (q.kind === 'oracle') return `Rouleau de l'Oracle : ${name}`;
  return `Tenir ${lowerLeadingArticle(name)} en échec`;
}

/** The progress caption under a quest's gauge: a session count for board/Oracle quests, a fixed
 *  line for the single-session boss fight (spec: no gamble, no fake progress bar for one fight). */
export function questProgressLabel(q: QuestOut): string {
  if (q.kind === 'boss') return 'Un combat';
  return `${q.progress.sessions} / ${q.goal.sessions ?? 3} textes`;
}

/** The reward line, known in advance before the player commits (ethics: no gamble). XP first,
 *  then the named reward (if any), then a bestiary-page mention (if the quest unlocks one). */
export function rewardLabel(q: QuestOut, catalog: WorldCatalog): string {
  const parts = [`${q.reward.xp} XP`];
  if (q.reward.reward_id) {
    const name = catalog.rewards[q.reward.reward_id]?.name;
    if (name) parts.push(name);
  }
  if (q.reward.bestiary) parts.push('page du bestiaire');
  return parts.join(' · ');
}
