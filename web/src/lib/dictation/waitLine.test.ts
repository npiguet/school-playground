import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWaitLine, WAIT_HOLD_MS, WAIT_LONG_MS } from './waitLine';
import { SLOW_MS } from './voice';

describe('the waiting line (fix wave B ruling 1)', () => {
  let shown: (string | null)[];
  const current = () => shown.at(-1) ?? null;
  const make = () =>
    createWaitLine(
      (t) => shown.push(t),
      (key) => (key === 'battle.voice.wait' ? 'opener' : 'longer'),
    );

  beforeEach(() => {
    vi.useFakeTimers();
    shown = [];
  });
  afterEach(() => vi.useRealTimers());

  it('stays at least 800 ms once shown, even when the voice starts at once', () => {
    const w = make();
    w.slow();
    expect(current()).toBe('opener');
    vi.advanceTimersByTime(100);
    w.done();
    vi.advanceTimersByTime(WAIT_HOLD_MS - 100 - 1);
    expect(current()).toBe('opener');
    vi.advanceTimersByTime(1);
    expect(current()).toBeNull();
  });

  it('goes at once when it has been up long enough', () => {
    const w = make();
    w.slow();
    vi.advanceTimersByTime(WAIT_HOLD_MS + 50);
    w.done();
    expect(current()).toBeNull();
  });

  it('moves to the second line about 5 s after the line was asked for', () => {
    const w = make();
    w.slow(); // at SLOW_MS
    vi.advanceTimersByTime(WAIT_LONG_MS - SLOW_MS - 1);
    expect(current()).toBe('opener');
    vi.advanceTimersByTime(1);
    expect(current()).toBe('longer');
    w.done();
    expect(current()).toBeNull();
    expect(shown).toEqual(['opener', 'longer', null]);
  });

  it('keeps the line up, not a new pick, when the next line is late during the hold', () => {
    const w = make();
    w.slow();
    w.done();
    vi.advanceTimersByTime(300);
    w.slow();
    vi.advanceTimersByTime(WAIT_HOLD_MS);
    expect(shown).toEqual(['opener']);
  });

  it('never says the second line once the voice has started', () => {
    const w = make();
    w.slow();
    w.done();
    vi.advanceTimersByTime(WAIT_LONG_MS * 2);
    expect(shown).toEqual(['opener', null]);
  });

  it('clear() takes it down now (a pause), and says nothing when nothing was shown', () => {
    const w = make();
    w.clear();
    w.done();
    expect(shown).toEqual([]);
    w.slow();
    w.clear();
    vi.advanceTimersByTime(WAIT_LONG_MS * 2);
    expect(shown).toEqual(['opener', null]);
  });
});
