import { beforeEach, describe, expect, it, vi } from 'vitest';
import { battleStage, react, resetBattleStage, setHp, strike } from './stage.svelte';
import { onBattleEvent } from './events';

describe('the stage store the phases drive', () => {
  beforeEach(() => resetBattleStage());

  it('starts full and idle', () => {
    expect(battleStage.hp).toEqual({ value: 1, segments: null });
    expect(battleStage.hits).toBe(0);
    expect(battleStage.opponent.reaction).toBe('idle');
  });

  it('bumps a nonce on every reaction, even a repeated one', () => {
    react('dragon', 'cheer');
    react('dragon', 'cheer');
    expect(battleStage.dragon).toEqual({ reaction: 'cheer', nonce: 2 });
  });

  it('strikes: lowers the hold, counts the hit, the opponent reels, UI5 hears it', () => {
    const seen = vi.fn();
    const off = onBattleEvent(seen);
    setHp({ value: 1, segments: 3 });
    strike(0.5);
    off();
    expect(battleStage.hp).toEqual({ value: 0.5, segments: 3 });
    expect(battleStage.hits).toBe(1);
    expect(battleStage.opponent.reaction).toBe('hit');
    expect(seen).toHaveBeenCalledWith({ kind: 'strike', value: 0.5 });
  });
});
