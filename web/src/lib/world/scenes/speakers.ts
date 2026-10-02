// The dragon narrates (scenes UI spec §2.5): its name, or « L'œuf » before it hatches, and its own
// tinted cut-out as the dialogue portrait (carry rec. 7: the same image as its scene layer). Used by
// the camp's greeting, the war tent's locked sheets, the hub's locked path and the nest.
import { ART } from '../art';
import type { DragonOut } from '../types';
import type { DialogueLine } from '../../scene/types';

/** What the dragon's frame reads of it: its name, its stage and its tint. */
export type DragonLook = Pick<DragonOut, 'name' | 'stage' | 'tint'>;

export function dragonSpeaker(d: DragonLook): Omit<DialogueLine, 'text'> {
  return {
    speaker: 'dragon',
    name: d.name ?? (d.stage === 'egg' ? "L'œuf" : 'Ton dragon'),
    portrait: ART.dragon[d.stage],
    portraitTint: d.tint,
  };
}

export function dragonSays(d: DragonLook, text: string): DialogueLine {
  return { ...dragonSpeaker(d), text };
}
