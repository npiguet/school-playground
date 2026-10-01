import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, copyVerdict, paceBonus, per100, prophecyBonusApplies, rulesOf } from './rules';

describe('the rules of the camp (spec 2026-09-29 §7)', () => {
  it('mirrors the server defaults', () => {
    expect(DEFAULT_RULES).toEqual({
      quest_min_chances: 3,
      quest_min_correct: 0.85,
      fight_max_per_100: 4,
      copy_belle_max_per_100: 2,
      copy_correcte_max_per_100: 8,
      aid_bonus: 0.2,
      pace_bonus: { '1': 0, '2': 0.25, '3': 0.5 },
      prophecy_bonus: 0.5,
      chouette_hints: 3,
      levels: [
        { days: 3, chances: 12, correct: 0.85 },
        { days: 4, chances: 25, correct: 0.88 },
        { days: 6, chances: 45, correct: 0.91 },
        { days: 8, chances: 70, correct: 0.94 },
        { days: 10, chances: 100, correct: 0.97 },
      ],
      fights: DEFAULT_RULES.fights,
    });
    expect(DEFAULT_RULES.levels[0]).toEqual({ days: 3, chances: 12, correct: 0.85 });
    expect(DEFAULT_RULES.fights).toHaveLength(10);
    expect(DEFAULT_RULES.fights[0]).toEqual({ level: 1, count: 2 });
    expect(DEFAULT_RULES.fights[9]).toEqual({ level: 5, count: 'all' });
  });

  it("reads the server's rules from the world catalog, the defaults until it has come", () => {
    const served = { ...DEFAULT_RULES, chouette_hints: 1 };
    expect(rulesOf({ rules: served })).toBe(served);
    expect(rulesOf(null)).toBe(DEFAULT_RULES);
    expect(rulesOf({})).toBe(DEFAULT_RULES);
  });

  it('counts the mistakes left per 100 words, never dividing by zero', () => {
    expect(per100(3, 150)).toBe(2);
    expect(per100(0, 120)).toBe(0);
    expect(per100(4, 0)).toBe(0);
  });

  it('names the copy as a teacher would, the limits included', () => {
    expect(copyVerdict(0, DEFAULT_RULES)).toBe('belle');
    expect(copyVerdict(2, DEFAULT_RULES)).toBe('belle');
    expect(copyVerdict(2.5, DEFAULT_RULES)).toBe('correcte');
    expect(copyVerdict(8, DEFAULT_RULES)).toBe('correcte');
    expect(copyVerdict(8.1, DEFAULT_RULES)).toBe('reprendre');
    expect(copyVerdict(1, { ...DEFAULT_RULES, copy_belle_max_per_100: 0.5 })).toBe('correcte');
  });

  it('pays the pace bonus, a stale pace 4 as pace 3, never in the grimoire', () => {
    expect([1, 2, 3, 4].map((p) => paceBonus(p, 'dictation', DEFAULT_RULES))).toEqual([0, 0.25, 0.5, 0.5]);
    expect(paceBonus(3, 'grimoire', DEFAULT_RULES)).toBe(0);
  });

  it('pays the prophecy only before its day, as the server does', () => {
    const today = new Date(2026, 8, 29);
    expect(prophecyBonusApplies('2026-09-30', today)).toBe(true);
    expect(prophecyBonusApplies('2026-09-29', today)).toBe(false);
    expect(prophecyBonusApplies(null, today)).toBe(false);
  });
});
