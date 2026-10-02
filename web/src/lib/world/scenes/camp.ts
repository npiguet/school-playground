// The camp as a hub scene on hub_camp.webp (scenes UI spec §3 "Hub scene", UI3 Ruling B3): six
// places and Hermès's stall pinned to their painted landmarks, captions only where there is news (three at most), one
// next-step glow (Ruling B9), the path to battle locked until Éris can be fought.
import { SCENE_MUSIC } from '../../audio/catalog';
import { ART } from '../art';
import { nearNextStage, stageLine } from '../dragon';
import { HUB_PLACE, bossEngaged, nextStep, whatNext } from '../nextStep';
import { sayKey } from '../../dialogue/select';
import { prophecySoon, prophecyWhen } from '../prophecy';
import { romanTier } from '../quests';
import { bossRewardName } from '../rewards';
import { HOUSE_NAMES } from '../shop';
import { fightLine } from '../seals';
import type { CampResponse, DragonStage, LieutenantKey, WorldCatalog } from '../types';
import { st, type DialogueLine, type HotspotDef, type HotspotState, type SceneContext, type SceneDef, type SceneLayerDef } from '../../scene/types';
import { dragonSays } from './speakers';
import { CAMP_SHAPES } from './camp.shapes';

export type CampHotspotId = keyof typeof CAMP_SHAPES;

/** The weekly goal ribbon, in-world words. */
export function weeklyCaption(w: CampResponse['weekly']): string {
  if (w.reached) return 'Objectif atteint\u202f! Les Muses sont fières.';
  return `Cette semaine\u202f: ${w.done} / ${w.target} parchemins défendus`;
}

/** Éris hides until enough tricks are foiled (the quest wall's rule, SP3 decision 8). */
export function bossLocked(camp: CampResponse): boolean {
  return camp.boss.tier_available === null && camp.boss.active_quest_id === null;
}

/** What the dragon says when the locked path to battle is tapped (carry #16/M9; spec 2026-09-29
 *  lieutenant levels §4, R9): the same words as the plaque's caption. */
export function bossLockLine(camp: CampResponse): string {
  return camp.boss.next ? fightLine(camp.boss.next) : 'Éris est vaincue à chaque combat. Elle boude, loin du camp.';
}

/** The locked path's caption (final review M12, ethics: a lock says in advance how to get past it,
 *  without a tap): what opens the next fight, in words. Ruling B-d: first of the three captions. */
export function bossLockCaption(camp: CampResponse): string | null {
  return camp.boss.next ? fightLine(camp.boss.next) : 'Éris boude, loin du camp';
}

/** The open path's caption: the fight's number as the battle screen writes it (Roman, final review
 *  M10) and its reward known in advance. */
function bossCaption(camp: CampResponse, catalog: WorldCatalog | null): string {
  if (bossEngaged(camp)) return 'Un combat est déjà engagé contre Éris.';
  const tier = camp.boss.tier_available;
  return `Combat ${romanTier(tier ?? 1)}\u202f: ${bossRewardName(tier, catalog)}`;
}

/** The hub place the shared next step names (Ruling B9), or null. */
export function campNextStep(camp: CampResponse | null): CampHotspotId | null {
  const step = nextStep(camp);
  return step ? HUB_PLACE[step] : null;
}

/** Captions only where there is news (carry rec. 5), three at most, by priority. Ruling B-d: the
 *  battle path's caption counts too, locked (the tricks still to foil) or open (the fight), first. */
