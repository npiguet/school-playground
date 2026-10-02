import { describe, expect, it } from 'vitest';
import { HOW_TO_WIN_IDS, bossRewardId, bossRewardName, bossTier, howToEarn, nextFightTier, treasureCaption } from './rewards';
import { REWARD_ICONS } from './art';
import { DEFAULT_RULES } from '../rules';
import { sealHowLine } from './seals';
import { houseLockedLine, lockedAccessoryLine } from './shop';
import { LIEUTENANT_ORDER, type CampResponse, type QuestOut, type ShopCatalog, type WorldCatalog } from './types';
import { FOMO, GUILT, banned } from '../../testing/copyRules';

const catalog = {
  boss_rewards: { '1': 'sandales_hermes' },
  quest_bonus: { boss: 300 },
  rewards: { sandales_hermes: { id: 'sandales_hermes', kind: 'gear', name: "Sandales d'Hermès", desc: '', source: '' } },
} as unknown as WorldCatalog;

describe('reward words', () => {
  it('names the boss reward known in advance: the gear of the first three fights, then its XP (spec 2026-09-29 lieutenant levels §4)', () => {
    expect(bossRewardId(1, catalog)).toBe('sandales_hermes');
    expect(bossRewardName(1, catalog)).toBe("Sandales d'Hermès");
    // Spec 2026-09-29 drachmes §1: a won fight also pays its drachmes (the rules' `drachmes.boss`).
    expect(bossRewardName(4, catalog)).toBe('300 XP et 30 drachmes');
    const thrifty = { ...catalog, rules: { ...DEFAULT_RULES, drachmes: { ...DEFAULT_RULES.drachmes, boss: 0 } } } as WorldCatalog;
    expect(bossRewardName(4, thrifty)).toBe('300 XP');
    const rich = { ...catalog, rules: { ...DEFAULT_RULES, drachmes: { ...DEFAULT_RULES.drachmes, boss: 1 } } } as WorldCatalog;
    expect(bossRewardName(4, rich)).toBe('300 XP et 1 drachme');
    expect(bossRewardName(null, catalog)).toBe('une récompense');
    expect(bossRewardName(1, null)).toBe('une récompense');
    expect(bossRewardId(null, catalog)).toBeNull();
  });

  it('knows the fight under way when no tier is open (an old fight resumed after migration 006)', () => {
    const camp = (tier_available: number | null, quests: Partial<QuestOut>[]) => ({ boss: { tier_available }, quests }) as unknown as CampResponse;
    const boss = { kind: 'boss', status: 'active', goal: { tier: 2 } } as Partial<QuestOut>;
    expect(bossTier(camp(3, [boss]))).toBe(3);
    expect(bossTier(camp(null, [boss]))).toBe(2);
    expect(bossTier(camp(null, [{ ...boss, status: 'done' }]))).toBeNull();
    expect(bossTier(null)).toBeNull();
    expect(bossRewardName(bossTier(camp(null, [{ ...boss, goal: { tier: 1 } }])), catalog)).toBe("Sandales d'Hermès");
  });

  it('counts the cabin treasures', () => {
    expect([0, 1, 2].map(treasureCaption)).toEqual(['Aucun trésor encore', '1 trésor', '2 trésors']);
  });

  // Final review M11: the sentences are read through howToEarn, the shelf's one entry point (R13); with
  // no next fight known, every reward keeps its own sentence.
  const sentence = (id: string, source: string) => howToEarn(id, source, { nextTier: null, catalog: null });

  it('says how to win every reward as a sentence to the player, agreed with the reward (UI3b playability #13)', () => {
    const tints = ['ecume', 'olivier', 'braise', 'jade', 'argent'].map((t) => `tint:${t}`);
    expect([...HOW_TO_WIN_IDS].sort()).toEqual([...Object.keys(REWARD_ICONS), ...tints].sort());
    expect(sentence('sandales_hermes', '')).toBe('Bats Éris une première fois pour les gagner.');
    expect(sentence('decor:bouclier', '')).toBe('Hermès le vend à son étal.');
    expect(sentence('decor:chouette', '')).toBe('Hermès la vend à son étal.');
    expect(sentence('decor:new', 'Dix quêtes du mur')).toBe('À gagner\u202f: dix quêtes du mur.');
    for (const id of HOW_TO_WIN_IDS) expect(sentence(id, '')).not.toMatch(/Comment l'obtenir|Neutraliser|Vaincre/);
  });
});

describe('every thing not owned says how to earn it (spec 2026-09-29 explanations §4)', () => {
  const catalog = { boss_rewards: { '1': 'sandales_hermes', '2': 'egide', '3': 'foudre_zeus' } } as unknown as WorldCatalog;
  const VILLA = { id: 'house:villa', key: 'villa', stage: 'adult', after: null, price: 300, the: 'la villa' } as ShopCatalog['houses'][number];
  const PALAIS = { id: 'house:palais', key: 'palais', stage: 'illustre', after: 'house:villa', price: 800, the: 'le palais' } as ShopCatalog['houses'][number];

  it('names the next fight to win on the ladder', () => {
    const boss = (tiers_won: number[]) => ({ boss: { tier_available: null, tiers_won, active_quest_id: null, fights: 10, next: null } }) as unknown as CampResponse;
    expect(nextFightTier(boss([]))).toBe(1);
    expect(nextFightTier(boss([1, 2]))).toBe(3);
    expect(nextFightTier(boss([2]))).toBe(1);
    expect(nextFightTier(boss([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeNull();
    expect(nextFightTier(null)).toBeNull();
  });

  it("says the next fight's gear, agreed, and keeps the later ones' sentences", () => {
    expect(howToEarn('sandales_hermes', '', { nextTier: 1, catalog })).toBe('Gagne le prochain combat contre Éris pour les gagner.');
    expect(howToEarn('egide', '', { nextTier: 2, catalog })).toBe('Gagne le prochain combat contre Éris pour la gagner.');
    expect(howToEarn('foudre_zeus', '', { nextTier: 3, catalog })).toBe('Gagne le prochain combat contre Éris pour la gagner.');
    expect(howToEarn('egide', '', { nextTier: 1, catalog })).toBe('Bats Éris une deuxième fois pour la gagner.');
    expect(howToEarn('tint:jade', '', { nextTier: null, catalog: null })).toBe("Gagne-la dans une quête de l'Oracle.");
  });

  // Review focus 5.
  it('has a sentence for every locked kind, never the fallback, never pressure', () => {
    const lines: [string, string][] = [
      ...LIEUTENANT_ORDER.flatMap((k) => [1, 2, 3, 4, 5].map((l) => [`trophy:${k}:${l}`, sealHowLine(k, l)] as [string, string])),
      ...HOW_TO_WIN_IDS.flatMap((id) => [1, 2, 3].map((t) => [`${id} (fight ${t})`, howToEarn(id, '', { nextTier: t, catalog })] as [string, string])),
      ...LIEUTENANT_ORDER.flatMap((k) => [2, 3, 4, 5].map((l) => [`accessory:${k}:${l}`, lockedAccessoryLine(k, l)] as [string, string])),
      ['house:villa', houseLockedLine(VILLA, 'young', new Set())],
      ['house:palais', houseLockedLine(PALAIS, 'adult', new Set(['house:villa']))],
    ];
    for (const [where, text] of lines) {
      expect(text, where).not.toMatch(/^À gagner/);
      expect(banned(text), where).toEqual([]);
      expect(text.match(GUILT), where).toBeNull();
      expect(text, where).not.toMatch(FOMO);
    }
    // Every kind of the shelf and the stall is there: trophies, tints, gear, decor, accessories, houses.
    const kinds = new Set(lines.map(([where]) => where.split(':')[0].split(' ')[0]));
    for (const k of ['trophy', 'tint', 'accessory', 'house', 'decor', 'sandales_hermes', 'egide', 'foudre_zeus']) expect([...kinds].some((x) => x.startsWith(k)), k).toBe(true);
  });
});
