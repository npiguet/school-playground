// The dragon's nest (scenes UI spec §3 "Dragon's nest scene", UI3 Ruling B5): the dragon at its
// stage, in its tint, in the straw bed; its growth on a parchment in the scene; its name and tint in
// the `soin` overlay (#/p/:id/dragon?panel=soin), where it speaks from the voice plate.
import { SCENE_MUSIC } from '../../audio/catalog';
import { ART } from '../art';
import { dragonCaption, stageLine } from '../dragon';
import { plural } from '../../text/french';
import type { DragonOut, DragonStage } from '../types';
import { st, type DialogueLine, type HotspotDef, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { dragonSays } from './speakers';
import { NEST_SHAPES } from './nest.shapes';

export const NEST_HOTSPOTS: HotspotDef[] = [
  {
    id: 'dragon',
    label: 'Ton dragon',
    target: 'dragon',
    query: { panel: 'soin' },
    shape: NEST_SHAPES.dragon,
    labelPos: 'below',
    leader: true,
    state: ({ camp }) => {
      if (!camp) return st();
      const d = camp.dragon;
      if (d.stage !== 'egg' && !d.name) return st({ isNew: true, caption: 'Il attend un nom' });
      return st({ caption: dragonCaption(d) });
    },
  },
];

export const NEST_SCENE: SceneDef = {
  id: 'nest',
  title: 'Le nid du dragon',
  background: ART.scenes.nest,
  layers: [],
  hotspots: NEST_HOTSPOTS,
  ambience: { particles: 'embers', music: SCENE_MUSIC.nest },
  narrator: { enter: 'nest.enter', firstVisit: 'nest.first' },
  preload: [ART.scenes.hubCamp],
};

const WIDTH: Record<DragonStage, number> = { egg: 10, hatchling: 16, young: 21, adult: 26 };

/** The dragon's cut-out in the straw bed (docs/art/scenes.md: feet at y 62, centred at x 50). */
export function nestDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'> {
  return { x: 50, y: 62, scale: WIDTH[stage], depth: 1, idle: 'breathe' };
}

/** The growth gauge (was DragonScreen's), in the camp's words with a real plural (UI3b playability
 *  #5: Éris's « ruses », never « techniques »). */
export function growth(d: DragonOut): { value: number; max: number; label: string } {
  const max = d.next_stage_at ?? Math.max(1, d.available);
  if (d.next_stage_at === null) return { value: d.neutralised, max, label: 'Il a fini de grandir.' };
  return { value: d.neutralised, max, label: `Pour grandir : ${plural(d.next_stage_at, "ruse d'Éris neutralisée", "ruses d'Éris neutralisées")}` };
}

export function nestGreeting(d: DragonOut): DialogueLine[] {
  return [dragonSays(d, stageLine(d.stage, d.name, Math.max(0, d.available - d.neutralised)))];
}

/** What the dragon says from its care overlay's voice plate (Ruling B5, immersion #23), in the
 *  first person under its own plate (UI3b playability #15). */
export function careLine(d: DragonOut): DialogueLine {
  if (d.stage === 'egg') return dragonSays(d, "Je frémis dans la paille. J'éclorai quand une ruse d'Éris sera neutralisée.");
  if (!d.name) return dragonSays(d, 'Te revoilà ! Tu me donnes un nom ?');
  return dragonSays(d, 'Admire-moi ! Tu peux changer ma teinte quand tu veux.');
}
