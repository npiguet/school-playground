// The camp as a hub scene (scenes UI spec §3 "Hub scene", §9 UI1): which places exist, where
// they lead (the pre-UI1 screens, unchanged), and what each shows from /camp. Geometry lives in
// camp.shapes.ts (pure data, authored by hand from docs/art/scenes.md and re-checked with the
// `?debug` overlay whenever UI2 repaints the camp).
import { ART } from '../art';
import { TINT_FILTERS, stageActivity, stageLabel, stageLine } from '../dragon';
import type { CampResponse, DragonOut, WorldCatalog } from '../types';
import {
  IDLE_HOTSPOT,
  type DialogueLine,
  type HotspotDef,
  type HotspotState,
  type SceneDef,
  type SceneLayerDef,
} from '../../scene/types';
import { CAMP_SHAPES } from './camp.shapes';

export type CampHotspotId = keyof typeof CAMP_SHAPES;

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

/** The dragon hotspot's caption: its name, else what it is. */
export function dragonCaption(d: DragonOut): string {
  return d.name ?? (d.stage === 'egg' ? 'Un œuf de dragon' : stageLabel(d.stage));
}

/** The boss reward "known in advance" (SP3 decisions 9/12), or a generic phrase. */
export function bossRewardName(camp: CampResponse, catalog: WorldCatalog | null): string {
  const tier = camp.boss.tier_available;
  if (tier === null) return 'une récompense';
  const rewardId = catalog?.boss_rewards[String(tier)];
  const name = rewardId ? catalog?.rewards[rewardId]?.name : undefined;
  return name ?? 'une récompense';
}

export const CAMP_HOTSPOTS: HotspotDef[] = [
  {
    id: 'dragon',
    label: 'Le nid du dragon',
    target: 'dragon',
    shape: CAMP_SHAPES.dragon,
    labelPos: 'below',
    // Task 10b round 1 #3: a `title` tooltip never shows on iPad (no mouse hover on the target
    // device), so what the dragon is up to (stageActivity, a short version of dragon.ts's
    // stageLine) rides along here instead, next to its identity (dragonCaption).
    state: ({ camp }) =>
      st({ caption: camp ? `${dragonCaption(camp.dragon)} · ${stageActivity(camp.dragon.stage)}` : null }),
  },
  {
    id: 'oracle',
    label: 'Le chemin de Delphes',
    target: 'oracle',
    shape: CAMP_SHAPES.oracle,
    labelPos: 'below',
    state: ({ camp }) => {
      if (!camp) return st();
      const sealed = camp.oracle.status === 'sealed';
      return st({ isNew: sealed, caption: sealed ? 'Trois rouleaux scellés' : 'Quête en cours' });
    },
  },
  {
    id: 'quests',
    label: 'Le tableau des quêtes',
    target: 'quests',
    shape: CAMP_SHAPES.quests,
    labelPos: 'above',
    state: ({ camp }) => {
      const n = camp?.quests.filter((q) => q.status === 'active').length ?? 0;
      return st({ badge: n > 0 ? n : null });
    },
  },
  {
    id: 'parchemins',
    label: 'La tente des parchemins',
    target: 'library',
    shape: CAMP_SHAPES.parchemins,
    labelPos: 'above',
    state: () => st(),
  },
  {
    id: 'dossier',
    label: 'La tente de guerre',
    target: 'dossier',
    shape: CAMP_SHAPES.dossier,
    labelPos: 'below',
    state: () => st({ caption: "Le dossier d'Éris" }),
  },
  {
    id: 'bestiary',
    label: 'Le bestiaire',
    target: 'bestiaire',
    shape: CAMP_SHAPES.bestiary,
    labelPos: 'below',
    state: ({ camp }) => {
      if (!camp) return st();
      const available = camp.lieutenants.filter((l) => l.available).length;
      const neutralised = camp.lieutenants.filter((l) => l.neutralised).length;
      return st({ caption: `${neutralised} / ${available} ruses neutralisées · les vrais mythes` });
    },
  },
  {
    id: 'cabin',
    label: 'Ta cabane',
    target: 'cabin',
    shape: CAMP_SHAPES.cabin,
    labelPos: 'below',
    state: ({ camp }) => st({ caption: camp ? `${camp.rewards_count} trésor(s)` : null }),
  },
  {
    id: 'boss',
    label: 'Le sentier de la bataille',
    target: 'boss',
    shape: CAMP_SHAPES.boss,
    labelPos: 'below',
    state: ({ camp, catalog }) => {
      if (!camp || (camp.boss.tier_available === null && camp.boss.active_quest_id === null)) return st({ visible: false });
      const engaged = camp.quests.some((q) => q.kind === 'boss' && q.status === 'active');
      return st({
        isNew: !engaged,
        caption: engaged
          ? 'Un combat est déjà engagé contre Éris.'
          : `Combat ${camp.boss.tier_available} : ${bossRewardName(camp, catalog)}`,
      });
    },
  },
];

export const CAMP_SCENE: SceneDef = {
  id: 'camp',
  title: 'Le camp',
  background: ART.scenes.camp,
  layers: [],
  hotspots: CAMP_HOTSPOTS,
  ambience: { particles: 'embers', music: null },
  narrator: { enter: 'camp.enter', firstVisit: 'camp.first' },
  preload: [ART.scenes.delphes, ART.scenes.parchemins],
};

/** Where the player's dragon cut-out stands (its image depends on the stage, so Camp.svelte
 *  renders it as a SceneLayer with this placement). Matches CAMP_SHAPES.dragon. */
export const CAMP_DRAGON_LAYER: Omit<SceneLayerDef, 'id' | 'src' | 'alt'> = {
  x: 18,
  y: 80,
  scale: 9,
  depth: 2,
  idle: 'breathe',
};

/** UI1's static greeting (dialogue content files arrive in UI5). */
export function campGreeting(profileName: string, camp: CampResponse): DialogueLine[] {
  const d = camp.dragon;
  const who = {
    speaker: 'dragon' as const,
    name: d.name ?? (d.stage === 'egg' ? "L'œuf" : 'Ton dragon'),
    portrait: ART.dragon[d.stage],
    portraitFilter: TINT_FILTERS[d.tint],
  };
  return [
    { ...who, text: `Bienvenue au camp, ${profileName}.` },
    { ...who, text: stageLine(d.stage, d.name, Math.max(0, d.available - d.neutralised)) },
  ];
}
