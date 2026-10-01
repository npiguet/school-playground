import { describe, expect, it } from 'vitest';
import { HOW_TO_WIN_IDS, bossRewardId, bossRewardName, bossTier, howToWin, treasureCaption } from './rewards';
import { REWARD_ICONS } from './art';
import type { CampResponse, QuestOut, WorldCatalog } from './types';

const catalog = {
  boss_rewards: { '1': 'sandales_hermes' },
  quest_bonus: { boss: 300 },
  rewards: { sandales_hermes: { id: 'sandales_hermes', kind: 'gear', name: "Sandales d'Hermès", desc: '', source: '' } },
} as unknown as WorldCatalog;

describe('reward words', () => {
  it('names the boss reward known in advance: the gear of the first three fights, then its XP (spec 2026-09-29 lieutenant levels §4)', () => {
    expect(bossRewardId(1, catalog)).toBe('sandales_hermes');
    expect(bossRewardName(1, catalog)).toBe("Sandales d'Hermès");
    expect(bossRewardName(4, catalog)).toBe('300 XP');
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

  it('says how to win every reward as a sentence to the player, agreed with the reward (UI3b playability #13)', () => {
    const tints = ['ecume', 'olivier', 'braise', 'jade', 'argent'].map((t) => `tint:${t}`);
    expect([...HOW_TO_WIN_IDS].sort()).toEqual([...Object.keys(REWARD_ICONS), ...tints].sort());
    expect(howToWin('sandales_hermes', '')).toBe('Bats Éris une première fois pour les gagner.');
    expect(howToWin('decor:new', 'Dix quêtes du mur')).toBe('À gagner\u202f: dix quêtes du mur.');
    for (const id of HOW_TO_WIN_IDS) expect(howToWin(id, '')).not.toMatch(/Comment l'obtenir|Neutraliser|Vaincre/);
  });
});
