// Who says a content line (spec §2.5): the dragon with its stage's tinted cut-out (« L'œuf » before
// it hatches), the Pythia, Athena's owl, Éris. The same frames as voices.ts and speakers.ts.
import { dragonSpeaker } from '../world/scenes/speakers';
import { erisSays, owl, pythia } from '../world/voices';
import type { DragonOut } from '../world/types';
import type { DialogueLine, SpeakerId } from '../scene/types';

/** The dragon before /camp has answered: an egg, in bronze. */
export const EGG = { name: null, stage: 'egg', tint: 'bronze' } as unknown as DragonOut;

const frame = ({ text: _text, ...rest }: DialogueLine): Omit<DialogueLine, 'text'> => rest;

export function frameFor(speaker: SpeakerId, dragon: DragonOut | null | undefined): Omit<DialogueLine, 'text'> {
  switch (speaker) {
    case 'dragon':
      return dragonSpeaker(dragon ?? EGG);
    case 'owl':
      return frame(owl(''));
    case 'pythia':
      return frame(pythia(''));
    case 'eris':
      return frame(erisSays(''));
  }
}
