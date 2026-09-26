// The dialogue content's shape (spec §8, Ruling E11). The files live in content/dialogue/<area>.json.
import type { SpeakerId } from '../scene/types';
import type { DragonStage } from '../world/types';
import type { BattleMode, OpponentId } from '../battle/battle';

export interface When {
  stage?: DragonStage[];
  opponent?: OpponentId[];
  mode?: BattleMode[];
}
export interface LineDef {
  speaker: SpeakerId;
  text: string;
  when?: When;
}
export interface TourStepDef extends LineDef {
  /** The hotspot id the ring circles, or null for a line over the whole place. */
  target: string | null;
}
export interface DialogueFile {
  lines: Record<string, LineDef[]>;
  tour?: TourStepDef[];
}
export interface DialogueCtx {
  stage?: DragonStage;
  opponent?: OpponentId;
  mode?: BattleMode;
}

export const DIALOGUE_KEYS = [
  'camp.enter', 'camp.weekly', 'camp.next.prophecy', 'camp.next.battle', 'camp.next.first-text', 'camp.next.scrolls', 'camp.next.none',
  'library.enter', 'library.owl',
  'delphi.enter.sealed', 'delphi.enter.chosen',
  'war.enter',
  'nest.enter', 'nest.name',
  'cabin.enter',
  'battle.start', 'battle.retry', 'battle.perfect', 'battle.victory', 'battle.retreat', 'battle.caught', 'battle.missed', 'battle.explain',
] as const;
export type DialogueKey = (typeof DIALOGUE_KEYS)[number];

export const TOUR_IDS = ['camp', 'library', 'delphi', 'war', 'nest', 'cabin'] as const;
export type TourId = (typeof TOUR_IDS)[number];

/** The placeholders each key may use (content.test.ts); every other key uses none. */
export const PLACEHOLDERS: Partial<Record<DialogueKey, string[]>> = {
  'camp.enter': ['hero'],
  'camp.next.prophecy': ['when'],
  'battle.explain': ['word'],
};
