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
  preload: [ART.scenes.camp],
};

/** Where the painted shields hang (art %): x = centre, y = top edge. Three per bronze rail
 *  (docs/art/scenes.md: rails x 16-36 and 63-85, hooks at y 53-56), clear of the pillars and the
 *  torches (x 36-63) and inside the 4:3 safe zone. */
export const SHIELD_SLOTS: { x: number; y: number }[] = [
  { x: 19.5, y: 55 },
  { x: 26.5, y: 55 },
  { x: 33, y: 55 },
  { x: 69.5, y: 55 },
  { x: 76.5, y: 55 },
  { x: 83.5, y: 55 },
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
