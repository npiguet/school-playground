import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, DragonOut } from '../types';
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
    const widths = (['egg', 'hatchling', 'young', 'adult'] as const).map((s) => nestDragonLayer(s).scale);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(widths[3]).toBeLessThanOrEqual(34);
  });

  it('asks for a name once it has hatched, and says who it is otherwise', () => {
    expect(state(egg)).toMatchObject({ isNew: false, caption: 'Un œuf de dragon' });
    expect(state({ ...egg, stage: 'hatchling' })).toMatchObject({ isNew: true, caption: 'Il attend un nom' });
    expect(state({ ...egg, stage: 'young', name: 'Braise' })).toMatchObject({ isNew: false, caption: 'Braise' });
  });

  it('measures growth to the next stage in words, with a real plural', () => {
    expect(growth(egg)).toEqual({ value: 0, max: 1, label: "Pour grandir : 1 ruse d'Éris neutralisée" });
    expect(growth({ ...egg, stage: 'hatchling', neutralised: 1, next_stage_at: 3 })).toEqual({ value: 1, max: 3, label: "Pour grandir : 3 ruses d'Éris neutralisées" });
    expect(growth({ ...egg, stage: 'adult', neutralised: 6, next_stage_at: null })).toEqual({ value: 6, max: 6, label: 'Il a fini de grandir.' });
  });

  it('greets with its stage line and speaks in its care (immersion #23)', () => {
    expect(nestGreeting(egg).map((l) => l.text)).toEqual(["Toc, toc… Chaque piège d'Éris déjoué me fait frémir dans ma coquille."]);
    expect(careLine(egg)).toMatchObject({ speaker: 'dragon', text: "Je frémis dans la paille. J'éclorai quand une ruse d'Éris sera neutralisée." });
    expect(careLine({ ...egg, stage: 'hatchling' }).text).toBe('Te revoilà ! Tu me donnes un nom ?');
    expect(careLine({ ...egg, stage: 'young', name: 'Braise' }).text).toBe('Admire-moi ! Tu peux changer ma teinte quand tu veux.');
    for (const d of [egg, { ...egg, stage: 'young' as const, name: 'Braise' }]) expect(careLine(d).text.length).toBeLessThanOrEqual(160);
  });
});
