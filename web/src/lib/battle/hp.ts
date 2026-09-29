// hp.ts — the opponent's hold on the text (UI4 Ruling C3, decided by the user on 2026-09-26): the bar
// never grades live. It stays full through the muster, the dictation and the proofreading (with
// Palamède's tokens it only carries the notches of the frozen count she already sees) and drops at the
// reckoning, after the proofreading: one strike per trap caught. Pure.
export interface HpView {
  /** 1 = full hold, 0 = routed. */
  value: number;
  /** Notches on the bar: Palamède's frozen count, else null. */
  segments: number | null;
}
export const FULL_HP: HpView = { value: 1, segments: null };
export type Outcome = 'rout' | 'push' | 'standoff';

/** The bar during play: always full; never a function of her edits. Les jetons de Palamède notch it with
 *  the frozen count she already sees (spec 2026-09-29 §3); `count` is null when they stayed at the camp. */
export function hpDuringPlay(count: number | null): HpView {
  return count !== null && count > 0 ? { value: 1, segments: count } : FULL_HP;
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

// Closing item 2: a lost boss fight is always 'standoff', whatever she caught along the way. 'push'
// (a lieutenant "on the back foot", partway to a rout) reads as ground won; the boss's win/loss is
// binary (the server's `boss.won`), and a real loss must never borrow that half-victory title
// ("Éris recule !") while her own line says she keeps the apple. 'standoff' ("Le combat continue")
// fits either kind of loss: too_easy (undefeated - she'll try harder) or a genuine defeat (she keeps
// the apple, but stays open to a rematch), and its opponent reaction is a taunt, not a retreat.
export function outcomeOf(r: { draft: number; caught: number }, boss: { won: boolean; too_easy: boolean } | null): Outcome {
  if (boss) return boss.won ? 'rout' : 'standoff';
  if (r.draft === 0 || r.caught >= r.draft) return 'rout';
  return r.caught > 0 ? 'push' : 'standoff';
}

/** The reckoning's verdict, or null while it must wait. A boss fight's outcome is the server's
 *  (progression.boss), so it waits for the session's progression: a failed submission gives no
 *  provisional outcome that a retry would then replace (UI5 hears one outcome per battle). */
export function reckoningVerdict(
  r: { draft: number; caught: number },
  o: { bossFight: boolean; progression: { boss: { won: boolean; too_easy: boolean } | null } | null },
): Outcome | null {
  if (o.bossFight && !o.progression) return null;
  return outcomeOf(r, o.progression?.boss ?? null);
}

export const hpPercent = (hp: HpView) => Math.round(hp.value * 100);
