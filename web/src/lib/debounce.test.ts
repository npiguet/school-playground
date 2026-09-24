import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from './debounce';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('debounce', () => {
  it('runs once, after the delay, with the last call\'s arguments', () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d('a');
    d('b');
    d('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('resets the delay on every call (P1-3: keeps saving while she keeps typing)', () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d('a');
    vi.advanceTimersByTime(400);
    d('b'); // typed again before the first save would have fired
    vi.advanceTimersByTime(400);
    expect(fn).not.toHaveBeenCalled(); // only 800ms elapsed, but the timer restarted at 400ms
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });

  it('fires again for a later, separate burst of calls', () => {
    const fn = vi.fn();
    const d = debounce(fn, 500);
    d('a');
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
    d('b');
    vi.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });
});
