import { describe, expect, it } from 'vitest';
import { ALL_AIDS, type AidKey } from '../aids';
import { proofAids } from './proofAids';

const o = { hints: 3, hintsUsed: 0, initialErrors: 2 };
const none = { passes: false, fil: false, bouclier: false, hintsLeft: 0, chouette: false, count: null };

describe('the proofreading shows the aids taken, and only them (spec 2026-09-29 §3)', () => {
  it('shows nothing of an aid left at the camp', () => {
    expect(proofAids([], o)).toEqual(none);
  });

  it.each([
    ['argus', { passes: true }],
    ['ariane', { fil: true }],
    ['persee', { bouclier: true }],
    ['athena', { hintsLeft: 3, chouette: true }],
    ['palamede', { count: 2 }],
  ] as [AidKey, object][])('%s alone brings its own tool', (aid, on) => {
    expect(proofAids([aid], o)).toEqual({ ...none, ...on });
  });

  it('gives the owl the hints of the rules, and hides her once they are spent', () => {
    expect(proofAids(ALL_AIDS, { ...o, hints: 1 })).toMatchObject({ hintsLeft: 1, chouette: true });
    expect(proofAids(ALL_AIDS, { ...o, hintsUsed: 3 })).toMatchObject({ hintsLeft: 0, chouette: false });
    expect(proofAids(ALL_AIDS, { ...o, hintsUsed: 9 })).toMatchObject({ hintsLeft: 0 });
  });

  it("counts Palamède's traps from the frozen count, zero before it is frozen", () => {
    expect(proofAids(['palamede'], { ...o, initialErrors: undefined }).count).toBe(0);
    expect(proofAids(['palamede'], { ...o, initialErrors: 0 }).count).toBe(0);
  });
});
