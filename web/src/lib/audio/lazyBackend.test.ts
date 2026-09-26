import { describe, expect, it } from 'vitest';
import { lazyBackend } from './lazyBackend';
import { recordingBackend } from './recordingBackend';
import { createEngine } from './engine';

function deferred() {
  const real = recordingBackend();
  let open!: (b: typeof real) => void;
  const loaded = new Promise<typeof real>((r) => (open = r));
  return { real, open: () => open(real), lazy: lazyBackend(() => loaded) };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('the lazily loaded backend (lane A review #12)', () => {
  it('replays what was asked before Howler arrived: the context, the effects, the loop still wanted', async () => {
    const { real, open, lazy } = deferred();
    lazy.warm();
    lazy.resume();
    const kept = lazy.track('camp');
    kept.start(0.5, 1200);
    kept.fadeTo(0.15, 400);
    const dropped = lazy.track('sea');
    dropped.start(0.5, 1200);
    dropped.stop(1200);
    lazy.sfx('tap', 0.4);
    expect(lazy.state()).toBe('none');
    open();
    await tick();
    expect(real.log.state).toBe('running');
    expect(real.log.calls).toEqual(['start camp 0.15 1200']);
    expect(real.log.sfx).toEqual([]);
    kept.stop(1200);
    lazy.sfx('seal', 0.7);
    expect(real.log.calls.at(-1)).toBe('stop camp 1200');
    expect(real.log.sfx).toEqual([{ id: 'seal', gain: 0.7 }]);
    expect(lazy.state()).toBe('running');
  });

  it('keeps the last context wish (a page hidden before the load stays suspended)', async () => {
    const { real, open, lazy } = deferred();
    lazy.resume();
    lazy.suspend();
    open();
    await tick();
    expect(real.log.state).toBe('suspended');
  });

  // iOS: a context made outside a gesture starts suspended, and resume() works only inside one. When
  // « Entrer » comes before Howler, the unlock's gesture is spent: the next tap resumes the context.
  it('ends up running when the unlock tap came before Howler: the next gesture resumes it', async () => {
    let inGesture = false;
    const real = recordingBackend();
    real.resume = () => {
      if (inGesture) real.log.state = 'running';
    };
    let open!: () => void;
    const loaded = new Promise<typeof real>((r) => (open = () => r(real)));
    const gestures: (() => void)[] = [];
    const lazy = lazyBackend(() => loaded, (fn) => gestures.push(fn));
    const engine = createEngine(lazy);
    inGesture = true;
    engine.unlock(); // « Entrer », Howler still on its way
    inGesture = false;
    open();
    await tick();
    expect(real.log.state).toBe('suspended');
    expect(gestures).toHaveLength(1);
    inGesture = true;
    gestures[0](); // the next tap, anywhere
    inGesture = false;
    expect(real.log.state).toBe('running');
    expect(engine.snapshot().unlocked).toBe(true);
  });

  it('asks for no extra gesture when the context is already running once Howler arrives', async () => {
    const gestures: (() => void)[] = [];
    const real = recordingBackend();
    const late = lazyBackend(() => Promise.resolve(real), (fn) => gestures.push(fn));
    late.resume();
    await tick();
    expect(real.log.state).toBe('running');
    expect(gestures).toEqual([]);
  });

  it('stays silent, never throwing, when the backend cannot load', async () => {
    const lazy = lazyBackend(() => Promise.reject(new Error('offline')));
    const h = lazy.track('camp');
    h.start(0.5, 1200);
    await tick();
    expect(() => {
      h.fadeTo(0.2, 400);
      h.stop(1200);
      lazy.sfx('tap', 0.4);
      lazy.resume();
    }).not.toThrow();
    expect(lazy.state()).toBe('none');
  });
});
