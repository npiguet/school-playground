import { describe, it, expect } from 'vitest';
import { lowerLeadingArticle, questProgressLabel, questTitle, rewardLabel, romanTier, tricksBeforeEris } from './quests';
import type { CampResponse } from './types';

const names = { hydre: "L'Hydre", echo: 'Écho' };
const q = (o: object) =>
  ({
    id: 1,
    kind: 'board',
    target: 'hydre',
    week: null,
    status: 'active',
    goal: { sessions: 3 },
    progress: { sessions: 2, log: [] },
    reward: { xp: 60, reward_id: null, bestiary: true },
    texts: [],
    created_at: '',
    completed_at: null,
    ...o,
  }) as never;
const catalog = { rewards: { 'tint:ecume': { name: 'Teinte Écume' }, sandales_hermes: { name: "Sandales d'Hermès" } } } as never;

describe('quest labels', () => {
  it('titles', () => {
    expect(questTitle(q({}), names)).toBe("Tenir l'Hydre en échec");
    expect(questTitle(q({ kind: 'oracle', target: 'echo' }), names)).toBe("Rouleau de l'Oracle\u202f: Écho");
    expect(questTitle(q({ kind: 'boss', target: 'eris', goal: { tier: 2 } }), names)).toBe(
      'Combat contre Éris (II)',
    );
  });

  it('progress and rewards', () => {
    expect(questProgressLabel(q({}))).toBe('2 / 3 textes');
    expect(questProgressLabel(q({ kind: 'boss', goal: { tier: 1 } }))).toBe('Un combat');
    expect(rewardLabel(q({}), catalog)).toBe('60 XP · page du bestiaire');
    expect(rewardLabel(q({ kind: 'oracle', reward: { xp: 150, reward_id: 'tint:ecume', bestiary: true } }), catalog)).toBe(
      '150 XP · Teinte Écume · page du bestiaire',
    );
    expect(rewardLabel(q({ kind: 'boss', reward: { xp: 300, reward_id: 'sandales_hermes', bestiary: false } }), catalog)).toBe(
      "300 XP · Sandales d'Hermès",
    );
    expect(romanTier(3)).toBe('III');
  });

  // P1-1 (SP3 playability): mid-sentence, a leading French article reads oddly capitalised
  // ("Tenir L'Hydre en échec") - screens that build their own quest label from a shape other than
  // `QuestOut` (battle/VictorySpoils.svelte) must still lower it the same way as `questTitle()`.
  it('lowers a leading article mid-title, exported for callers that cannot use questTitle directly', () => {
    expect(lowerLeadingArticle("L'Hydre")).toBe("l'Hydre");
    expect(lowerLeadingArticle('La Chimère')).toBe('la Chimère');
    expect(lowerLeadingArticle('Les Sirènes')).toBe('les Sirènes');
    expect(lowerLeadingArticle('Écho')).toBe('Écho');
  });

  it('counts the tricks still to foil before Éris comes out (the wall and the hub agree)', () => {
    const c = (neutralised: number, won: number[] = []) => ({ dragon: { neutralised, available: 6 }, boss: { tiers_won: won } }) as unknown as CampResponse;
    expect([tricksBeforeEris(c(0)), tricksBeforeEris(c(1)), tricksBeforeEris(c(2)), tricksBeforeEris(c(2, [1]))]).toEqual([2, 1, 0, 2]);
  });
});
