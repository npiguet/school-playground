// The dragon's nest (scenes UI spec §3 "Dragon's nest scene", UI3 Ruling B5): the dragon at its
// stage, in its tint, on its stage's painting (spec 2026-10-02 nest by stage); its growth on a
// parchment in the scene; its name, tint and parure in the `soin` overlay (#/p/:id/dragon?panel=soin),
// where it speaks from the voice plate.
import { SCENE_MUSIC } from '../../audio/catalog';
import { ART } from '../art';
import { dragonCaption, gaugeOf, nextStage, stageLabel } from '../dragon';
import { sayKey } from '../../dialogue/select';
import { thousands } from '../../text/french';
import { DRAGON_STAGES, type CampResponse, type DragonOut, type DragonStage } from '../types';
import { st, type DialogueLine, type HotspotDef, type HotspotShape, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { dragonSays } from './speakers';
import { NEST_SHAPES } from './nest.shapes';
import { SPRITE_TOP_MARGIN } from './nest.sprites';

/** The dragon in its nest: tap it for its care (« Ton dragon », `?panel=soin`). */
function dragonHotspot(shape: HotspotShape): HotspotDef {
  return {
    id: 'dragon',
    label: 'Ton dragon',
    target: 'dragon',
    query: { panel: 'soin' },
    shape,
    labelPos: 'below',
    leader: true,
    state: ({ camp }) => {
      if (!camp) return st();
      const d = camp.dragon;
      if (d.stage !== 'egg' && !d.name) return st({ isNew: true, caption: 'Il attend un nom' });
      return st({ caption: dragonCaption(d) });
    },
  };
}

const NEST_BASE: Omit<SceneDef, 'background' | 'hotspots'> = {
  id: 'nest',
  title: 'Le nid du dragon',
  layers: [],
  ambience: { particles: 'embers', music: SCENE_MUSIC.nest },
  narrator: { enter: 'nest.enter', tour: 'nest' },
  preload: [ART.scenes.hubCamp],
};

// Spec 2026-10-02 nest by stage: the nest painted for the dragon's stage. One object per stage, so the
// screen's derived scene stays the same object while the stage does not change.
const BY_STAGE = Object.fromEntries(
  DRAGON_STAGES.map((s) => [s, { ...NEST_BASE, background: ART.nest[s], hotspots: [dragonHotspot(NEST_SHAPES[s].dragon)] }]),
) as Record<DragonStage, SceneDef>;

/** While /camp has not said the dragon's stage: no painting (the stage's night and « Les Muses
 *  préparent le camp… »), never another stage's nest flashing first; no hotspot yet. */
const WAITING: SceneDef = { ...NEST_BASE, background: '', hotspots: [] };

export function nestScene(stage: DragonStage | null): SceneDef {
  return stage ? BY_STAGE[stage] : WAITING;
}

/** The registry's nest (scenes/index.ts SCENES: one scene per place). */
export const NEST_SCENE: SceneDef = BY_STAGE.egg;
/** The six nests, in stage order (the budget test checks each painting). */
export const NEST_STAGE_SCENES: SceneDef[] = DRAGON_STAGES.map((s) => BY_STAGE[s]);

/** The dragon's place in each nest painting (spec 2026-10-02 nest by stage; docs/art/scenes.md
 *  "nest_<stage>"), art % of the 16:9 frame: `x` its centre, `y` its feet line, `w` its width (the
 *  square sprite stands w x 16/9 tall); `sheet` the growth sheet's side. Up to the young stage the
 *  sheet stands beside the dragon on the left; from the adult it moves to the right side of the frame
 *  and the dragon shifts left. Tuned on the paintings with tools/art/nest_preview.py. */
export const NEST_STAGES: Record<DragonStage, { x: number; y: number; w: number; sheet: 'left' | 'right' }> = {
  egg: { x: 50, y: 54, w: 16, sheet: 'left' },
  hatchling: { x: 50, y: 55, w: 21, sheet: 'left' },
  young: { x: 51.5, y: 77.8, w: 38, sheet: 'left' },
  adult: { x: 44, y: 81.2, w: 40, sheet: 'right' },
  illustre: { x: 44, y: 88.9, w: 44, sheet: 'right' },
  ancestral: { x: 44, y: 94, w: 47, sheet: 'right' },
};

/** The HUD's bottom edge in art % where it reaches lowest: 71.5 px (as the e2e measures `header.hud`:
 *  8 px padding, its row, 8 px) of a 1280x720 art box, 9.9 %. The dragon's picture stays below it. */
export const HUD_LINE = 10;
/** The HUD's bottom edge in art % on the shortest art box the nest supports, 640 px tall (a 1024x640
 *  window, controller ruling N3): the HUD stays 71.5 px, 11.2 % of it. The dragon's painted head
 *  (its picture's top plus the sprite's transparent margin, nest.sprites.ts `SPRITE_TOP_MARGIN`)
 *  stays below it. */
export const HUD_LINE_SHORT = (71.5 / 640) * 100;
/** The growth sheet's top, and its band on each side (art %, its rods included), inside the 4:3 safe
 *  zone and clear of the HUD. */
export const SHEET_TOP = 18;
export const SHEET_X = { left: { x: 13.5, w: 19 }, right: { x: 68.5, w: 19 } } as const;

/** The top edge of the dragon's layer, art %. */
export function dragonTop(stage: DragonStage): number {
  const { y, w } = NEST_STAGES[stage];
  return y - (w * 16) / 9;
}

/** The top of the dragon's painted head, art %: its picture's top plus the sprite's margin. */
export function dragonHead(stage: DragonStage): number {
  const { w } = NEST_STAGES[stage];
  return dragonTop(stage) + SPRITE_TOP_MARGIN[stage] * ((w * 16) / 9);
}

/** The dragon's cut-out on its stage's painting. Depth 0 and no idle: the box never drifts, as a
 *  parallax or a breath read as floating (playtest 2026-10-02). A hatched dragon moves on its own
 *  inside this same box (LivingDragon, spec 2026-10-02 living dragon); the egg, and any dragon under
 *  reduced motion or without WebGL2, stays still. */
export function nestDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'> {
  const { x, y, w } = NEST_STAGES[stage];
  return { x, y, scale: w, depth: 0, idle: 'none' };
}

