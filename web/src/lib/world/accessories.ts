// The dragon's accessories on screen (spec 2026-09-29 drachmes §4, R16, R19): the bundled manifest
// (tools/art/accessory_manifest.py merges the art track's fragments) gives, per piece and wearing
// stage, the cropped WebP and where it sits in the 1024 px stage picture, as fractions, so it scales
// with the picture. The overlays are drawn over the tinted dragon, never tinted themselves.
import MANIFEST from './accessories.json';
import type { DragonStage, Slot } from './types';

export const SLOTS: Slot[] = ['cou', 'queue', 'dos', 'tete'];
/** Back to front (spec §4). */
export const DRAW_ORDER: Slot[] = ['queue', 'dos', 'cou', 'tete'];
/** The stages that wear their pieces; the egg and the hatchling keep theirs without showing them. */
export const WEARING: DragonStage[] = ['young', 'adult', 'illustre', 'ancestral'];
export const SLOT_NAMES: Record<Slot, string> = { cou: 'Au cou', queue: 'À la queue', dos: 'Sur le dos', tete: 'Sur la tête' };

interface Entry {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export const ACCESSORY_MANIFEST = MANIFEST as Record<string, Partial<Record<DragonStage, Entry>>>;
export const accessorySrc = (file: string) => `/art/dragon/accessories/${file}`;
export const wears = (stage: DragonStage) => WEARING.includes(stage);

const slotOf = (item: string) => item.split('-')[1] as Slot;

export interface OverlayLayer {
  item: string;
  src: string;
  /** Percent of the stage picture's box. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The overlays to draw over the dragon, back to front (one per slot; unknown pieces skipped). */
export function accessoryLayers(worn: readonly string[], stage: DragonStage): OverlayLayer[] {
  if (!wears(stage)) return [];
  const bySlot = new Map<Slot, string>();
  for (const item of worn) if (SLOTS.includes(slotOf(item)) && !bySlot.has(slotOf(item))) bySlot.set(slotOf(item), item);
  return DRAW_ORDER.flatMap((slot) => {
    const item = bySlot.get(slot);
    const e = item ? ACCESSORY_MANIFEST[item]?.[stage] : undefined;
    return item && e ? [{ item, src: accessorySrc(e.src), left: e.x * 100, top: e.y * 100, width: e.w * 100, height: e.h * 100 }] : [];
  });
}

/** The stall's and the parure's picture of a piece (R11): its overlay at the dragon's stage, the adult's
 *  before the young dragon; null for an unknown piece. */
export function accessoryPicture(item: string, stage: DragonStage): string | null {
  const e = ACCESSORY_MANIFEST[item]?.[wears(stage) ? stage : 'adult'];
  return e ? accessorySrc(e.src) : null;
}

/** The worn list after putting `item` on in `slot` (null: « Rien »), in draw order (the optimistic update). */
export function wornAfter(worn: readonly string[], slot: Slot, item: string | null): string[] {
  const kept = worn.filter((w) => slotOf(w) !== slot);
  const next = item ? [...kept, item] : kept;
  return DRAW_ORDER.flatMap((s) => next.filter((w) => slotOf(w) === s));
}
