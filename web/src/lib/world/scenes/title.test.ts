import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { Profile } from '../../types';
import { SHIELD_SLOTS, SHIELD_W, TITLE_HOTSPOTS, TITLE_SCENE, titleShields, type ShieldItem } from './title';

const hero = (id: number) => ({ id, name: `H${id}`, avatar: 'chouette', level: '10H' }) as Profile;
const ids = (list: ShieldItem[]) => list.map((s) => (s.kind === 'hero' ? s.profile.id : s.kind));

describe('title scene (UI3 Ruling A4)', () => {
  it('is a valid scene whose only place is the gate, handled by the screen', () => {
    expect(validateScene(TITLE_SCENE)).toEqual([]);
    expect(TITLE_HOTSPOTS.map((h) => [h.id, h.label, h.target])).toEqual([['gate', 'Entrer', null]]);
    // Playability #11: the scene's one call to action gets the grand plaque.
    expect(TITLE_HOTSPOTS[0].grand).toBe(true);
    expect(TITLE_SCENE).toMatchObject({ id: 'title', title: 'La Discorde', background: '/art/scenes/title_gates.webp' });
  });

  it('hangs each shield on a painted hook: spaced, inside the safe zone, clear of the gate (playability #13)', () => {
    expect(SHIELD_SLOTS).toHaveLength(6);
    const xs = SHIELD_SLOTS.map((s) => s.x);
    for (let i = 1; i < xs.length; i++) {
      if (i === 3) continue; // left rail -> right rail
      expect(xs[i] - xs[i - 1], `slots ${i - 1}-${i}`).toBeGreaterThanOrEqual(SHIELD_W + 0.3);
    }
    for (const s of SHIELD_SLOTS) {
      expect(s.x - SHIELD_W / 2).toBeGreaterThanOrEqual(12.5);
      expect(s.x + SHIELD_W / 2).toBeLessThanOrEqual(87.5);
      expect(s.x < 36 || s.x > 63, `x ${s.x} clear of the gate`).toBe(true);
      expect(s.y).toBeGreaterThanOrEqual(53);
      expect(s.y).toBeLessThanOrEqual(58);
    }
  });

  it('shows the newest heroes first and always ends on « Nouveau héros »', () => {
    expect(ids(titleShields([]))).toEqual(['new']);
    expect(ids(titleShields([hero(1), hero(3), hero(2)]))).toEqual([3, 2, 1, 'new']);
    expect(ids(titleShields([1, 2, 3, 4, 5].map(hero)))).toEqual([5, 4, 3, 2, 1, 'new']);
    const six = titleShields([1, 2, 3, 4, 5, 6].map(hero));
    expect(ids(six)).toEqual([6, 5, 4, 3, 'all', 'new']);
    expect(six[4]).toEqual({ kind: 'all', count: 6 });
  });
});