/** The growth sheet (was DragonScreen's; spec 2026-09-29 dragon growth §2): the next stage and the XP
 *  toward it on the dragon's scale (R10); at the last stage « Il a fini de grandir. » and no count. */
export function growth(xp: CampResponse['xp'], stage: DragonStage): { value: number; max: number; label: string; count: string | null } {
  const g = gaugeOf(xp.total, xp);
  if (xp.next === null) return { ...g, label: 'Il a fini de grandir.', count: null };
  return { ...g, label: `Prochaine étape\u202f: ${stageLabel(nextStage(stage))}`, count: `${thousands(g.value)} sur ${thousands(g.max)} XP` };
}

/** The dragon's greeting by its stage (UI5 Ruling E12); a hatched dragon without a name
 *  asks for one, at any stage (a dragon that grew while unnamed still asks). */
export function nestGreeting(d: DragonOut): DialogueLine[] {
  return [d.stage !== 'egg' && !d.name ? sayKey('nest.name', { dragon: d }) : sayKey('nest.enter', { dragon: d })];
}

/** What the dragon says from its care overlay's voice plate (Ruling B5, immersion #23), in the
 *  first person under its own plate (UI3b playability #15). */
export function careLine(d: DragonOut): DialogueLine {
  if (d.stage === 'egg') return dragonSays(d, 'Je frémis dans la paille. Encore quelques textes défendus, et je sors de ma coquille.');
  // UI5 playability #12: the nest's greeting has already asked (`nest.name`); here is where she names it.
  if (!d.name) return dragonSays(d, 'Ici, tu peux me donner un nom et choisir ma teinte.');
  return dragonSays(d, 'Admire-moi\u202f! Tu peux changer ma teinte quand tu veux.');
}
