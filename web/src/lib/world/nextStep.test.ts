import { describe, expect, it } from 'vitest';
import { LIEUTENANT_ORDER, type CampResponse, type LieutenantState } from './types';
import { HUB_PLACE, nextStep, sealWithinReach, whatNext } from './nextStep';

function camp(over: Partial<CampResponse> = {}): CampResponse {
  return {
    xp: { total: 40 },
    quests: [],
    prophecies: [],
    oracle: { week: 'w', status: 'chosen', reward_id: null },
    boss: { tier_available: null, tiers_won: [], active_quest_id: null, fights: 10, next: null },
    ...over,
  } as unknown as CampResponse;
}
const open = { tier_available: 1, tiers_won: [], active_quest_id: null, fights: 10, next: null };
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
    const engaged = camp({ boss: { tier_available: 1, tiers_won: [], active_quest_id: 9, fights: 10, next: null }, quests: [{ id: 9, kind: 'boss', status: 'active' }] as CampResponse['quests'] });
    expect(nextStep(engaged)).toBeNull();
  });

  it('leads each step to one hub place', () => {
    expect(HUB_PLACE).toEqual({ battle: 'boss', 'first-text': 'parchemins', prophecy: 'oracle', scrolls: 'oracle' });
  });
});

const need = { days: 4, chances: 25, correct: 0.88 };
const win = (days: number, chances: number, correct: number | null) => ({
  level: 2, days, chances, correct, complete: days >= need.days && chances >= need.chances, need,
});
const lt = (key: string, o: Partial<LieutenantState> = {}) =>
  ({ key, name: key, available: true, level: 1, next: win(0, 0, null), ...o }) as unknown as LieutenantState;
const withLt = (o: Record<string, Partial<LieutenantState>>) => LIEUTENANT_ORDER.map((k) => lt(k, o[k]));
const bossClosed = { tier_available: null, tiers_won: [], active_quest_id: null, fights: 10, next: { tier: 1, level: 1, missing: 2 } };
function state(o: Record<string, unknown> = {}): CampResponse {
  return {
    xp: { total: 300, floor: 100, next: 1200 },
    dragon: { name: 'Braise', stage: 'hatchling', tint: 'bronze', worn: [] },
    lieutenants: withLt({}),
    quests: [],
    prophecies: [],
    oracle: { week: 'w', status: 'chosen', reward_id: null },
    weekly: { week: 'w', target: 3, done: 3, reached: true },
    boss: bossClosed,
    affordable: 0,
    ...o,
  } as unknown as CampResponse;
}

