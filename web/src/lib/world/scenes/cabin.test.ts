import { describe, expect, it } from 'vitest';
import { boxesOverlap, shapeBox } from '../../scene/geometry';
import { validateScene } from '../../scene/validate';
import type { CampResponse } from '../types';
import { CABIN_HOTSPOTS, CABIN_SCENE, DECOR_SLOTS } from './cabin';

describe('the cabin (UI3 Ruling B6)', () => {
  it('is a valid scene whose plaque echoes the hub label', () => {
    expect(validateScene(CABIN_SCENE)).toEqual([]);
    expect(CABIN_SCENE).toMatchObject({ id: 'cabin', title: 'Ta cabane', background: '/art/scenes/cabin.webp' });
    expect(CABIN_SCENE.preload).toEqual(['/art/scenes/hub_camp.webp']);
  });

  it('opens the trophies, the journal and the lyre', () => {
    expect(CABIN_HOTSPOTS.map((h) => [h.id, h.target, h.query ?? null, h.label])).toEqual([
      ['trophies', 'cabin', { panel: 'tresors' }, 'Tes trésors'],
      ['journal', 'stats', null, 'Ton journal'],
      ['lyre', 'settings', null, 'La lyre'],
    ]);
    expect(CABIN_HOTSPOTS[0].state({ camp: { rewards_count: 2 } as CampResponse, catalog: null }).caption).toBe('2 trésors');
  });

  it('hangs the displayed decor on free wall spots inside the safe zone', () => {
    expect(DECOR_SLOTS).toHaveLength(4);
    for (const s of DECOR_SLOTS) {
      expect(s.x).toBeGreaterThan(14.5);
      expect(s.x).toBeLessThan(85.5);
      expect(s.y).toBeGreaterThan(17);
      const spot = { x: s.x - 2, y: s.y - 3.5, w: 4, h: 7 };
      for (const h of CABIN_HOTSPOTS) expect(boxesOverlap(spot, shapeBox(h.shape)), `${s.x},${s.y} vs ${h.id}`).toBe(false);
    }
  });
});
