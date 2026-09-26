import { describe, expect, it } from 'vitest';
import { recordOpening, type OpenedFromMap } from './openedFrom.svelte';
import type { PanelId } from '../world/places';

/** Walks a sequence of panels through recordOpening, from the first one (the panel mounted with). */
function walk(panels: (PanelId | null)[], targets: PanelId[], keepFrom: Partial<Record<PanelId, PanelId[]>> = {}): OpenedFromMap {
  let map: OpenedFromMap = {};
  for (let i = 1; i < panels.length; i++) map = recordOpening(map, panels[i - 1], panels[i], targets, keepFrom);
  return map;
}

describe('openedFrom (final review M2)', () => {
  it('records where a tracked overlay was opened from, and only on a move into it', () => {
    expect(walk([null, 'dossier', 'portrait'], ['portrait'])).toEqual({ portrait: 'dossier' });
    expect(walk([null, 'dossier', 'portrait', 'dossier'], ['portrait'])).toEqual({ portrait: 'dossier' });
    expect(walk([null, 'portrait'], ['portrait'])).toEqual({ portrait: null });
    expect(walk([null, 'dossier'], ['portrait'])).toEqual({});
  });

  it('counts the mounted panel as opened from nowhere (a deep link)', () => {
    expect(walk(['portrait'], ['portrait'])).toEqual({});
  });

  it('keeps an origin through a step back from the overlay it opened (the war tent chain)', () => {
    const chain: (PanelId | null)[] = [null, 'codex', 'page', 'portrait', 'page'];
    expect(walk(chain, ['portrait', 'page'], { page: ['portrait'] })).toEqual({ page: 'codex', portrait: 'page' });
    // Without the rule, the step back would make the page look opened from the portrait.
    expect(walk(chain, ['portrait', 'page'])).toEqual({ page: 'portrait', portrait: 'page' });
  });

  it('tracks each overlay apart (the cabin: the journal from the hero panel, the lyre from the room)', () => {
    expect(walk([null, 'heros', 'journal', 'heros', null, 'lyre'], ['journal', 'lyre'])).toEqual({ journal: 'heros', lyre: null });
  });
});
