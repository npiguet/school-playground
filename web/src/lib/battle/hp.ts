// hp.ts — the opponent's hold on the text (UI4 Ruling C3, decided by the user on 2026-09-26): the bar
// never grades live. It stays full through the muster, the dictation and the proofreading (with
// Palamède's tokens it only carries the notches of the frozen count she already sees) and drops at the
// reckoning, after the proofreading: one strike per trap caught, down to where the outcome leaves it.
// The outcome itself is the copy's (spec 2026-09-29), no longer the catch rate. Pure.
import type { CopyVerdict } from '../rules';

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

/** How much of the hold the reckoning takes, by outcome: a rout empties the bar, a push leaves part
 *  of it (between a quarter and three quarters), a standoff never empties it. */
function holdLost(draft: number, caught: number, outcome: Outcome): number {
  if (outcome === 'rout') return 1;
  const rate = draft > 0 ? Math.min(1, caught / draft) : 0;
  return outcome === 'push' ? Math.min(0.75, Math.max(0.25, rate)) : Math.min(0.75, rate);
}

/** The hold after each strike of the reckoning: the traps caught are the strikes (one each, grouped
 *  into at most eight; one for a rout or a push with nothing caught), and the outcome sets where the
 *  bar ends (spec 2026-09-29: the copy is what counts). A standoff with nothing caught never strikes. */
export function reckoningSteps(draft: number, caught: number, outcome: Outcome): number[] {
  const lost = holdLost(draft, caught, outcome);
  if (lost <= 0) return [];
  const strikes = Math.min(Math.max(caught, 1), MAX_STRIKES);
  return Array.from({ length: strikes }, (_, i) => Math.max(0, round3(1 - (lost * (i + 1)) / strikes)));
}

/** The outcome of a fight (spec 2026-09-29, "the copy is what counts"). A lieutenant answers the copy
 *  verdict: a belle copie routs it, a copie correcte pushes it back, a copie à reprendre leaves it
 *  standing. Éris's win or loss is the server's (`boss.won`): a lost boss fight is always a standoff
 *  (closing item 2: never the "push" half-victory title while her own line says she keeps the apple). */
export function outcomeOf(copy: CopyVerdict, boss: { won: boolean } | null): Outcome {
  if (boss) return boss.won ? 'rout' : 'standoff';
  return copy === 'belle' ? 'rout' : copy === 'correcte' ? 'push' : 'standoff';
}

/** The reckoning's verdict, or null while it must wait. A boss fight's outcome is the server's
 *  (progression.boss), so it waits for the session's progression: a failed submission gives no
 *  provisional outcome that a retry would then replace (UI5 hears one outcome per battle). */
export function reckoningVerdict(
  copy: CopyVerdict,
  o: { bossFight: boolean; progression: { boss: { won: boolean } | null } | null },
): Outcome | null {
  if (o.bossFight && !o.progression) return null;
  return outcomeOf(copy, o.bossFight ? (o.progression?.boss ?? null) : null);
}

/** A boss fight whose submission failed has no server verdict yet: the dialogue falls back to the
 *  client's own fight rule (at most `fightMax` mistakes per 100 words left: a rout, else a standoff),
 *  never to the lieutenant mapping, whose « push » a boss never has. */
export function bossFallbackOutcome(leftPer100: number, fightMax: number): Outcome {
  return outcomeOf('reprendre', { won: leftPer100 <= fightMax });
}

export const hpPercent = (hp: HpView) => Math.round(hp.value * 100);
