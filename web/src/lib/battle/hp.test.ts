import { describe, expect, it } from 'vitest';
import { FULL_HP, hpDuringPlay, hpPercent, outcomeOf, reckoningSteps, reckoningVerdict } from './hp';
import { copyVerdict, DEFAULT_RULES, per100 } from '../rules';

describe("the opponent's hold on the text (Ruling C3)", () => {
  it("stays full while she plays, notched only by Palamède's count when his tokens were taken", () => {
    expect(hpDuringPlay(null)).toEqual(FULL_HP);
    expect(hpDuringPlay(4)).toEqual({ value: 1, segments: 4 });
    expect(hpDuringPlay(0)).toEqual(FULL_HP);
  });

  it('never drops during play (user decision: the drop waits for the reckoning)', () => {
    for (const count of [null, 0, 1, 7, 30]) expect(hpDuringPlay(count).value, String(count)).toBe(1);
  });

  it('strikes once per trap caught at the reckoning, at most eight strikes', () => {
    expect(reckoningSteps(2, 1, 'push')).toEqual([0.5]);
    expect(reckoningSteps(4, 4, 'rout')).toEqual([0.75, 0.5, 0.25, 0]);
    expect(reckoningSteps(0, 0, 'rout')).toEqual([0]); // a perfect dictation routs her at once
    expect(reckoningSteps(3, 0, 'standoff')).toEqual([]);
    const many = reckoningSteps(20, 20, 'rout');
    expect(many).toHaveLength(8);
    expect(many.at(-1)).toBe(0);
    for (let i = 1; i < many.length; i++) expect(many[i]).toBeLessThan(many[i - 1]);
  });

  it('ends the hold where the outcome leaves it, whatever was caught (spec 2026-09-29: the copy is what counts)', () => {
    // A rout empties the bar, even with little or nothing caught (one strike then).
    expect(reckoningSteps(4, 1, 'rout')).toEqual([0]);
    expect(reckoningSteps(3, 0, 'rout')).toEqual([0]);
    // A push leaves part of it: between a quarter and three quarters.
    expect(reckoningSteps(4, 0, 'push')).toEqual([0.75]);
    expect(reckoningSteps(4, 4, 'push').at(-1)).toBe(0.25);
    // A standoff never empties it.
    expect(reckoningSteps(4, 4, 'standoff').at(-1)).toBe(0.25);
    expect(reckoningSteps(4, 1, 'standoff')).toEqual([0.75]);
    for (const [draft, caught] of [[0, 0], [1, 0], [3, 3], [20, 20], [5, 2]]) {
      expect(reckoningSteps(draft, caught, 'rout').at(-1), `rout ${draft}/${caught}`).toBe(0);
      const push = reckoningSteps(draft, caught, 'push').at(-1)!;
      expect(push > 0 && push < 1, `push ${draft}/${caught}`).toBe(true);
      expect(reckoningSteps(draft, caught, 'standoff').at(-1) ?? 1, `standoff ${draft}/${caught}`).toBeGreaterThan(0);
    }
  });

  it("names a lieutenant's outcome from the copy verdict: belle routs, correcte pushes back, à reprendre stands", () => {
    expect(outcomeOf('belle', null)).toBe('rout');
    expect(outcomeOf('correcte', null)).toBe('push');
    expect(outcomeOf('reprendre', null)).toBe('standoff');
    const of = (left: number, words: number) => outcomeOf(copyVerdict(per100(left, words), DEFAULT_RULES), null);
    // Two mistakes left on 150 words, none caught: 1.3 per 100 words, a belle copie (the catch rate
    // of 0 no longer decides).
    expect(of(2, 150)).toBe('rout');
    // Six left on 150 words, none caught: 4 per 100, a copie correcte: pushed back, not standing.
    expect(of(6, 150)).toBe('push');
    expect(of(13, 150)).toBe('standoff');
    expect(hpPercent({ value: 0.504, segments: null })).toBe(50);
  });

  it("names Éris's from the server's win or loss, never the copy's", () => {
    expect(outcomeOf('reprendre', { won: true })).toBe('rout');
    // Closing item 2: a lost boss fight is always a standoff, even with a belle copie (never a "push"
    // half-victory - the server's win/loss is binary, and a loss must not borrow that title).
    expect(outcomeOf('belle', { won: false })).toBe('standoff');
    expect(outcomeOf('correcte', { won: false })).toBe('standoff');
  });

  it('empties the bar of a won boss fight with nothing caught, and keeps it up for a lost one with everything caught', () => {
    // Final review I1: 3 draft mistakes on 200 words, none caught, is a won fight (1.5 per 100).
    const won = reckoningVerdict('belle', { bossFight: true, progression: { boss: { won: true } } })!;
    expect(won).toBe('rout');
    expect(reckoningSteps(3, 0, won)).toEqual([0]);
    const lost = reckoningVerdict('reprendre', { bossFight: true, progression: { boss: { won: false } } })!;
    expect(lost).toBe('standoff');
    expect(reckoningSteps(5, 5, lost).at(-1)).toBeGreaterThan(0);
  });

  it("gives a boss fight's verdict only with the server's, so UI5 hears one outcome (lane V fix round 1)", () => {
    // A failed submission leaves the boss with no verdict (no outcome yet), never a provisional one.
    expect(reckoningVerdict('correcte', { bossFight: true, progression: null })).toBeNull();
    expect(reckoningVerdict('correcte', { bossFight: true, progression: { boss: { won: true } } })).toBe('rout');
    expect(reckoningVerdict('correcte', { bossFight: true, progression: { boss: { won: false } } })).toBe('standoff');
    // Any other fight is the client's own copy verdict, with or without the server.
    expect(reckoningVerdict('correcte', { bossFight: false, progression: null })).toBe('push');
    expect(reckoningVerdict('belle', { bossFight: false, progression: { boss: null } })).toBe('rout');
  });
});
