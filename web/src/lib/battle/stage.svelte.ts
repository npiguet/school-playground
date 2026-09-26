// stage.svelte.ts — what the battle stage shows, driven by whichever phase is on (Ruling C13): the
// hold, the hits, each side's last reaction. BattleStage reads it; the phases write it. Per Ruling C3
// only the reckoning (the victory phase) calls `strike`: the hold never drops during play.
import { emitBattle } from './events';
import { FULL_HP, type HpView } from './hp';
import type { Reaction } from './reactions';

export type Side = 'opponent' | 'dragon';
interface Actor {
  reaction: Reaction;
  /** Bumped on every reaction, so the same reaction twice replays. */
  nonce: number;
}

export const battleStage = $state({
  hp: FULL_HP as HpView,
  hits: 0,
  opponent: { reaction: 'idle', nonce: 0 } as Actor,
  dragon: { reaction: 'idle', nonce: 0 } as Actor,
});

export function react(side: Side, reaction: Reaction): void {
  battleStage[side] = { reaction, nonce: battleStage[side].nonce + 1 };
}

export function setHp(hp: HpView): void {
  battleStage.hp = hp;
}

export function strike(value: number): void {
  battleStage.hp = { ...battleStage.hp, value };
  battleStage.hits += 1;
  react('opponent', 'hit');
  emitBattle({ kind: 'strike', value });
}

export function resetBattleStage(): void {
  battleStage.hp = FULL_HP;
  battleStage.hits = 0;
  battleStage.opponent = { reaction: 'idle', nonce: 0 };
  battleStage.dragon = { reaction: 'idle', nonce: 0 };
}
