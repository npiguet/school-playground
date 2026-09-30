// The war tent (scenes UI spec §3 "War tent scene", UI3 Ruling B4): the lieutenants' portraits
// pinned to the canvas (a sheet opens the lieutenant's page), the map table (Éris's file) and the
// bestiary codex on its lectern. A lieutenant still asleep at the hero's class is a locked place.
import { SCENE_MUSIC } from '../../audio/catalog';
import { ART } from '../art';
import { agree, lieutenantName, sleepingCaption } from '../eris';
import { LIEUTENANT_ORDER, type LieutenantKey } from '../types';
import { st, type HotspotDef, type HotspotState, type SceneContext, type SceneDef } from '../../scene/types';
import { WAR_SHAPES, WAR_TOUR_AREAS } from './war.shapes';

export const LIEUTENANT_NAMES = Object.fromEntries(LIEUTENANT_ORDER.map((k) => [k, lieutenantName(k)])) as Record<LieutenantKey, string>;

export function isLieutenantKey(k: string): k is LieutenantKey {
  return (LIEUTENANT_ORDER as readonly string[]).includes(k);
}

function sheetState(key: LieutenantKey) {
  return ({ camp }: SceneContext): HotspotState => {
    const l = camp?.lieutenants.find((x) => x.key === key);
    if (!l) return st();
    if (!l.available) return st({ locked: true, caption: sleepingCaption(key) });
    if (l.neutralised) return st({ caption: agree('Neutralisé', key) });
    if (l.active_quest_id !== null) return st({ caption: 'Quête en cours' });
    return st();
  };
}

export const WAR_HOTSPOTS: HotspotDef[] = [
  ...LIEUTENANT_ORDER.map(
    (key): HotspotDef => ({
      id: key,
      label: LIEUTENANT_NAMES[key],
      target: 'lieutenant',
      params: { key },
      shape: WAR_SHAPES[key],
      labelPos: 'on',
      state: sheetState(key),
    }),
  ),
  { id: 'dossier', label: "Le dossier d'Éris", target: 'dossier', shape: WAR_SHAPES.dossier, labelPos: 'above', leader: true, state: () => st() },
  { id: 'bestiary', label: 'Le bestiaire', target: 'bestiaire', shape: WAR_SHAPES.bestiary, labelPos: 'above', leader: true, state: () => st() },
];

export const WAR_SCENE: SceneDef = {
  id: 'war',
  title: 'La tente de guerre',
  background: ART.scenes.warTent,
  layers: [],
  hotspots: WAR_HOTSPOTS,
  ambience: { particles: 'dust', music: SCENE_MUSIC.war },
  narrator: { enter: 'war.enter', tour: 'war' },
  // UI5 playability #10: the tour rings the whole wall of portraits when it names the lieutenants.
  tourAreas: WAR_TOUR_AREAS,
  // The only way out is the camp (final review M8).
  preload: [ART.scenes.hubCamp],
};
