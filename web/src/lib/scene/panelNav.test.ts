import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HotspotDef } from './types';
import { IDLE_HOTSPOT } from './types';

// closePanel's untagged branch calls the real router's replaceRoute(), which touches `location`
// (unavailable in vitest's node environment, see plan Global Constraints). Mocked so that branch
// is testable without a DOM.
vi.mock('../router.svelte', () => ({ navigate: vi.fn(), replaceRoute: vi.fn(), navigationPending: vi.fn(() => false) }));

import { navigate, navigationPending, replaceRoute } from '../router.svelte';
import { PANEL_TAG, closePanel, go, goBack, heroPanelHref, hotspotHref, isTagged, leavePanel, openHotspot, replacePanel, tagged } from './panelNav';

describe('overlay navigation (UI3 Ruling A2)', () => {
  // closePanel listens on `window` for the end of its own Back (node has none): a bare EventTarget
  // stands in, and every test ends that traversal so no step-back is left pending for the next.
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', new EventTarget());
  });
  afterEach(() => {
    window.dispatchEvent(new Event('hashchange'));
    vi.unstubAllGlobals();
  });

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

  // Final review I1: `location.replace` leaves a fresh, untagged entry. The history stub mimics
  // that (replaceRoute resets `state` to null) so the test sees what the browser does.
  function replacingHistory(state: unknown) {
    const h = { state, back: vi.fn(), replaceState: vi.fn((s: unknown) => (h.state = s)) };
    vi.mocked(replaceRoute).mockImplementation(() => {
      h.state = null;
    });
    return h;
  }

  it('re-tags a tagged overlay entry it replaces, so closing the new overlay still steps back', () => {
    const h = replacingHistory(tagged({ keep: 1 }));
    replacePanel('#/p/3/parchemins', h);
    expect(replaceRoute).toHaveBeenCalledWith('#/p/3/parchemins');
    expect(h.replaceState).toHaveBeenCalledWith({ [PANEL_TAG]: true }, '');
    expect(isTagged(h.state)).toBe(true);
    closePanel('#/p/3/bibliotheque', h);
    expect(h.back).toHaveBeenCalledOnce();
  });

  it('leaves a deep-linked (untagged) entry untagged, so closing still replaces', () => {
    const h = replacingHistory(null);
    replacePanel('#/p/3/parchemins', h);
    expect(replaceRoute).toHaveBeenCalledWith('#/p/3/parchemins');
    expect(h.replaceState).not.toHaveBeenCalled();
    expect(isTagged(h.state)).toBe(false);
  });

  // Task S: WebKit keeps `history.state` across a fragment `location.replace()` (Chromium resets
  // it), so a screen that replaces a tagged overlay's entry kept the overlay's tag there - the hero
  // form handing off to the camp. The stub mimics WebKit (replaceRoute keeps the state).
  it('leaves an overlay for another screen on an untagged entry, whatever the engine keeps', () => {
    const h = { state: tagged({ keep: 1 }) as unknown, back: vi.fn(), replaceState: vi.fn((s: unknown) => (h.state = s)) };
    leavePanel('#/p/3/camp', h);
    expect(replaceRoute).toHaveBeenCalledWith('#/p/3/camp');
    expect(isTagged(h.state)).toBe(false);
    expect(h.state).toEqual({ keep: 1 });
    // Chromium: the state is already null after the replace, nothing to clear.
    const chromium = replacingHistory(tagged(null));
    leavePanel('#/p/3/camp', chromium);
    expect(chromium.replaceState).not.toHaveBeenCalled();
    expect(isTagged(chromium.state)).toBe(false);
  });

  it('go() pushes, opens a panel or replaces one, as asked', () => {
    const h = replacingHistory(tagged(null));
    go('#/p/3/jouer/9', 'push', h);
    expect(navigate).toHaveBeenCalledWith('#/p/3/jouer/9');
    expect(h.replaceState).not.toHaveBeenCalled();

    go('#/p/3/parchemins', 'panel', h);
    expect(navigate).toHaveBeenLastCalledWith('#/p/3/parchemins');
    expect(h.replaceState).toHaveBeenCalledOnce();

    go('#/p/3/alexandrie', 'replace', h);
    expect(replaceRoute).toHaveBeenCalledWith('#/p/3/alexandrie');
    expect(navigate).toHaveBeenCalledTimes(2);
  });

  it('ignores a close while a navigation is already under way (the screen is leaving)', () => {
    vi.mocked(navigationPending).mockReturnValueOnce(true).mockReturnValueOnce(true);
    const tag = { state: tagged(null), back: vi.fn(), replaceState: vi.fn() };
    closePanel('#/', tag);
    const deep = { state: null, back: vi.fn(), replaceState: vi.fn() };
    closePanel('#/', deep);
    expect(tag.back).not.toHaveBeenCalled();
    expect(replaceRoute).not.toHaveBeenCalled();
  });

  // Task S: `history.back()` is asynchronous, and until its traversal lands the entry (and its
  // tag) is still the overlay's. A second close in that window (a held Escape, a seal then Escape)
  // used to step back twice, out of the place.
  it('steps back once for two quick closes, until its own Back has landed', () => {
    const h = { state: tagged(null), back: vi.fn(), replaceState: vi.fn() };
    closePanel('#/p/3/temple', h);
    closePanel('#/p/3/temple', h);
    expect(h.back).toHaveBeenCalledOnce();
    expect(replaceRoute).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('hashchange')); // the Back has landed
    closePanel('#/p/3/temple', h); // a later overlay, opened in the app, closes normally again
    expect(h.back).toHaveBeenCalledTimes(2);
  });

  it("go(…, 'leave') puts a screen in place of this entry, untagged (a battle quit with nothing behind it)", () => {
    const h = { state: tagged({ keep: 1 }), back: vi.fn(), replaceState: vi.fn((s: unknown) => (h.state = s as never)) };
    go('#/p/3/camp', 'leave', h);
    expect(replaceRoute).toHaveBeenCalledWith('#/p/3/camp');
    expect(navigate).not.toHaveBeenCalled();
    expect(h.state).toEqual({ keep: 1 });
  });

  // A battle's « Oui, quitter » steps back to the place it was opened from (lib/battle/origin.ts),
  // with closePanel's guards: one step, never during another navigation.
  it('goBack steps back once, never while a navigation or its own Back is under way', () => {
    const h = { state: null, back: vi.fn(), replaceState: vi.fn() };
    vi.mocked(navigationPending).mockReturnValueOnce(true);
    goBack(h);
    expect(h.back).not.toHaveBeenCalled();
    goBack(h);
    goBack(h);
    expect(h.back).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('hashchange')); // the Back has landed
    goBack(h);
    expect(h.back).toHaveBeenCalledTimes(2);
  });

  it('points the HUD hero chip at the hero panel in the cabin (UI3 Ruling B2)', () => {
    expect(heroPanelHref(3)).toBe('#/p/3/cabane?panel=heros');
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

describe('openHotspot (UI3a Task 9, controller ruling 4: the same activation as every place)', () => {
  beforeEach(() => vi.clearAllMocks());

  const def = (over: Partial<HotspotDef>): HotspotDef => ({
    id: 'x',
    label: 'X',
    target: 'text-new',
    shape: { kind: 'ellipse', cx: 50, cy: 50, rx: 5, ry: 5 },
    labelPos: 'below',
    state: () => IDLE_HOTSPOT,
    ...over,
  });

  it('pushes the hotspot route and tags it, like a panel opened by hand', () => {
    const h = { state: null, back: vi.fn(), replaceState: vi.fn() };
    vi.stubGlobal('history', h);
    try {
      openHotspot(def({}), 3);
      expect(navigate).toHaveBeenCalledWith('#/p/3/texts/new');
      expect(h.replaceState).toHaveBeenCalledWith({ [PANEL_TAG]: true }, '');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does nothing for a hotspot the scene handles itself', () => {
    const h = { state: null, back: vi.fn(), replaceState: vi.fn() };
    vi.stubGlobal('history', h);
    try {
      openHotspot(def({ target: null }), 3);
      expect(navigate).not.toHaveBeenCalled();
      expect(h.replaceState).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
