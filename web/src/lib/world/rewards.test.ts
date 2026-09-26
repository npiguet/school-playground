import { describe, expect, it } from 'vitest';
import { HOW_TO_WIN_IDS, bossRewardId, bossRewardName, howToWin, treasureCaption } from './rewards';
import { REWARD_ICONS } from './art';
import type { WorldCatalog } from './types';

const catalog = {
  boss_rewards: { '1': 'sandales_hermes' },
  rewards: { sandales_hermes: { id: 'sandales_hermes', kind: 'gear', name: "Sandales d'Hermès", desc: '', source: '' } },
} as unknown as WorldCatalog;

describe('reward words', () => {
  it('names the boss reward known in advance, or says « une récompense »', () => {
    expect(bossRewardId(1, catalog)).toBe('sandales_hermes');
    expect(bossRewardName(1, catalog)).toBe("Sandales d'Hermès");
    expect(bossRewardName(2, catalog)).toBe('une récompense');
    expect(bossRewardName(null, catalog)).toBe('une récompense');
    expect(bossRewardName(1, null)).toBe('une récompense');
    expect(bossRewardId(null, catalog)).toBeNull();
  });

  it('counts the cabin treasures', () => {
    expect([0, 1, 2].map(treasureCaption)).toEqual(['Aucun trésor encore', '1 trésor', '2 trésors']);
  });

  it('says how to win every reward as a sentence to the player, agreed with the reward (UI3b playability #13)', () => {
    const tints = ['ecume', 'olivier', 'braise', 'jade', 'argent'].map((t) => `tint:${t}`);
    expect([...HOW_TO_WIN_IDS].sort()).toEqual([...Object.keys(REWARD_ICONS), ...tints].sort());
    expect(howToWin('criniere_chimere', 'Neutraliser la Chimère')).toBe('Neutralise la Chimère pour la gagner.');
    expect(howToWin('pavot_lethe', 'Neutraliser Léthé')).toBe('Neutralise Léthé pour le gagner.');
    expect(howToWin('sandales_hermes', '')).toBe('Bats Éris une première fois pour les gagner.');
    expect(howToWin('decor:new', 'Dix quêtes du mur')).toBe('À gagner : dix quêtes du mur.');
    for (const id of HOW_TO_WIN_IDS) expect(howToWin(id, '')).not.toMatch(/Comment l'obtenir|Neutraliser|Vaincre/);
  });
});
