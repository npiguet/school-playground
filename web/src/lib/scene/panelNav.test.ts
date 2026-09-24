import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HotspotDef } from './types';
import { IDLE_HOTSPOT } from './types';

// closePanel's untagged branch calls the real router's replaceRoute(), which touches `location`
// (unavailable in vitest's node environment, see plan Global Constraints). Mocked so that branch
// is testable without a DOM.
vi.mock('../router.svelte', () => ({ navigate: vi.fn(), replaceRoute: vi.fn() }));

import { replaceRoute } from '../router.svelte';
import { PANEL_TAG, closePanel, heroPanelHref, hotspotHref, isTagged, tagged } from './panelNav';

describe('overlay navigation (UI3 Ruling A2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tags a history state without losing what was there', () => {
    expect(tagged({ keep: 1 })).toEqual({ keep: 1, [PANEL_TAG]: true });
    expect(tagged(null)).toEqual({ [PANEL_TAG]: true });
    expect(isTagged(tagged(undefined))).toBe(true);
    expect(isTagged({})).toBe(false);
    expect(isTagged(null)).toBe(false);
    expect(isTagged('discordePanel')).toBe(false);
  });

  it('closes an overlay opened in the app by stepping back', () => {
    const h = { state: tagged(null), back: vi.fn(), replaceState: vi.fn() };
    closePanel('#/p/3/temple', h);
    expect(h.back).toHaveBeenCalledOnce();
    expect(h.replaceState).not.toHaveBeenCalled();
  });

  it('closes a deep-linked overlay (untagged history state) by replacing the current entry', () => {
    const h = { state: null, back: vi.fn(), replaceState: vi.fn() };
    closePanel('#/p/3/temple', h);
    expect(h.back).not.toHaveBeenCalled();
    expect(replaceRoute).toHaveBeenCalledOnce();
    expect(replaceRoute).toHaveBeenCalledWith('#/p/3/temple');
  });

  it('points the HUD hero chip at the hero panel', () => {
    expect(heroPanelHref(3)).toBe('#/p/3/camp?panel=heros');
  });
});

describe('hotspot targets', () => {
  const def = (over: Partial<HotspotDef>): HotspotDef => ({
    id: 'x',
    label: 'X',
    target: 'library',
    shape: { kind: 'ellipse', cx: 50, cy: 50, rx: 5, ry: 5 },
    labelPos: 'below',
    state: () => IDLE_HOTSPOT,
    ...over,
  });

  it('builds the route of a hotspot, with its params and query', () => {
    expect(hotspotHref(def({}), 3)).toBe('#/p/3/parchemins');
    expect(hotspotHref(def({ target: 'lieutenant', params: { key: 'hydre' } }), 3)).toBe('#/p/3/monstres/hydre');
    expect(hotspotHref(def({ target: 'camp', query: { panel: 'heros' } }), 3)).toBe('#/p/3/camp?panel=heros');
  });

  it('returns null when the scene handles the tap itself', () => {
    expect(hotspotHref(def({ target: null }), 3)).toBeNull();
  });
});
