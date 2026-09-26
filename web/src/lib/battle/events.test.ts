import { describe, expect, it, vi } from 'vitest';
import { BATTLE_NARRATOR, emitBattle, onBattleEvent } from './events';

describe('battle events, the hooks UI5 listens to (Ruling C9)', () => {
  it('delivers events until unsubscribed, and survives a throwing listener', () => {
    const seen = vi.fn();
    const off = onBattleEvent(seen);
    const off2 = onBattleEvent(() => {
      throw new Error('a listener bug');
    });
    emitBattle({ kind: 'strike', value: 0.5 });
    off();
    off2();
    emitBattle({ kind: 'retry' });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ kind: 'strike', value: 0.5 });
  });

  it('names the dialogue events of spec §8', () => {
    expect(BATTLE_NARRATOR).toEqual({
      start: 'battle.start',
      caught: 'battle.caught',
      missed: 'battle.missed',
      victory: 'battle.victory',
      retreat: 'battle.retreat',
      retry: 'battle.retry',
    });
  });
});
