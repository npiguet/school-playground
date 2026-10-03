import { describe, expect, it } from 'vitest';
import { variantsOf } from '../../../testing/dialogue';
import { validateScene } from '../../scene/validate';
import type { CampResponse } from '../types';
import type { DragonOut } from '../types';
import {
  CABIN_HOTSPOTS,
  CABIN_SCENE,
  PALAIS_SCENE,
  VILLA_SCENE,
  cabinGreeting,
  guideLine,
  houseScene,
  journalLine,
  lyreLine,
  trophiesLine,
} from './cabin';

const dragon = { name: 'Braise', tint: 'bronze', stage: 'young', unlocked_tints: ['bronze'], worn: [] } as DragonOut;

// Spec 2026-09-29 drachmes §3 (R21, review focus 5).
describe('the three houses', () => {
  it('each shows its own room, its own name, the same three places', () => {
    expect([houseScene('cabin').title, houseScene('villa').title, houseScene('palais').title]).toEqual(['Ta cabane', 'Ta villa', 'Ton palais']);
    expect([VILLA_SCENE.background, PALAIS_SCENE.background]).toEqual(['/art/scenes/villa.webp', '/art/scenes/palais.webp']);
    for (const s of [VILLA_SCENE, PALAIS_SCENE]) {
      expect(s.id).toBe('cabin');
      expect(s.hotspots.map((h) => [h.id, h.label, h.target])).toEqual(CABIN_SCENE.hotspots.map((h) => [h.id, h.label, h.target]));
      expect(s.narrator).toEqual(CABIN_SCENE.narrator);
      expect(validateScene(s), s.title).toEqual([]);
    }
  });

  // A guard against the old limit's names coming back, not the proof that there is no limit: that is
  // treasures.test.ts « shows all eighteen at once », the server's all-nine display tests and the
  // e2e « a fifth piece goes on display » (scenes-cabin.spec.ts).
  it('exports neither MAX_DISPLAYED_DECOR nor WALLS_FULL_LINE again (spec 2026-10-02 house treasures)', async () => {
    const mod = await import('./cabin');
    expect('MAX_DISPLAYED_DECOR' in mod).toBe(false);
    expect('WALLS_FULL_LINE' in mod).toBe(false);
  });

  // Spec 2026-10-02 house treasures: the journal's plaque goes below where the lanterne hangs above
  // the desk (the villa, the palais), above in the cabin; « Tes trésors » keeps its caption below.
  it("puts each place's plaque on its house's side", () => {
    expect((['cabin', 'villa', 'palais'] as const).map((h) => houseScene(h).hotspots.map((d) => d.labelPos))).toEqual([
      ['below', 'above', 'above'],
      ['below', 'below', 'above'],
      ['below', 'below', 'above'],
    ]);
  });
});

describe('the cabin (UI3 Ruling B6)', () => {
  it('is a valid scene whose plaque echoes the hub label', () => {
    expect(validateScene(CABIN_SCENE)).toEqual([]);
    expect(CABIN_SCENE).toMatchObject({ id: 'cabin', title: 'Ta cabane', background: '/art/scenes/cabin.webp' });
    expect(CABIN_SCENE.preload).toEqual(['/art/scenes/hub_camp.webp']);
  });

  it('lets the dragon speak at home: a greeting and a line on each overlay but the hero panel (UI3b playability #7)', () => {
    const greeting = cabinGreeting(dragon);
    expect(greeting).toEqual([expect.objectContaining({ key: 'cabin.enter', speaker: 'dragon', name: 'Braise' })]);
    expect(variantsOf('cabin.enter')).toContain(greeting[0].text);
    // Task 7 fix round 1: the greeting is heard in every house, so it names none of them.
    expect(variantsOf('cabin.enter').length).toBeGreaterThanOrEqual(3);
    for (const v of variantsOf('cabin.enter')) expect(v).not.toMatch(/cabane|villa|palais/i);
    expect(trophiesLine(dragon, null, 30).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère.");
    expect(trophiesLine(dragon, 0, 30).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère. Le premier sera en bois\u202f!");
    expect(trophiesLine(dragon, 2, 30).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère. Il en reste 28 à gagner\u202f!");
    expect(trophiesLine(dragon, 24, 25).text).toBe("Chaque sceau que tu gagnes pose un trophée sur l'étagère. Il en reste un à gagner\u202f!");
    expect(trophiesLine(dragon, 30, 30).text).toBe("Tous les sceaux sont gagnés\u202f: l'étagère brille d'orichalque\u202f!");
    expect(journalLine(dragon).text).toBe('Ton journal se souvient de chaque texte défendu.');
    expect(lyreLine(dragon).text).toBe("Règle ici la musique, les bruitages et la voix qui te lit la dictée\u202f; les visites du camp et son guide t'attendent aussi.");
    expect(guideLine(dragon).text).toBe('Tout ce que je sais du camp est écrit ici. Relis-le quand tu veux.');
    for (const l of [trophiesLine(dragon, 4, 30), journalLine(dragon), lyreLine(dragon), guideLine(dragon), ...cabinGreeting(dragon)]) {
      expect(l.text.length).toBeLessThanOrEqual(160);
      expect(l.portrait).toBe('/art/dragon/dragon_young_cut.webp');
    }
  });

  it('opens the trophies, the journal and the lyre', () => {
    expect(CABIN_HOTSPOTS.map((h) => [h.id, h.target, h.query ?? null, h.label])).toEqual([
      ['trophies', 'cabin', { panel: 'tresors' }, 'Tes trésors'],
      ['journal', 'stats', null, 'Ton journal'],
      ['lyre', 'settings', null, 'La lyre'],
    ]);
    expect(CABIN_HOTSPOTS[0].state({ camp: { rewards_count: 2 } as CampResponse, catalog: null }).caption).toBe('2 trésors');
  });
});
