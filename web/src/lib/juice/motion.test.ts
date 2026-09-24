import { afterEach, describe, expect, it, vi } from 'vitest';
import { reducedMotion, watchReducedMotion } from './motion';

type Listener = (e: { matches: boolean }) => void;

function fakeMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mq = {
    matches: initial,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', () => mq);
  return {
    set(m: boolean) {
      mq.matches = m;
      for (const l of listeners) l({ matches: m });
    },
    listeners: () => listeners.size,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('watchReducedMotion', () => {
  it('reports false once when matchMedia does not exist (node, SSR)', () => {
    const seen: boolean[] = [];
    const stop = watchReducedMotion((v) => seen.push(v));
    stop();
    expect(seen).toEqual([false]);
  });

  it('emits the current value, then every change, until stopped', () => {
    const mm = fakeMatchMedia(true);
    const seen: boolean[] = [];
    const stop = watchReducedMotion((v) => seen.push(v));
    mm.set(false);
    stop();
    mm.set(true);
    expect(seen).toEqual([true, false]);
    expect(mm.listeners()).toBe(0);
  });

  it('agrees with reducedMotion()', () => {
    fakeMatchMedia(true);
    expect(reducedMotion()).toBe(true);
  });
});
