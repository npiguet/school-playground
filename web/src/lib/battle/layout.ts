// layout.ts — the compact battle while the keyboard is open (UI4 Ruling C4). Pure.
export const COMPACT_MAX_PX = 560;
export type BattleLayout = 'full' | 'compact';

/** Compact when what is left to see is shorter than COMPACT_MAX_PX: the on-screen keyboard shrinks the
 *  visual viewport (~420 of 820 on an iPad), a short desktop window the window itself (spec §10). A
 *  keyboard's shortcut bar alone (765 of 820) keeps the full stage. */
export function battleLayout(vvHeight: number, innerHeight: number): BattleLayout {
  return Math.min(vvHeight, innerHeight) < COMPACT_MAX_PX ? 'compact' : 'full';
}

export function bandHeight(vvHeight: number): number {
  return Math.min(104, Math.max(64, Math.round(vvHeight * 0.2)));
}
