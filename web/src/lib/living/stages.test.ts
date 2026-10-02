// The WebGL2 probe (living-dragon final review): asked once for the session, its answer kept.
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function probeWith(context: unknown) {
  const createElement = vi.fn(() => ({ width: 300, height: 150, getContext: vi.fn(() => context) }));
  vi.stubGlobal('document', { createElement });
  const { hasWebGL2 } = await import('./stages');
  return { hasWebGL2, createElement };
}

describe('hasWebGL2', () => {
  it('says yes for a browser that gives a WebGL2 context, and asks only once', async () => {
    const { hasWebGL2, createElement } = await probeWith({});
    expect(hasWebGL2()).toBe(true);
    expect(hasWebGL2()).toBe(true);
    expect(createElement).toHaveBeenCalledTimes(1);
    expect(createElement).toHaveBeenCalledWith('canvas');
  });

  it('says no for a browser without one, and asks only once', async () => {
    const { hasWebGL2, createElement } = await probeWith(null);
    expect(hasWebGL2()).toBe(false);
    expect(hasWebGL2()).toBe(false);
    expect(createElement).toHaveBeenCalledTimes(1);
  });

  it('says no where there is no document to ask', async () => {
    const { hasWebGL2 } = await import('./stages');
    expect(hasWebGL2()).toBe(false);
  });
});
