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
import { nearestProphecy, prophecyWhen } from '../prophecy';

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

/** The one camp place that wears the next-step glow (Ruling W14: at most one per scene), or null.
 *  1. The battle path while a tier is open and no fight is engaged: rare, earned, and it waits for
 *     nothing else (it is also the greeting's next step before the tent, see nextStepLine).
 *  2. The parchemins tent while no text has been defended (xp 0): a new hero's first step - the
 *     Oracle's scrolls only mean something once she has played.
 *  3. The road to Delphi while the week's scrolls are sealed. */
export function campNextStep(camp: CampResponse | null): 'boss' | 'parchemins' | 'oracle' | null {
  if (!camp) return null;
  if (camp.boss.tier_available !== null && !bossEngaged(camp)) return 'boss';
  if (camp.xp.total === 0) return 'parchemins';
  if (camp.oracle.status === 'sealed') return 'oracle';
  return null;
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
    // text has been defended (no XP yet = no session played), unless a battle outranks it.
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

/** The greeting's last line: where to go next (playability #2 - the hub points at the next
 *  action). A prophecy due within a week first, then a battle ready to be fought, else the tent
 *  where the texts are defended. */
export function nextStepLine(camp: CampResponse): string {
  const p = nearestProphecy(camp);
  if (p && p.days_left <= 7) return `La Pythie a vu ta prochaine épreuve, ${prophecyWhen(p.days_left)}. Viens t'y préparer !`;
  if (camp.boss.tier_available !== null && !bossEngaged(camp)) return "Le sentier de la bataille est ouvert : Éris t'attend.";
  return "Les parchemins t'attendent, sous la tente.";
}

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
    { ...who, text: nextStepLine(camp) },
  ];
}
