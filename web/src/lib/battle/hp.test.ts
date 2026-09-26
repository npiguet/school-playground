import { describe, expect, it } from 'vitest';
import { FULL_HP, hpDuringPlay, hpPercent, outcomeOf, reckoningSteps } from './hp';

describe("the opponent's hold on the text (Ruling C3)", () => {
  it('stays full while she plays, notched only by the count stage 3 already shows', () => {
    expect(hpDuringPlay(1, 4)).toEqual(FULL_HP);
    expect(hpDuringPlay(2, 4)).toEqual(FULL_HP);
    expect(hpDuringPlay(3, 4)).toEqual({ value: 1, segments: 4 });
    expect(hpDuringPlay(3, 0)).toEqual(FULL_HP);
    expect(hpDuringPlay(3, undefined)).toEqual(FULL_HP);
    expect(hpDuringPlay(4, 4)).toEqual(FULL_HP);
  });

  it('never drops during play, whatever the help stage (user decision: the drop waits for the reckoning)', () => {
    for (const stage of [1, 2, 3, 4] as const) {
      for (const errors of [undefined, 0, 1, 7, 30]) expect(hpDuringPlay(stage, errors).value, `stage ${stage}, ${errors}`).toBe(1);
    }
  });

  it('drops one strike per trap caught at the reckoning, at most eight strikes', () => {
    expect(reckoningSteps(2, 1)).toEqual([0.5]);
    expect(reckoningSteps(4, 4)).toEqual([0.75, 0.5, 0.25, 0]);
    expect(reckoningSteps(0, 0)).toEqual([0]); // a perfect dictation routs her at once
    expect(reckoningSteps(3, 0)).toEqual([]);
    const many = reckoningSteps(20, 20);
    expect(many).toHaveLength(8);
    expect(many.at(-1)).toBe(0);
    for (let i = 1; i < many.length; i++) expect(many[i]).toBeLessThan(many[i - 1]);
  });

  it('names the outcome without a loss: routed, pushed back, or still standing', () => {
    expect(outcomeOf({ draft: 0, caught: 0 }, null)).toBe('rout');
    expect(outcomeOf({ draft: 3, caught: 3 }, null)).toBe('rout');
    expect(outcomeOf({ draft: 3, caught: 1 }, null)).toBe('push');
    expect(outcomeOf({ draft: 3, caught: 0 }, null)).toBe('standoff');
    expect(outcomeOf({ draft: 5, caught: 4 }, { won: true, too_easy: false })).toBe('rout');
    expect(outcomeOf({ draft: 5, caught: 5 }, { won: false, too_easy: false })).toBe('push');
    expect(outcomeOf({ draft: 0, caught: 0 }, { won: false, too_easy: true })).toBe('standoff');
    expect(hpPercent({ value: 0.504, segments: null })).toBe(50);
  });
});
