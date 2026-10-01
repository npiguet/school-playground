// The dragon's nest (scenes UI spec §3 "Dragon's nest scene", UI3 Ruling B5): the dragon at its
// stage, in its tint, in the straw bed; its growth on a parchment in the scene; its name and tint in
// the `soin` overlay (#/p/:id/dragon?panel=soin), where it speaks from the voice plate.
import { SCENE_MUSIC } from '../../audio/catalog';
import { ART } from '../art';
import { dragonCaption, gaugeOf, nextStage, stageLabel } from '../dragon';
import { sayKey } from '../../dialogue/select';
import { thousands } from '../../text/french';
import type { CampResponse, DragonOut, DragonStage } from '../types';
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
  narrator: { enter: 'nest.enter', tour: 'nest' },
  preload: [ART.scenes.hubCamp],
};

// R11: the nest's dragon spot is x 34-68; the square picture at 28 % keeps its top below the HUD.
const WIDTH: Record<DragonStage, number> = { egg: 10, hatchling: 16, young: 21, adult: 26, illustre: 27, ancestral: 28 };

/** The dragon's cut-out in the straw bed (docs/art/scenes.md: feet at y 62, centred at x 50). */
export function nestDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'> {
  return { x: 50, y: 62, scale: WIDTH[stage], depth: 1, idle: 'breathe' };
}

/** The growth sheet (was DragonScreen's; spec 2026-09-29 dragon growth §2): the next stage and the XP
 *  toward it on the dragon's scale (R10); at the last stage « Il a fini de grandir. » and no count. */
export function growth(xp: CampResponse['xp'], stage: DragonStage): { value: number; max: number; label: string; count: string | null } {
  const g = gaugeOf(xp.total, xp);
  if (xp.next === null) return { ...g, label: 'Il a fini de grandir.', count: null };
  return { ...g, label: `Prochaine étape\u202f: ${stageLabel(nextStage(stage))}`, count: `${thousands(g.value)} sur ${thousands(g.max)} XP` };
}

/** The dragon's greeting by its stage (UI5 Ruling E12); an unnamed hatchling asks for a name. */
export function nestGreeting(d: DragonOut): DialogueLine[] {
  return [d.stage === 'hatchling' && !d.name ? sayKey('nest.name', { dragon: d }) : sayKey('nest.enter', { dragon: d })];
}

/** What the dragon says from its care overlay's voice plate (Ruling B5, immersion #23), in the
 *  first person under its own plate (UI3b playability #15). */
export function careLine(d: DragonOut): DialogueLine {
  if (d.stage === 'egg') return dragonSays(d, 'Je frémis dans la paille. Encore quelques textes défendus, et je sors de ma coquille.');
  // UI5 playability #12: the nest's greeting has already asked (`nest.name`); here is where she names it.
  if (!d.name) return dragonSays(d, 'Ici, tu peux me donner un nom et choisir ma teinte.');
  return dragonSays(d, 'Admire-moi\u202f! Tu peux changer ma teinte quand tu veux.');
}
