// The camp as a hub scene (scenes UI spec §3 "Hub scene", §9 UI1): which places exist, where
// they lead (the pre-UI1 screens, unchanged), and what each shows from /camp. Geometry lives in
// camp.shapes.ts (pure data, authored by hand from docs/art/scenes.md and re-checked with the
// `?debug` overlay whenever UI2 repaints the camp).
import { ART } from '../art';
import { stageActivity, stageLabel, stageLine } from '../dragon';
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
import { HUB_PLACE, nextStep, nextStepLine } from '../nextStep';
import { dragonSpeaker } from './speakers';

// The greeting's last line moved to the shared next step (Ruling B9); kept here for its callers.
export { nextStepLine } from '../nextStep';

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

/** « 1 trésor », « 2 trésors », « Aucun trésor encore » (playability #6: no form-style « trésor(s) »). */
export function treasureCaption(n: number): string {
  if (n <= 0) return 'Aucun trésor encore';
  return n === 1 ? '1 trésor' : `${n} trésors`;
}

/** The bestiary caption: how many of Éris's tricks are foiled (playability #6). */
export function bestiaryCaption(neutralised: number): string {
  if (neutralised <= 0) return "Les ruses d'Éris t'attendent";
  return neutralised === 1 ? "1 ruse d'Éris déjouée" : `${neutralised} ruses d'Éris déjouées`;
}

/** The weekly goal banner (playability #6: in-world words, not a dashboard counter). */
export function weeklyCaption(w: CampResponse['weekly']): string {
  if (w.reached) return 'Objectif atteint ! Les Muses sont fières.';
  return `Cette semaine : ${w.done} / ${w.target} parchemins défendus`;
}

const bossEngaged = (camp: CampResponse) => camp.quests.some((q) => q.kind === 'boss' && q.status === 'active');

/** The one camp place that wears the next-step glow (Ruling W14: at most one per scene), or null:
 *  the hub place of the game's one next step (Ruling B9, lib/world/nextStep.ts), so the hub, the
 *  greeting and each place always agree on where to go. */
export function campNextStep(camp: CampResponse | null): (typeof HUB_PLACE)[keyof typeof HUB_PLACE] | null {
  const step = nextStep(camp);
  return step ? HUB_PLACE[step] : null;
}

export const CAMP_HOTSPOTS: HotspotDef[] = [
  {
    id: 'dragon',
    label: 'Le nid du dragon',
    target: 'dragon',
    shape: CAMP_SHAPES.dragon,
    // Task 9 review round 2: ink on the egg itself, not a plaque below it - the nest sits right
    // against the dialogue dock (see CAMP_SHAPES's own comment), and `above` runs into the
    // parchemins tent.
    labelPos: 'on',
    // Task 10b round 1 #3: a `title` tooltip never shows on iPad (no mouse hover on the target
    // device), so what the dragon is up to (stageActivity, a short version of dragon.ts's
    // stageLine) rides along here instead, next to its identity (dragonCaption).
    state: ({ camp }) =>
      st({ caption: camp ? `${dragonCaption(camp.dragon)} · ${stageActivity(camp.dragon.stage)}` : null }),
  },
  {
    id: 'oracle',
    label: 'Le chemin de Delphes',
    // UI3a Task 12: the temple is now its own place scene, not the legacy Oracle screen directly
    // (same reasoning as the library tent, Task 9).
    target: 'delphi',
    shape: CAMP_SHAPES.oracle,
    labelPos: 'below',
    state: ({ camp }) => {
      if (!camp) return st();
      const sealed = camp.oracle.status === 'sealed';
      return st({ isNew: campNextStep(camp) === 'oracle', caption: sealed ? 'Trois rouleaux à ouvrir' : 'Quête en cours' });
    },
  },
  {
    id: 'quests',
    label: 'Le mur des quêtes',
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
    // UI3a Task 9: the library tent is now its own place scene, not the legacy screen directly.
    target: 'library-tent',
    shape: CAMP_SHAPES.parchemins,
    labelPos: 'above',
    // Playability #2: the tent where the dictations are fought says so, and glows until the first
    // text has been defended (no XP yet = no session played), unless a near prophecy or a battle
    // outranks it (Ruling B9).
    state: ({ camp }) => st({ caption: 'Choisis un texte à défendre', isNew: campNextStep(camp) === 'parchemins' }),
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
      return st({ caption: bestiaryCaption(camp.lieutenants.filter((l) => l.neutralised).length) });
    },
  },
  {
    id: 'cabin',
    label: 'Ta cabane',
    target: 'cabin',
    shape: CAMP_SHAPES.cabin,
    // Task 9 review round 2: same reasoning as the dragon's - ink on the cabin door instead of a
    // plaque below it, which reached a few px into the dialogue dock.
    labelPos: 'on',
    state: ({ camp }) => st({ caption: camp ? treasureCaption(camp.rewards_count) : null }),
  },
  {
    id: 'boss',
    label: 'Le sentier de la bataille',
    target: 'boss',
    shape: CAMP_SHAPES.boss,
    labelPos: 'below',
    state: ({ camp, catalog }) => {
      if (!camp || (camp.boss.tier_available === null && camp.boss.active_quest_id === null)) return st({ visible: false });
      const engaged = bossEngaged(camp);
      return st({
        isNew: campNextStep(camp) === 'boss',
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
  // Carry rec. 9: the two places the hub leads to most (the tent, the temple).
  preload: [ART.scenes.libraryTent, ART.scenes.delphi],
};

/** Where the player's dragon cut-out stands (its image depends on the stage, so Camp.svelte
 *  renders it as a SceneLayer with this placement). Matches CAMP_SHAPES.dragon. */
export const CAMP_DRAGON_LAYER: Omit<SceneLayerDef, 'id' | 'src' | 'alt'> = {
  x: 18,
  y: 80,
  scale: 9,
  // Final review M2: depth 1, not 2 - at most ~9 px of drift on an iPad, well inside its
  // hotspot (rx 5 % = 73 px), so the nest stays under the finger (Ruling 7).
  depth: 1,
  idle: 'breathe',
};

/** UI1's static greeting (dialogue content files arrive in UI5). Its last line points at the next
 *  step (playability #2, Ruling B9: nextStepLine). */
export function campGreeting(profileName: string, camp: CampResponse): DialogueLine[] {
  const d = camp.dragon;
  const who = dragonSpeaker(d);
  return [
    { ...who, text: `Bienvenue au camp, ${profileName}.` },
    { ...who, text: stageLine(d.stage, d.name, Math.max(0, d.available - d.neutralised)) },
    { ...who, text: nextStepLine(camp) },
  ];
}
