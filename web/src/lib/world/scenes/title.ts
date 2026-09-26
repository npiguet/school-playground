// The title scene (scenes UI spec §3 "Title scene", UI3 Ruling A4): the camp gates at dusk with
// Éris's shadow in the sky. « Entrer » opens the gate onto the heroes' painted shields.
import { ART } from '../art';
import type { Profile } from '../../types';
import { IDLE_HOTSPOT, type HotspotDef, type HotspotState, type SceneDef } from '../../scene/types';
import { TITLE_SHAPES } from './title.shapes';

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

export const TITLE_HOTSPOTS: HotspotDef[] = [
  { id: 'gate', label: 'Entrer', target: null, shape: TITLE_SHAPES.gate, labelPos: 'above', leader: true, grand: true, state: () => st({ isNew: true }) },
];

export const TITLE_SCENE: SceneDef = {
  id: 'title',
  title: 'La Discorde',
  background: ART.scenes.titleGates,
  layers: [],
  hotspots: TITLE_HOTSPOTS,
  ambience: { particles: 'embers', music: null },
  narrator: { enter: 'title.enter', firstVisit: null },
  preload: [ART.scenes.hubCamp],
};

/** A shield's width, art % (80 px wide at 1180x820, 70 px at 1280x720 - both >= the 64 px touch
 *  floor). */
export const SHIELD_W = 5.5;

/** Where the painted shields hang (art %): x = hook centre, y = hook tip (playability #13).
 *  Measured from `web/public/art/scenes/title_gates.webp` (2048x1152) and confirmed against the
 *  `?debug` shot of `/?debug#/` at 1180x820 (docs/reviews/ui3/ipad-landscape-d01-debug-title.png,
 *  docs/reviews/ui3/ipad-landscape-a02-title-shields.png): each rail carries five painted hooks;
 *  x = px / 2048, y = px / 1152. Left rail hooks read at x ~= 17.4, 20.4, 23.3, 30.8, 33.9; right
 *  rail at x ~= 65.4, 75.4, 78.3, 81.2, 84.3; every hook tip at y ~= 55.5. Three hooks per rail are
 *  picked so every pair of neighbours is at least SHIELD_W + 0.3 apart, every centre stays inside
 *  the safe zone (12.5 + SHIELD_W/2 .. 87.5 - SHIELD_W/2) and clear of the pillars and torches
 *  (x 36-63). */
export const SHIELD_SLOTS: { x: number; y: number }[] = [
  { x: 17.4, y: 55.5 },
  { x: 23.3, y: 55.5 },
  { x: 33.9, y: 55.5 },
  { x: 65.4, y: 55.5 },
  { x: 75.4, y: 55.5 },
  { x: 84.3, y: 55.5 },
];

export type ShieldItem = { kind: 'hero'; profile: Profile } | { kind: 'all'; count: number } | { kind: 'new' };

/** Newest heroes first; the last slot is always « Nouveau héros »; with more heroes than slots,
 *  the one before it opens « Tous les héros ». */
export function titleShields(profiles: Profile[]): ShieldItem[] {
  const newest = [...profiles].sort((a, b) => b.id - a.id);
  const room = SHIELD_SLOTS.length - 1;
  const heroes = (list: Profile[]): ShieldItem[] => list.map((profile) => ({ kind: 'hero', profile }));
  if (newest.length <= room) return [...heroes(newest), { kind: 'new' }];
  return [...heroes(newest.slice(0, room - 1)), { kind: 'all', count: newest.length }, { kind: 'new' }];
}
