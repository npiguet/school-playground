import { describe, it, expect } from 'vitest';
import { clockReset, clockStart, clockStop, clockTick, playClock } from './playClock.svelte';

describe('playClock', () => {
  it('accumulates only while started and flags 25 minutes', () => {
    clockReset();
    clockStart();
    clockTick(0);
    clockTick(10 * 60_000);
    expect(playClock.activeMs).toBe(10 * 60_000);
    expect(playClock.needsBreak).toBe(false);

    clockStop();
    clockTick(20 * 60_000);
    expect(playClock.activeMs).toBe(10 * 60_000);

    clockStart();
    clockTick(20 * 60_000);
    clockTick(36 * 60_000);
    expect(playClock.needsBreak).toBe(true);
  });

  it('resets after ten idle minutes', () => {
    clockReset();
    clockStart();
    clockTick(0);
    clockTick(5 * 60_000);
    clockStop();

    clockStart();
    clockTick(16 * 60_000);
    expect(playClock.activeMs).toBe(0);
  });
});
