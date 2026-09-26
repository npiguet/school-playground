import { describe, expect, it } from 'vitest';
import { bossRewardId, bossRewardName, treasureCaption } from './rewards';
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
});
