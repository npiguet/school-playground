import { describe, expect, it, vi } from 'vitest';
import { PANEL_TAG, closePanel, heroPanelHref, isTagged, tagged } from './panelNav';

describe('overlay navigation (UI3 Ruling A2)', () => {
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

  it('points the HUD hero chip at the hero panel', () => {
    expect(heroPanelHref(3)).toBe('#/p/3/camp?panel=heros');
  });
});
