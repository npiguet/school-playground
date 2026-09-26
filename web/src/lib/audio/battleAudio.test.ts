import { describe, expect, it } from 'vitest';
import { createEngine } from './engine';
import { recordingBackend } from './recordingBackend';
import { listenToBattle } from './battleAudio';
import { emitBattle } from '../battle/events';

describe('the battle on the mixer (Rulings E4-E6, UI4 hooks C9)', () => {
  it('plays its ground\'s loop, ducks through the dictation and the proofreading, strikes and cheers', () => {
    const e = createEngine(recordingBackend());
    e.unlock();
    const stop = listenToBattle(e);
    emitBattle({ kind: 'start', opponent: 'hydre', mode: 'dictation', backdrop: 'river' });
    expect(e.snapshot()).toMatchObject({ playing: 'battle', ducks: [] });
    emitBattle({ kind: 'phase', phase: 'dictation' });
    expect(e.snapshot().ducks).toEqual(['dictation']);
    emitBattle({ kind: 'phase', phase: 'proofreading' });
    expect(e.snapshot().ducks).toEqual(['proofreading']);
    emitBattle({ kind: 'phase', phase: 'victory' });
    expect(e.snapshot().ducks).toEqual([]);
    emitBattle({ kind: 'strike', value: 0.5 });
    emitBattle({ kind: 'outcome', outcome: 'rout', caught: 3, missed: 0 });
    expect(e.snapshot().sfx).toEqual(['strike', 'fanfare']);
    emitBattle({ kind: 'start', opponent: 'eris', mode: 'boss', backdrop: 'lair' });
    expect(e.snapshot().playing).toBe('lair');
    emitBattle({ kind: 'phase', phase: 'proofreading' });
    emitBattle({ kind: 'leave' });
    expect(e.snapshot().ducks).toEqual([]);
    stop();
  });
});
