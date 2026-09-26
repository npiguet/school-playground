// The camp as a hub scene on hub_camp.webp (scenes UI spec §3 "Hub scene", UI3 Ruling B3): six
// places pinned to their painted landmarks, captions only where there is news (three at most), one
// next-step glow (Ruling B9), the path to battle locked until Éris can be fought.
import { SCENE_MUSIC } from '../../audio/catalog';
import { ART } from '../art';
import { stageLine } from '../dragon';
import { stirringCaption } from '../eris';
import { HUB_PLACE, bossEngaged, nextStep, nextStepLine } from '../nextStep';
import { nearestProphecy, prophecyWhen } from '../prophecy';
import { romanTier, tricksBeforeEris } from '../quests';
import { bossRewardName } from '../rewards';
import { plural } from '../../text/french';
import type { CampResponse, DragonStage, LieutenantKey, WorldCatalog } from '../types';
import { st, type DialogueLine, type HotspotDef, type HotspotState, type SceneContext, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { dragonSpeaker } from './speakers';
import { CAMP_SHAPES } from './camp.shapes';

export type CampHotspotId = keyof typeof CAMP_SHAPES;

/** The weekly goal ribbon, in-world words. */
export function weeklyCaption(w: CampResponse['weekly']): string {
  if (w.reached) return 'Objectif atteint ! Les Muses sont fières.';
  return `Cette semaine : ${w.done} / ${w.target} parchemins défendus`;
}

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

/** The locked path's caption (final review M12, ethics: a lock says in advance how to get past it,
 *  without a tap): the tricks still to foil, as the dragon says it when tapped. Ruling B-d: it is
 *  the battle path's news, first of the three captions (campNews). */
export function bossLockCaption(camp: CampResponse): string | null {
  if (camp.boss.tiers_won.length >= 3) return 'Éris boude, loin du camp';
  const n = tricksBeforeEris(camp);
  return n > 0 ? `Encore ${plural(n, 'ruse', 'ruses')}` : null;
}

/** The open path's caption: the fight's number as the battle screen writes it (Roman, final review
 *  M10) and its reward known in advance. */
function bossCaption(camp: CampResponse, catalog: WorldCatalog | null): string {
  if (bossEngaged(camp)) return 'Un combat est déjà engagé contre Éris.';
  const tier = camp.boss.tier_available;
  return `Combat ${romanTier(tier ?? 1)} : ${bossRewardName(tier, catalog)}`;
}

/** The hub place the shared next step names (Ruling B9), or null. */
export function campNextStep(camp: CampResponse | null): CampHotspotId | null {
  const step = nextStep(camp);
  return step ? HUB_PLACE[step] : null;
}

/** Captions only where there is news (carry rec. 5), three at most, by priority. Ruling B-d: the
 *  battle path's caption counts too, locked (the tricks still to foil) or open (the fight), first. */
export function campNews(camp: CampResponse, catalog: WorldCatalog | null): Partial<Record<CampHotspotId, string>> {
  const p = nearestProphecy(camp);
  const stirring = camp.lieutenants.find((l) => l.stirring && l.available && !l.neutralised);
  const all: [CampHotspotId, string | null][] = [
    ['boss', bossLocked(camp) ? bossLockCaption(camp) : bossCaption(camp, catalog)],
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
    // UI3b playability #17: the neutralised lieutenants are gold seals on the plaque (as on their
    // sheets in the tent), not the gold coin that means « something waits here ».
    state: place('dossier', (camp) => ({ seals: camp.lieutenants.filter((l) => l.neutralised).length })),
  },
  // UI3b playability #8: the same dark plaque as every other place, pinned to the cabin's door and
  // hanging in front of it (the pale 12 px ink on the white wall was the hardest name to read).
  { id: 'cabin', label: 'Ta cabane', target: 'cabin', shape: CAMP_SHAPES.cabin, labelPos: 'below', leader: true, state: place('cabin') },
  {
    id: 'boss',
    label: 'Le sentier de la bataille',
    target: 'boss',
    shape: CAMP_SHAPES.boss,
    labelPos: 'below',
    leader: true,
    // UI3b playability #10: the plaque slides right, off the war tent's finial and spears, over the
    // olive tree; its leader still starts under the archway.
    labelDx: 70,
    state: (ctx) => (ctx.camp ? place('boss', (camp) => (bossLocked(camp) ? { locked: true } : {}))(ctx) : st({ locked: true })),
  },
];

export const CAMP_SCENE: SceneDef = {
  id: 'camp',
  title: 'Le camp',
  background: ART.scenes.hubCamp,
  layers: [],
  hotspots: CAMP_HOTSPOTS,
  ambience: { particles: 'embers', music: SCENE_MUSIC.camp },
  narrator: { enter: 'camp.enter', firstVisit: 'camp.first' },
  // Carry rec. 9, final review M14: every place the hub leads to, so none loads cold on its first
  // tap (the next step's place first: the tent and the temple, then the others and the battle).
  // UI4: the path to battle leads to Éris's lair (the boss's battle stage).
  preload: [ART.scenes.libraryTent, ART.scenes.delphi, ART.scenes.warTent, ART.scenes.nest, ART.scenes.cabin, ART.scenes.erisLair],
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
