// The one next step of the game (UI3a playability recommendation 5, immersion Deferred #11, UI3
// Ruling B9): the hub's glow, the greeting's last line and each place's glow all read it, so the hub
// and the place never disagree on where to go.
import type { CampResponse } from './types';
import { nearestProphecy, prophecyWhen } from './prophecy';
import type { DialogueKey } from '../dialogue/types';

export type NextStep = 'battle' | 'first-text' | 'prophecy' | 'scrolls' | null;

/** A fight against Éris is already under way (her quest is active). */
export const bossEngaged = (camp: CampResponse) => camp.quests.some((q) => q.kind === 'boss' && q.status === 'active');

/** Ruling B9, order amended by the controller: a prophecy falling due within a week first (the
 *  real-school dictation is what the game prepares for), then a battle ready to be fought, then a
 *  new hero's first text, then the week's sealed scrolls. */
export function nextStep(camp: CampResponse | null): NextStep {
  if (!camp) return null;
  const p = nearestProphecy(camp);
  if (p && p.days_left <= 7) return 'prophecy';
  if (camp.boss.tier_available !== null && !bossEngaged(camp)) return 'battle';
  if (camp.xp.total === 0) return 'first-text';
  if (camp.oracle.status === 'sealed') return 'scrolls';
  return null;
}

/** The hub place each step leads to (CAMP_HOTSPOTS ids). */
export const HUB_PLACE = {
  battle: 'boss',
  'first-text': 'parchemins',
  prophecy: 'oracle',
  scrolls: 'oracle',
} as const satisfies Record<Exclude<NextStep, null>, string>;

/** The greeting's last line names the same step (UI5 Ruling E12: `camp.next.<step>` in the content,
 *  `camp.next.none` when there is none). */
export function nextStepKey(camp: CampResponse): { key: DialogueKey; vars?: Record<string, string> } {
  const step = nextStep(camp);
  if (step === 'prophecy') return { key: 'camp.next.prophecy', vars: { when: prophecyWhen(nearestProphecy(camp)!.days_left) } };
  return { key: step ? `camp.next.${step}` : 'camp.next.none' };
}
