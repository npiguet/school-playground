import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { Profile } from '../../types';
import { SHIELD_SLOTS, TITLE_HOTSPOTS, TITLE_SCENE, titleShields, type ShieldItem } from './title';

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

  it('hangs six shields on the rails, inside the safe zone and clear of the gate and torches', () => {
    expect(SHIELD_SLOTS).toHaveLength(6);
    for (const s of SHIELD_SLOTS) {
      expect(s.x - 3.25, `${s.x}`).toBeGreaterThanOrEqual(12.5);
      expect(s.x + 3.25, `${s.x}`).toBeLessThanOrEqual(87.5);
      expect(s.x < 36 || s.x > 63, `${s.x} clear of the pillars and torches`).toBe(true);
      expect(s.y).toBeGreaterThanOrEqual(52);
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
