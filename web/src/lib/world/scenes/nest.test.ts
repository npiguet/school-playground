import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import { LINES } from '../../dialogue/content';
import { frenchSpacing } from '../../text/french';
import { variantsOf } from '../../../testing/dialogue';
import { DRAGON_STAGES, type CampResponse, type DragonOut } from '../types';
import { NEST_HOTSPOTS, NEST_SCENE, careLine, growth, nestDragonLayer, nestGreeting } from './nest';

const egg = { name: null, tint: 'bronze', stage: 'egg', neutralised: 0, available: 6, next_stage_at: 1, unlocked_tints: ['bronze'] } as DragonOut;
const state = (d: DragonOut) => NEST_HOTSPOTS[0].state({ camp: { dragon: d } as CampResponse, catalog: null });

describe("dragon's nest (UI3 Ruling B5)", () => {
  it('is a valid scene whose plaque echoes the hub label; the dragon opens its care', () => {
    expect(validateScene(NEST_SCENE)).toEqual([]);
    expect(NEST_SCENE).toMatchObject({ id: 'nest', title: 'Le nid du dragon', background: '/art/scenes/nest.webp' });
    expect(NEST_SCENE.preload).toEqual(['/art/scenes/hub_camp.webp']);
    expect(NEST_HOTSPOTS.map((h) => [h.id, h.target, h.query, h.label])).toEqual([['dragon', 'dragon', { panel: 'soin' }, 'Ton dragon']]);
  });

  it('seats the dragon in the straw bed, bigger as it grows', () => {
    expect(nestDragonLayer('egg')).toMatchObject({ x: 50, y: 62, depth: 1 });
    const widths = DRAGON_STAGES.map((s) => nestDragonLayer(s).scale);
    expect(widths.every((w, i) => i === 0 || w > widths[i - 1]), 'bigger at every stage').toBe(true);
    expect(widths[5]).toBeLessThanOrEqual(34);
  });

  it('asks for a name once it has hatched, and says who it is otherwise', () => {
    expect(state(egg)).toMatchObject({ isNew: false, caption: 'Un œuf de dragon' });
    expect(state({ ...egg, stage: 'hatchling' })).toMatchObject({ isNew: true, caption: 'Il attend un nom' });
    expect(state({ ...egg, stage: 'young', name: 'Braise' })).toMatchObject({ isNew: false, caption: 'Braise' });
  });

  it('measures growth to the next stage in words, with a real plural', () => {
    expect(growth(egg)).toEqual({ value: 0, max: 1, label: "Pour grandir\u202f: 1 ruse d'Éris neutralisée" });
    expect(growth({ ...egg, stage: 'hatchling', neutralised: 1, next_stage_at: 3 })).toEqual({ value: 1, max: 3, label: "Pour grandir\u202f: 3 ruses d'Éris neutralisées" });
    expect(growth({ ...egg, stage: 'adult', neutralised: 6, next_stage_at: null })).toEqual({ value: 6, max: 6, label: 'Il a fini de grandir.' });
  });

  it('greets by its stage, asks an unnamed hatchling\'s name (Ruling E12), and speaks in its care (immersion #23)', () => {
    const [hello] = nestGreeting(egg);
    expect(hello).toMatchObject({ key: 'nest.enter', speaker: 'dragon', name: "L'œuf" });
    expect(LINES['nest.enter'].filter((l) => l.when?.stage?.includes('egg')).map((l) => frenchSpacing(l.text))).toContain(hello.text);
    expect(nestGreeting({ ...egg, stage: 'hatchling' })[0]).toMatchObject({ key: 'nest.name' });
    expect(variantsOf('nest.name')).toContain(nestGreeting({ ...egg, stage: 'hatchling' })[0].text);
    expect(nestGreeting({ ...egg, stage: 'hatchling', name: 'Braise' })[0]).toMatchObject({ key: 'nest.enter', name: 'Braise' });
    expect(careLine(egg)).toMatchObject({ speaker: 'dragon', text: 'Je frémis dans la paille. Encore quelques textes défendus, et je sors de ma coquille.' });
    expect(careLine({ ...egg, stage: 'hatchling' }).text).toBe('Ici, tu peux me donner un nom et choisir ma teinte.');
    expect(careLine({ ...egg, stage: 'young', name: 'Braise' }).text).toBe('Admire-moi\u202f! Tu peux changer ma teinte quand tu veux.');
    for (const d of [egg, { ...egg, stage: 'young' as const, name: 'Braise' }]) expect(careLine(d).text.length).toBeLessThanOrEqual(160);
  });
});
