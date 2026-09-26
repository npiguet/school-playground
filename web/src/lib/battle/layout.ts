// layout.ts — the compact battle while the keyboard is open (UI4 Ruling C4). Pure.
export const COMPACT_MAX_PX = 560;
export type BattleLayout = 'full' | 'compact';

/** Compact when what is left to see is shorter than COMPACT_MAX_PX: the on-screen keyboard shrinks the
 *  visual viewport (~420 of 820 on an iPad), a short desktop window the window itself (spec §10). A
 *  keyboard's shortcut bar alone (765 of 820) keeps the full stage. A pinch-zoom shrinks the visual
 *  viewport too (inner / scale) but hides nothing of the screen: the height is taken back to screen
 *  px (`vvHeight * scale`, M12), so only the keyboard or the window folds the stage. */
export function battleLayout(vvHeight: number, innerHeight: number, scale = 1): BattleLayout {
  return Math.min(vvHeight * scale, innerHeight) < COMPACT_MAX_PX ? 'compact' : 'full';
}

export function bandHeight(vvHeight: number): number {
  return Math.min(104, Math.max(64, Math.round(vvHeight * 0.2)));
}
