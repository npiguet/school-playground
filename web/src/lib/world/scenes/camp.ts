// The camp as a hub scene on hub_camp.webp (scenes UI spec §3 "Hub scene", UI3 Ruling B3): six
// places pinned to their painted landmarks, captions only where there is news (three at most), one
// next-step glow (Ruling B9), the path to battle locked until Éris can be fought.
import { ART } from '../art';
import { stageLabel, stageLine } from '../dragon';
import { stirringCaption } from '../eris';
import { HUB_PLACE, nextStep, nextStepLine } from '../nextStep';
import { nearestProphecy, prophecyWhen } from '../prophecy';
import { tricksBeforeEris } from '../quests';
import type { CampResponse, DragonOut, DragonStage, LieutenantKey, WorldCatalog } from '../types';
import { IDLE_HOTSPOT, type DialogueLine, type HotspotDef, type HotspotState, type SceneContext, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { dragonSpeaker } from './speakers';
import { CAMP_SHAPES } from './camp.shapes';

export { nextStepLine };

export type CampHotspotId = keyof typeof CAMP_SHAPES;

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

/** The dragon's identity: its name, else what it is (the nest's caption). */
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

/** « 1 trésor », « 2 trésors », « Aucun trésor encore » (the cabin's shelf). */
export function treasureCaption(n: number): string {
  if (n <= 0) return 'Aucun trésor encore';
  return n === 1 ? '1 trésor' : `${n} trésors`;
}

/** The weekly goal ribbon, in-world words. */
export function weeklyCaption(w: CampResponse['weekly']): string {
  if (w.reached) return 'Objectif atteint ! Les Muses sont fières.';
  return `Cette semaine : ${w.done} / ${w.target} parchemins défendus`;
}

const engaged = (camp: CampResponse) => camp.quests.some((q) => q.kind === 'boss' && q.status === 'active');

/** Éris hides until enough tricks are foiled (the quest wall's rule, SP3 decision 8). */
export function bossLocked(camp: CampResponse): boolean {
  return camp.boss.tier_available === null && camp.boss.active_quest_id === null;
}

/** What the dragon says when the locked path to battle is tapped (carry #16/M9). */
export function bossLockLine(camp: CampResponse): string {
  if (camp.boss.tiers_won.length >= 3) return 'Éris est vaincue trois fois. Elle boude, loin du camp.';
  const n = tricksBeforeEris(camp);
  if (n <= 0) return 'Éris se cache encore. Continue de défendre tes textes.';
  return `Éris se cache encore. Neutralise encore ${n === 1 ? 'une ruse' : `${n} ruses`} et elle sortira.`;
}

/** The hub place the shared next step names (Ruling B9), or null. */
export function campNextStep(camp: CampResponse | null): CampHotspotId | null {
  const step = nextStep(camp);
  return step ? HUB_PLACE[step] : null;
}

/** Captions only where there is news (carry rec. 5), three at most, by priority. */
export function campNews(camp: CampResponse, catalog: WorldCatalog | null): Partial<Record<CampHotspotId, string>> {
  const p = nearestProphecy(camp);
  const stirring = camp.lieutenants.find((l) => l.stirring && l.available && !l.neutralised);
  const all: [CampHotspotId, string | null][] = [
    ['boss', bossLocked(camp) ? null : engaged(camp) ? 'Un combat est déjà engagé contre Éris.' : `Combat ${camp.boss.tier_available} : ${bossRewardName(camp, catalog)}`],
    ['oracle', p && p.days_left <= 7 ? `Une prophétie, ${prophecyWhen(p.days_left)}` : camp.oracle.status === 'sealed' ? 'Trois rouleaux à ouvrir' : null],
    ['parchemins', camp.xp.total === 0 ? 'Choisis un texte à défendre' : null],
    ['dragon', camp.dragon.stage !== 'egg' && !camp.dragon.name ? 'Il attend un nom' : null],
    ['dossier', stirring ? `${stirring.name} ${stirringCaption(stirring.key as LieutenantKey).toLowerCase()}` : null],
  ];
  return Object.fromEntries(all.filter((e): e is [CampHotspotId, string] => e[1] !== null).slice(0, 3));
}

function place(id: CampHotspotId, extra: (camp: CampResponse) => Partial<HotspotState> = () => ({})) {
  return ({ camp, catalog }: SceneContext): HotspotState => {
    if (!camp) return st();
    return st({ caption: campNews(camp, catalog)[id] ?? null, isNew: campNextStep(camp) === id, ...extra(camp) });
  };
}

export const CAMP_HOTSPOTS: HotspotDef[] = [
  { id: 'dragon', label: 'Le nid du dragon', target: 'dragon', shape: CAMP_SHAPES.dragon, labelPos: 'below', leader: true, state: place('dragon') },
  {
    id: 'oracle',
    label: 'Le chemin de Delphes',
    target: 'delphi',
    shape: CAMP_SHAPES.oracle,
    labelPos: 'below',
    leader: true,
    state: place('oracle', (camp) => {
      const n = camp.quests.filter((q) => q.status === 'active').length;
      return { badge: n > 0 ? n : null };
    }),
  },
  { id: 'parchemins', label: 'La tente des parchemins', target: 'library-tent', shape: CAMP_SHAPES.parchemins, labelPos: 'below', leader: true, state: place('parchemins') },
  {
    id: 'dossier',
    label: 'La tente de guerre',
    target: 'war-tent',
    shape: CAMP_SHAPES.dossier,
    labelPos: 'below',
    leader: true,
    state: place('dossier', (camp) => {
      const n = camp.lieutenants.filter((l) => l.neutralised).length;
      return { badge: n > 0 ? n : null };
    }),
  },
  // Inked on the cabin's white wall: a plaque above the roof hung on the olive tree (Task 7 review).
  { id: 'cabin', label: 'Ta cabane', target: 'cabin', shape: CAMP_SHAPES.cabin, labelPos: 'on', state: place('cabin') },
  {
    id: 'boss',
    label: 'Le sentier de la bataille',
    target: 'boss',
    shape: CAMP_SHAPES.boss,
    labelPos: 'below',
    leader: true,
    state: (ctx) => (ctx.camp ? place('boss', (camp) => ({ locked: bossLocked(camp) }))(ctx) : st({ locked: true })),
  },
];

export const CAMP_SCENE: SceneDef = {
  id: 'camp',
  title: 'Le camp',
  background: ART.scenes.hubCamp,
  layers: [],
  hotspots: CAMP_HOTSPOTS,
  ambience: { particles: 'embers', music: null },
  narrator: { enter: 'camp.enter', firstVisit: 'camp.first' },
  // Carry rec. 9: the two places the hub leads to most (the tent, the temple).
  preload: [ART.scenes.libraryTent, ART.scenes.delphi],
};

const WIDTH: Record<DragonStage, number> = { egg: 6, hatchling: 7, young: 8, adult: 9 };

/** The dragon's cut-out seated in the painted nest (carry rec. 7, immersion Deferred #23:
 *  docs/art/scenes.md ≈ (17, 50), feet on the straw at y 55). Depth 1 keeps it inside its place's
 *  box (UI1 final review M2). */
export function campDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'> {
  return { x: 17, y: 55, scale: WIDTH[stage], depth: 1, idle: 'breathe' };
}

/** The static greeting (dialogue content files arrive in UI5). */
export function campGreeting(profileName: string, camp: CampResponse): DialogueLine[] {
  const d = camp.dragon;
  const who = dragonSpeaker(d);
  return [
    { ...who, text: `Bienvenue au camp, ${profileName}.` },
    { ...who, text: stageLine(d.stage, d.name, Math.max(0, d.available - d.neutralised)) },
    { ...who, text: nextStepLine(camp) },
  ];
}
