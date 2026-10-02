import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import { LINES } from '../../dialogue/content';
import { frenchSpacing } from '../../text/french';
import { variantsOf } from '../../../testing/dialogue';
import { DRAGON_STAGES, type CampResponse, type DragonOut } from '../types';
import { DIALOGUE_DOCK, HUD_BAND, SAFE_ZONE } from '../../scene/geometry';
import { HUD_LINE, HUD_LINE_SHORT, NEST_SCENE, NEST_STAGES, SHEET_X, careLine, dragonHead, dragonTop, growth, nestDragonLayer, nestGreeting, nestScene } from './nest';
import { NEST_SHAPES } from './nest.shapes';

const egg = { name: null, tint: 'bronze', stage: 'egg', unlocked_tints: ['bronze'], worn: [] } as DragonOut;
const state = (d: DragonOut) => nestScene(d.stage).hotspots[0].state({ camp: { dragon: d } as CampResponse, catalog: null });

describe("dragon's nest (UI3 Ruling B5)", () => {
  it('paints the nest of its stage, a valid scene whose plaque echoes the hub label; the dragon opens its care (spec 2026-10-02 nest by stage)', () => {
    for (const s of DRAGON_STAGES) {
      const scene = nestScene(s);
      expect(validateScene(scene), s).toEqual([]);
      expect(scene, s).toMatchObject({ id: 'nest', title: 'Le nid du dragon', background: `/art/scenes/nest_${s}.webp`, preload: ['/art/scenes/hub_camp.webp'] });
      expect(scene.hotspots.map((h) => [h.id, h.target, h.query, h.label]), s).toEqual([['dragon', 'dragon', { panel: 'soin' }, 'Ton dragon']]);
      // One object per stage: the screen's $derived scene never changes while the stage does not.
      expect(nestScene(s), s).toBe(scene);
    }
    // Review Focus 1: before /camp says the stage, no painting (never the egg's for a grown dragon).
    expect(nestScene(null)).toMatchObject({ id: 'nest', title: 'Le nid du dragon', background: '', hotspots: [] });
    expect(NEST_SCENE).toBe(nestScene('egg'));
  });

  it('seats the dragon on its painting, much bigger at every stage, its head below the HUD (spec 2026-10-02 nest by stage)', () => {
    for (const s of DRAGON_STAGES) {
      const { x, y, w } = NEST_STAGES[s];
      expect(nestDragonLayer(s), s).toEqual({ x, y, scale: w, depth: 0, idle: 'none' });
      expect(dragonTop(s), s).toBeCloseTo(y - (w * 16) / 9, 5);
      expect(dragonTop(s), `${s}: the head below the HUD`).toBeGreaterThanOrEqual(HUD_LINE);
      // Controller ruling N3: on the shortest art box (640 px) the HUD reaches 11.2 %; the painted
      // head still clears it.
      expect(dragonHead(s), `${s}: the painted head below the HUD on a 640 px art box`).toBeGreaterThanOrEqual(HUD_LINE_SHORT);
      expect(y, `${s}: the feet in the frame`).toBeLessThanOrEqual(100);
      expect(x - w / 2, `${s}: inside the safe zone`).toBeGreaterThanOrEqual(SAFE_ZONE.x);
      expect(x + w / 2, `${s}: inside the safe zone`).toBeLessThanOrEqual(SAFE_ZONE.x + SAFE_ZONE.w);
    }
    const widths = DRAGON_STAGES.map((s) => NEST_STAGES[s].w);
    expect(widths.every((w, i) => i === 0 || w > widths[i - 1]), 'bigger at every stage').toBe(true);
    // She still looks at the dragon first: the ancestral fills nearly half the frame's width.
    expect(NEST_STAGES.ancestral.w).toBeGreaterThanOrEqual(40);
  });

  it('keeps the growth sheet beside the dragon up to the young stage and at the side from the adult, never over the dragon', () => {
    expect(DRAGON_STAGES.map((s) => NEST_STAGES[s].sheet)).toEqual(['left', 'left', 'left', 'right', 'right', 'right']);
    for (const s of DRAGON_STAGES) {
      const { x, w, sheet } = NEST_STAGES[s];
      const band = SHEET_X[sheet];
      const e = NEST_SHAPES[s].dragon;
      expect(band.x, s).toBeGreaterThanOrEqual(SAFE_ZONE.x);
      expect(band.x + band.w, s).toBeLessThanOrEqual(SAFE_ZONE.x + SAFE_ZONE.w);
      if (sheet === 'left') {
        expect(band.x + band.w, `${s}: the sheet left of the dragon`).toBeLessThanOrEqual(x - w / 2);
        expect(band.x + band.w, `${s}: the sheet left of the hotspot (Review Focus 4)`).toBeLessThanOrEqual(e.cx - e.rx);
      } else {
        expect(band.x, `${s}: the sheet right of the dragon`).toBeGreaterThanOrEqual(x + w / 2);
        expect(band.x, `${s}: the sheet right of the hotspot (Review Focus 4)`).toBeGreaterThanOrEqual(e.cx + e.rx);
        // The dragon shifts the other way, left of the frame's centre.
        expect(x, s).toBeLessThan(50);
      }
    }
  });

  it('covers the dragon with its hotspot at every stage, its plaque clear of the HUD and the dialogue dock', () => {
    for (const s of DRAGON_STAGES) {
      const { x, y, w } = NEST_STAGES[s];
      const top = dragonTop(s);
      const e = NEST_SHAPES[s].dragon;
      expect(nestScene(s).hotspots[0].shape, s).toBe(e);
      expect(e.cx, `${s}: centred on the dragon`).toBeGreaterThan(x - w / 2);
      expect(e.cx, `${s}: centred on the dragon`).toBeLessThan(x + w / 2);
      expect(e.cy, `${s}: centred on the dragon`).toBeGreaterThan(top);
      expect(e.cy, `${s}: centred on the dragon`).toBeLessThan(y);
      expect(2 * e.rx, `${s}: as wide as most of the dragon`).toBeGreaterThanOrEqual(0.6 * w);
      expect(2 * e.ry, `${s}: as tall as half the dragon`).toBeGreaterThanOrEqual(0.5 * (y - top));
      expect(e.cy - e.ry, `${s}: below the HUD band`).toBeGreaterThanOrEqual(HUD_BAND);
      // Review Focus 3: the plaque hangs below the ellipse (a 16 px leader and two lines, ~9 % of a
      // 720 px art box), so the ellipse ends 10 % above the dialogue dock.
      expect(e.cy + e.ry, `${s}: room for the plaque above the dialogue dock`).toBeLessThanOrEqual(DIALOGUE_DOCK.y - 10);
    }
  });

  it('asks for a name once it has hatched, and says who it is otherwise', () => {
    expect(state(egg)).toMatchObject({ isNew: false, caption: 'Un œuf de dragon' });
    expect(state({ ...egg, stage: 'hatchling' })).toMatchObject({ isNew: true, caption: 'Il attend un nom' });
    expect(state({ ...egg, stage: 'young', name: 'Braise' })).toMatchObject({ isNew: false, caption: 'Braise' });
  });

  it('measures growth toward the next stage in XP, and says when it has finished growing (spec 2026-09-29 dragon growth §2)', () => {
    expect(growth({ total: 40, floor: 0, next: 100 }, 'egg')).toEqual({ value: 40, max: 100, label: 'Prochaine étape\u202f: Dragonnet', count: '40 sur 100 XP' });
    expect(growth({ total: 3100, floor: 1200, next: 5000 }, 'young')).toEqual({ value: 1900, max: 3800, label: 'Prochaine étape\u202f: Dragon adulte', count: '1\u202f900 sur 3\u202f800 XP' });
    expect(growth({ total: 300, floor: 5000, next: 15000 }, 'adult')).toMatchObject({ value: 0, count: '0 sur 10\u202f000 XP' });
    expect(growth({ total: 41000, floor: 40000, next: null }, 'ancestral')).toEqual({ value: 1, max: 1, label: 'Il a fini de grandir.', count: null });
  });

  it('greets by its stage, asks an unnamed dragon\'s name at any hatched stage (Ruling E12), and speaks in its care (immersion #23)', () => {
    const [hello] = nestGreeting(egg);
    expect(hello).toMatchObject({ key: 'nest.enter', speaker: 'dragon', name: "L'œuf" });
    expect(LINES['nest.enter'].filter((l) => l.when?.stage?.includes('egg')).map((l) => frenchSpacing(l.text))).toContain(hello.text);
    expect(nestGreeting({ ...egg, stage: 'hatchling' })[0]).toMatchObject({ key: 'nest.name' });
    expect(variantsOf('nest.name')).toContain(nestGreeting({ ...egg, stage: 'hatchling' })[0].text);
    // A dragon that grew past the hatchling unnamed still asks (final review I1).
    expect(nestGreeting({ ...egg, stage: 'young' })[0]).toMatchObject({ key: 'nest.name' });
    expect(nestGreeting({ ...egg, stage: 'ancestral' })[0]).toMatchObject({ key: 'nest.name' });
    expect(nestGreeting({ ...egg, stage: 'hatchling', name: 'Braise' })[0]).toMatchObject({ key: 'nest.enter', name: 'Braise' });
    expect(careLine(egg)).toMatchObject({ speaker: 'dragon', text: 'Je frémis dans la paille. Encore quelques textes défendus, et je sors de ma coquille.' });
    expect(careLine({ ...egg, stage: 'hatchling' }).text).toBe('Ici, tu peux me donner un nom et choisir ma teinte.');
    expect(careLine({ ...egg, stage: 'young', name: 'Braise' }).text).toBe('Admire-moi\u202f! Tu peux changer ma teinte quand tu veux.');
    for (const d of [egg, { ...egg, stage: 'young' as const, name: 'Braise' }]) expect(careLine(d).text.length).toBeLessThanOrEqual(160);
  });
});