export function campNews(camp: CampResponse, catalog: WorldCatalog | null): Partial<Record<CampHotspotId, string>> {
  const p = prophecySoon(camp);
  const all: [CampHotspotId, string | null][] = [
    ['boss', bossLocked(camp) ? bossLockCaption(camp) : bossCaption(camp, catalog)],
    ['oracle', p ?`Une prophétie, ${prophecyWhen(p.days_left)}` : camp.oracle.status === 'sealed' ? 'Trois rouleaux à ouvrir' : null],
    ['parchemins', camp.xp.total === 0 ? 'Choisis un texte à défendre' : null],
    ['dragon', camp.dragon.stage !== 'egg' && !camp.dragon.name ? 'Il attend un nom' : null],
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
  // Spec 2026-09-29 drachmes §2 (R10, R18): Hermès's stall opens as an overlay of the camp; no caption
  // and no glow of its own: nothing here ever calls the player in. Its name is inked on its counter
  // (`on`, Task 5 review I1, superseding R18's `above`): a plaque above the awning lay on the temple.
  { id: 'stall', label: "L'étal d'Hermès", target: 'camp', query: { panel: 'etal' }, shape: CAMP_SHAPES.stall, labelPos: 'on', state: place('stall') },
  {
    id: 'oracle',
    label: 'Le chemin de Delphes',
    target: 'delphi',
    shape: CAMP_SHAPES.oracle,
    labelPos: 'below',
    leader: true,
    // Spec 2026-09-29 drachmes §2 (Task 5 review I1): the plaque slides right, down the stairs, off
    // Hermès's stall and its inked name (its left edge from x 20 to x 24.8 at 1280x720, where the
    // stall's name ends at x 24.2); its leader still starts under the temple.
    labelDx: 35,
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
    // Spec 2026-09-29 lieutenant levels §5 (R14): the seals won across lieutenants, one gold seal and
    // their number on the plaque, not the gold coin that means « something waits here ».
    state: place('dossier', (camp) => ({ seals: camp.lieutenants.reduce((sum, l) => sum + l.level, 0) })),
  },
  // UI3b playability #8: the same dark plaque as every other place, pinned to the cabin's door and
  // hanging in front of it (the pale 12 px ink on the white wall was the hardest name to read).
  // Spec 2026-09-29 drachmes §3 (R22): the plaque names the highest house owned once the camp has
  // loaded (« Ta cabane » before).
  {
    id: 'cabin',
    label: 'Ta cabane',
    target: 'cabin',
    shape: CAMP_SHAPES.cabin,
    labelPos: 'below',
    leader: true,
    state: place('cabin', (camp) => ({ label: HOUSE_NAMES[camp.house] })),
  },
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
  narrator: { enter: 'camp.enter', tour: 'camp' },
  // Carry rec. 9, final review M14: every place the hub leads to, so none loads cold on its first
  // tap (the next step's place first: the tent and the temple, then the others and the battle).
  // UI4: the path to battle leads to Éris's lair (the boss's battle stage).
  preload: [ART.scenes.libraryTent, ART.scenes.delphi, ART.scenes.warTent, ART.scenes.nest, ART.scenes.cabin, ART.scenes.erisLair],
};

const WIDTH: Record<DragonStage, number> = { egg: 6, hatchling: 7, young: 8, adult: 9, illustre: 9.5, ancestral: 10 };

/** The dragon's cut-out seated in the painted nest (carry rec. 7, immersion Deferred #23:
 *  docs/art/scenes.md ≈ (17, 50), feet on the straw at y 55). Depth 0 and no idle: it sits still in
 *  its place's box, as a parallax or a breath read as floating (playtest 2026-10-02); the hatched
 *  dragon moves on its own instead (LivingDragon, spec 2026-10-02 living dragon). */
export function campDragonLayer(stage: DragonStage): Omit<SceneLayerDef, 'id' | 'src' | 'alt'> {
  return { x: 17, y: 55, scale: WIDTH[stage], depth: 0, idle: 'none' };
}

/** The camp's greeting (Ruling E12; spec 2026-09-29 explanations §1): her name, the dragon's stage, the
 *  week's goal when reached, then the most useful next goal (R1). R7: when that goal is the name or the
 *  stage, the stage line is left out, so nothing is said twice. `shopSeen`: the stall's pieces the
 *  dragon already named (shopSeen.svelte.ts, SP4 final review I1). */
export function campGreeting(profileName: string, camp: CampResponse, shopSeen: readonly string[] = []): DialogueLine[] {
  const d = camp.dragon;
  const next = whatNext(camp, shopSeen);
  const lines = [sayKey('camp.enter', { vars: { hero: profileName }, dragon: d })];
  // A seal within reach already says « Encore un peu »: the stage line takes its far wording then.
  if (next.kind !== 'name' && next.kind !== 'stage') lines.push(dragonSays(d, stageLine(d.stage, camp.xp, next.kind !== 'seal' && nearNextStage(camp.xp))));
  if (camp.weekly.reached) lines.push(sayKey('camp.weekly', { dragon: d }));
  lines.push(sayKey(next.key, { vars: next.vars, ctx: next.ctx, dragon: d }));
  return lines;
}
