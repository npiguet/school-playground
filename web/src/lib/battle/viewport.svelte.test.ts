// Final review M12/M13: the watcher keeps the visual viewport's height, offset and scale, writes a
// value only when it changed (a pan that moves nothing notifies nobody), and leaves :root alone.
import { afterEach, describe, expect, it } from 'vitest';
import { viewport, watchViewport } from './viewport.svelte';

function fakeWindow() {
  const vv = Object.assign(new EventTarget(), { height: 820, offsetTop: 0, scale: 1 });
  const win = Object.assign(new EventTarget(), { innerHeight: 820, visualViewport: vv });
  const rootStyle = { writes: 0, setProperty: () => (rootStyle.writes += 1), removeProperty: () => (rootStyle.writes += 1) };
  (globalThis as unknown as { window: unknown }).window = win;
  (globalThis as unknown as { document: unknown }).document = { documentElement: { style: rootStyle } };
  return { vv, win, rootStyle };
}

let release: (() => void) | null = null;
afterEach(() => {
  release?.();
  release = null;
});

describe('the visual viewport watcher', () => {
  it('follows the keyboard, the pan and the zoom', () => {
    const { vv } = fakeWindow();
    release = watchViewport();
    expect(viewport).toEqual({ height: 820, top: 0, inner: 820, scale: 1 });
    vv.height = 420;
    vv.offsetTop = 120;
    vv.dispatchEvent(new Event('scroll'));
    expect(viewport).toMatchObject({ height: 420, top: 120 });
    vv.scale = 1.5;
    vv.dispatchEvent(new Event('resize'));
    expect(viewport.scale).toBe(1.5);
  });

  it('writes nothing when an event moves nothing, and never writes on :root', () => {
    const { vv, rootStyle } = fakeWindow();
    release = watchViewport();
    // Counts the writes to `top` (vitest runs Svelte's server build here: the store is a plain
    // object, so a setter can stand in for its signal).
    let top = viewport.top;
    let writes = 0;
    Object.defineProperty(viewport, 'top', {
      configurable: true,
      enumerable: true,
      get: () => top,
      set: (v: number) => {
        writes += 1;
        top = v;
      },
    });
    try {
      for (let i = 0; i < 5; i++) vv.dispatchEvent(new Event('scroll'));
      expect(writes, 'a pan that moves nothing').toBe(0);
      vv.offsetTop = 40;
      vv.dispatchEvent(new Event('scroll'));
      expect(writes).toBe(1);
      expect(viewport.top).toBe(40);
      expect(rootStyle.writes).toBe(0);
    } finally {
      Object.defineProperty(viewport, 'top', { configurable: true, enumerable: true, writable: true, value: top });
    }
  });
});