describe("the dragon's what-next line (spec 2026-09-29 explanations §1)", () => {
  // Review focus 1: every case true at once, then peeled one by one.
  it('takes the first case that holds, in the order of R1', () => {
    const c: Record<string, unknown> = {
      dragon: { name: null, stage: 'hatchling', tint: 'bronze', worn: [] },
      prophecies: prophecy(3),
      boss: { ...bossClosed, tier_available: 1, next: null },
      xp: { total: 0, floor: 0, next: 100 },
      lieutenants: withLt({ echo: { next: win(3, 18, 0.9) } }),
      affordable: 2,
      oracle: { week: 'w', status: 'sealed', reward_id: null },
      weekly: { week: 'w', target: 3, done: 1, reached: false },
    };
    const peel: Record<string, unknown>[] = [
      { dragon: { name: 'Braise', stage: 'hatchling', tint: 'bronze', worn: [] } },
      { prophecies: [] },
      { boss: bossClosed },
      { xp: { total: 1150, floor: 100, next: 1200 } },
      { lieutenants: withLt({}) },
      { xp: { total: 300, floor: 100, next: 1200 } },
      { affordable: 0 },
      { oracle: { week: 'w', status: 'chosen', reward_id: null } },
      { weekly: { week: 'w', target: 3, done: 3, reached: true } },
    ];
    const seen = [whatNext(state(c)).kind];
    for (const drop of peel) {
      Object.assign(c, drop);
      seen.push(whatNext(state(c)).kind);
    }
    expect(seen).toEqual(['name', 'prophecy', 'battle', 'first-text', 'seal', 'stage', 'shop', 'scrolls', 'weekly', 'none']);
  });

  it('asks for a name at any hatched stage, never from the egg', () => {
    expect(whatNext(state({ dragon: { name: null, stage: 'young', tint: 'bronze', worn: [] } }))).toEqual({ kind: 'name', key: 'camp.next.name' });
    expect(whatNext(state({ dragon: { name: null, stage: 'egg', tint: 'bronze', worn: [] } })).kind).toBe('none');
  });

  it('keeps pointing at Éris while her fight is under way', () => {
    const engaged = { ...bossClosed, tier_available: 2, active_quest_id: 9, next: null };
    expect(whatNext(state({ boss: engaged }))).toEqual({ kind: 'battle', key: 'camp.next.battle' });
  });

  // Review focus 1 (R3): whole numbers at 70 %, the share's tolerance, the ties.
  it('finds a seal within reach: 70 % of the window, the share at target', () => {
    const at = (w: ReturnType<typeof win> | null, o: Partial<LieutenantState> = {}) => sealWithinReach(state({ lieutenants: withLt({ hydre: { next: w, ...o } }) }));
    expect(at(win(3, 18, 0.88))).toEqual({ key: 'hydre', level: 2 }); // 75 % of the days, 72 % of the chances
    expect(at(win(3, 18, 22 / 25))).toEqual({ key: 'hydre', level: 2 }); // 0.88 as the server computes it
    expect(at(win(4, 25, 0.9))).toEqual({ key: 'hydre', level: 2 }); // complete, not sealed yet
    expect(at(win(3, 17, 0.9))).toBeNull(); // 68 % of the chances
    expect(at(win(2, 25, 0.9))).toBeNull(); // 50 % of the days
    expect(at(win(3, 18, 0.87))).toBeNull();
    expect(at(win(3, 18, null))).toBeNull();
    expect(at(null, { level: 5 })).toBeNull();
    expect(at(win(3, 18, 0.9), { available: false })).toBeNull();
    // Ties: the fuller window, then the camp's order.
    expect(sealWithinReach(state({ lieutenants: withLt({ echo: { next: win(3, 18, 0.9) }, lethe: { next: win(4, 25, 0.9) } }) }))).toEqual({ key: 'lethe', level: 2 });
    expect(sealWithinReach(state({ lieutenants: withLt({ lethe: { next: win(3, 18, 0.9) }, echo: { next: win(3, 18, 0.9) } }) }))).toEqual({ key: 'echo', level: 2 });
  });

  it('names the lieutenant and the seal, the Sirènes with their own lines', () => {
    const line = (key: string) => whatNext(state({ lieutenants: withLt({ [key]: { next: win(3, 18, 0.9) } }) }));
    expect(line('hydre')).toEqual({ kind: 'seal', key: 'camp.next.seal', vars: { lieutenant: "l'Hydre", seal: 'sceau de bronze' }, ctx: { opponent: 'hydre' } });
    expect(line('sirenes')).toMatchObject({ vars: { lieutenant: 'les Sirènes', seal: 'sceau de bronze' }, ctx: { opponent: 'sirenes' } });
    expect(line('protee').vars).toEqual({ lieutenant: 'Protée', seal: 'sceau de bronze' });
    const argent = whatNext(state({ lieutenants: withLt({ chimere: { level: 2, next: { ...win(5, 40, 0.92), level: 3, need: { days: 6, chances: 45, correct: 0.91 } } } }) }));
    expect(argent.vars).toEqual({ lieutenant: 'la Chimère', seal: "sceau d'argent" });
  });

  it('says the stage is close only on its own scale', () => {
    expect(whatNext(state({ xp: { total: 1150, floor: 100, next: 1200 } })).kind).toBe('stage');
    expect(whatNext(state({ xp: { total: 90, floor: 0, next: 100 }, dragon: { name: null, stage: 'egg', tint: 'bronze', worn: [] } })).kind).toBe('stage');
    expect(whatNext(state({ xp: { total: 300, floor: 5000, next: 15000 }, dragon: { name: 'Braise', stage: 'adult', tint: 'bronze', worn: [] } })).kind).toBe('none');
    expect(whatNext(state({ xp: { total: 41000, floor: 40000, next: null }, dragon: { name: 'Braise', stage: 'ancestral', tint: 'bronze', worn: [] } })).kind).toBe('none');
  });

  // R1 (Task 1 review): the line and the glow agree whenever the glow's step outranks the other goals:
  // over every combination of the cases, a named (or unhatched) dragon and no fight under way, the
  // line follows the glow, except that a seal, the stage or the stall outranks the sealed scrolls.
  it('agrees with the glow whenever it has a step', () => {
    const egg = { name: null, stage: 'egg', tint: 'bronze', worn: [] };
    const named = { name: 'Braise', stage: 'hatchling', tint: 'bronze', worn: [] };
    const axes: Record<string, unknown[]> = {
      dragon: [egg, named],
      prophecies: [[], prophecy(3), prophecy(10)],
      boss: [bossClosed, { ...bossClosed, tier_available: 1, next: null }],
      xp: [{ total: 0, floor: 0, next: 100 }, { total: 300, floor: 100, next: 1200 }, { total: 1150, floor: 100, next: 1200 }],
      lieutenants: [withLt({}), withLt({ echo: { next: win(3, 18, 0.9) } })],
      affordable: [0, 2],
      oracle: [sealed, { week: 'w', status: 'chosen', reward_id: null }],
      weekly: [{ week: 'w', target: 3, done: 3, reached: true }, { week: 'w', target: 3, done: 1, reached: false }],
    };
    let combos: Record<string, unknown>[] = [{}];
    for (const [k, values] of Object.entries(axes)) combos = combos.flatMap((c) => values.map((v) => ({ ...c, [k]: v })));
    let checked = 0;
    for (const o of combos) {
      const c = state(o);
      const step = nextStep(c);
      if (step === null) continue;
      checked++;
      const kind = whatNext(c).kind;
      if (step === 'scrolls' && ['seal', 'stage', 'shop'].includes(kind)) continue;
      expect(kind, JSON.stringify(o)).toBe(step);
    }
    expect(checked).toBeGreaterThan(300);
  });

  it("counts the week's texts in words", () => {
    expect(whatNext(state({ weekly: { week: 'w', target: 3, done: 2, reached: false } }))).toEqual({ kind: 'weekly', key: 'camp.next.weekly', vars: { texts: 'un texte' } });
    expect(whatNext(state({ weekly: { week: 'w', target: 5, done: 0, reached: false } })).vars).toEqual({ texts: 'cinq textes' });
  });
});
