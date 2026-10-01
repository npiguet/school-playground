import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_RULES, copyVerdict, paceBonus, per100, prophecyBonusApplies, rulesOf, type GameRules } from './rules';
import { sealNeedLine } from './world/seals';

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
      fights: [
        { level: 1, count: 2 }, { level: 1, count: 'all' }, { level: 2, count: 2 }, { level: 2, count: 'all' },
        { level: 3, count: 2 }, { level: 3, count: 'all' }, { level: 4, count: 2 }, { level: 4, count: 'all' },
        { level: 5, count: 2 }, { level: 5, count: 'all' },
      ],
      drachmes: { xp_per_drachme: 10, board: 5, oracle: 15, weekly: 5, level: 10, boss: 30 },
    });
  });

  it("reads the server's rules from the world catalog, the defaults until it has come", () => {
    const served = { ...DEFAULT_RULES, chouette_hints: 1 };
    expect(rulesOf({ rules: served })).toBe(served);
    expect(rulesOf(null)).toBe(DEFAULT_RULES);
    expect(rulesOf({})).toBe(DEFAULT_RULES);
  });

  it("reads the rules exactly as GET /api/world serves them (the server's own example)", () => {
    // server/tests/test_rules.py checks the server serves this same block for the same regles.json.
    const example = JSON.parse(readFileSync('../server/tests/fixtures/rules/world_rules.json', 'utf-8'));
    const rules = rulesOf({ rules: example.served as GameRules });
    for (const key of Object.keys(DEFAULT_RULES)) expect(rules, key).toHaveProperty(key);
    expect(rules.levels).toHaveLength(5);
    for (const need of rules.levels) {
      expect(Object.keys(need).sort()).toEqual(['chances', 'correct', 'days']);
      expect(Object.values(need).every((v) => typeof v === 'number')).toBe(true);
    }
    for (const f of rules.fights) {
      expect(Object.keys(f).sort()).toEqual(['count', 'level']);
      expect(typeof f.level).toBe('number');
      expect(f.count === 'all' || typeof f.count === 'number').toBe(true);
    }
    expect(rules.fights).toEqual([{ level: 1, count: 3 }, { level: 2, count: 'all' }, { level: 5, count: 1 }]);
    expect(sealNeedLine(rules.levels[0])).toBe('2 jours de garde et 10 pièges, dont 100\u202f% déjoués.');
    expect(rules.levels[2]).toEqual({ days: 6, chances: 50, correct: 0.91 });
    expect(rules.drachmes).toEqual(DEFAULT_RULES.drachmes);
  });

  it("knows what pays drachmes, as the server's defaults (spec 2026-09-29 drachmes §1)", () =>
    expect(DEFAULT_RULES.drachmes).toEqual({ xp_per_drachme: 10, board: 5, oracle: 15, weekly: 5, level: 10, boss: 30 }));

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
