import { describe, expect, it } from 'vitest';
import type { CampResponse } from './types';
import { HUB_PLACE, nextStep, nextStepKey } from './nextStep';
import { prophecyWhen } from './prophecy';

function camp(over: Partial<CampResponse> = {}): CampResponse {
  return {
    xp: { total: 40 },
    quests: [],
    prophecies: [],
    oracle: { week: 'w', status: 'chosen', reward_id: null },
    boss: { tier_available: null, tiers_won: [], active_quest_id: null },
    ...over,
  } as unknown as CampResponse;
}
const open = { tier_available: 1, tiers_won: [], active_quest_id: null };
const sealed = { week: 'w', status: 'sealed' as const, reward_id: null };
const prophecy = (days: number) => [{ text_id: 1, title: 'La mer', due_date: '2026-09-29', days_left: days }];
const fresh = { total: 0 } as CampResponse['xp'];

describe('one next step for the whole camp (Ruling B9, order amended by the controller)', () => {
  it('orders a prophecy within a week, the battle, a first text, the sealed scrolls, then nothing', () => {
    expect(nextStep(null)).toBeNull();
    // The real-school dictation comes first: it outranks even an open battle and a new hero's first text.
    expect(nextStep(camp({ boss: open, xp: fresh, prophecies: prophecy(1), oracle: sealed }))).toBe('prophecy');
    expect(nextStep(camp({ prophecies: prophecy(7), oracle: sealed }))).toBe('prophecy');
    // Due today, or already past: still the next step (prophecyWhen says « aujourd'hui »).
    expect(nextStep(camp({ prophecies: prophecy(0) }))).toBe('prophecy');
    expect(nextStep(camp({ prophecies: prophecy(-1) }))).toBe('prophecy');
    expect(nextStep(camp({ boss: open, xp: fresh, prophecies: prophecy(8), oracle: sealed }))).toBe('battle');
    expect(nextStep(camp({ xp: fresh, prophecies: prophecy(8), oracle: sealed }))).toBe('first-text');
    expect(nextStep(camp({ prophecies: prophecy(8), oracle: sealed }))).toBe('scrolls');
    expect(nextStep(camp({ prophecies: prophecy(8) }))).toBeNull();
    expect(nextStep(camp())).toBeNull();
  });

  it('reads the prophecy falling due first', () => {
    const two = [...prophecy(9), { text_id: 2, title: 'Les fées', due_date: '2026-09-27', days_left: 1 }];
    expect(nextStep(camp({ prophecies: two }))).toBe('prophecy');
  });

  it('never points at a battle already engaged', () => {
    const engaged = camp({ boss: { tier_available: 1, tiers_won: [], active_quest_id: 9 }, quests: [{ id: 9, kind: 'boss', status: 'active' }] as CampResponse['quests'] });
    expect(nextStep(engaged)).toBeNull();
  });

  it('leads each step to one hub place', () => {
    expect(HUB_PLACE).toEqual({ battle: 'boss', 'first-text': 'parchemins', prophecy: 'oracle', scrolls: 'oracle' });
  });

  it('names the same step in the greeting', () => {
    expect(nextStepKey(camp({ boss: open, prophecies: prophecy(3) }))).toEqual({ key: 'camp.next.prophecy', vars: { when: prophecyWhen(3) } });
    expect(nextStepKey(camp({ boss: open }))).toEqual({ key: 'camp.next.battle' });
    expect(nextStepKey(camp({ oracle: sealed }))).toEqual({ key: 'camp.next.scrolls' });
    expect(nextStepKey(camp({ xp: fresh, oracle: sealed }))).toEqual({ key: 'camp.next.first-text' });
    expect(nextStepKey(camp())).toEqual({ key: 'camp.next.none' });
  });
});
