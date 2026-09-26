// hp.ts — the opponent's hold on the text (UI4 Ruling C3, decided by the user on 2026-09-26): the bar
// never grades live. It stays full through the muster, the dictation and the proofreading (at help
// stage 3 it only carries the notches of the frozen count she already sees) and drops at the
// reckoning, after the proofreading: one strike per trap caught. Pure.
export interface HpView {
  /** 1 = full hold, 0 = routed. */
  value: number;
  /** Notches on the bar: the stage-3 frozen count, else null. */
  segments: number | null;
}
export const FULL_HP: HpView = { value: 1, segments: null };
export type Outcome = 'rout' | 'push' | 'standoff';

/** The bar during play: always full; never a function of her edits. */
export function hpDuringPlay(helpStage: 1 | 2 | 3 | 4, initialErrors: number | undefined): HpView {
  return helpStage === 3 && (initialErrors ?? 0) > 0 ? { value: 1, segments: initialErrors! } : FULL_HP;
}

const MAX_STRIKES = 8;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** The hold after each strike of the reckoning: one per trap caught, grouped into at most eight. A
 *  perfect dictation (nothing planted) routs the opponent in one strike. */
export function reckoningSteps(draft: number, caught: number): number[] {
  if (draft === 0) return [0];
  if (caught <= 0) return [];
  const strikes = Math.min(caught, MAX_STRIKES);
  const lost = Math.min(1, caught / draft);
  return Array.from({ length: strikes }, (_, i) => Math.max(0, round3(1 - (lost * (i + 1)) / strikes)));
}

export function outcomeOf(r: { draft: number; caught: number }, boss: { won: boolean; too_easy: boolean } | null): Outcome {
  if (boss) {
    if (boss.won) return 'rout';
    if (boss.too_easy) return 'standoff';
    return r.caught > 0 ? 'push' : 'standoff';
  }
  if (r.draft === 0 || r.caught >= r.draft) return 'rout';
  return r.caught > 0 ? 'push' : 'standoff';
}

export const hpPercent = (hp: HpView) => Math.round(hp.value * 100);
