// events.ts — the battle's hooks for UI5 (Ruling C9): audio cues and dialogue lines will listen here.
// UI4 emits and nobody listens yet. A listener never breaks the battle.
import type { BattleMode, BattlePhase, OpponentId } from './battle';
import type { Outcome } from './hp';

export type BattleEvent =
  | { kind: 'start'; opponent: OpponentId; mode: BattleMode }
  | { kind: 'phase'; phase: BattlePhase }
  | { kind: 'tool'; tool: 'argus' | 'bouclier' | 'chouette' | 'fil' | 'whole' }
  | { kind: 'strike'; value: number }
  | { kind: 'outcome'; outcome: Outcome; caught: number; missed: number }
  | { kind: 'retry' }
  | { kind: 'leave' };

const listeners = new Set<(e: BattleEvent) => void>();

export function onBattleEvent(fn: (e: BattleEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitBattle(e: BattleEvent): void {
  for (const fn of listeners) {
    try {
      fn(e);
    } catch {
      // A UI5 listener's bug must never stop a dictation.
    }
  }
}

/** The dialogue event keys of spec §8 for the battle (content/dialogue/*.json, UI5). */
export const BATTLE_NARRATOR = {
  start: 'battle.start',
  caught: 'battle.caught',
  missed: 'battle.missed',
  victory: 'battle.victory',
  retreat: 'battle.retreat',
  retry: 'battle.retry',
} as const;
