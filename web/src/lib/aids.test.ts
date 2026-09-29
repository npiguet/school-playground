import { describe, expect, it } from 'vitest';
import { AID_KEYS, AID_LABELS, SUGGEST_ORDER, aidDesc, aidIcon, bonusParts, listFr, normalizeAids, suggestion, type AidKey } from './aids';
import { DEFAULT_RULES as R } from './rules';

const ALL = [...AID_KEYS];
const NO_OWL: AidKey[] = ['argus', 'ariane', 'persee', 'palamede'];
const belle = (aids: string[] | null, mode = 'dictation') => ({ mode, aids, per_100: 1 });
const correcte = { mode: 'dictation', aids: ALL, per_100: 5 };
const reprendre = { mode: 'dictation', aids: ALL, per_100: 9 };

describe('the five review aids (spec 2026-09-29 §3)', () => {
  it('are the five, suggested in their own order', () => {
    expect(AID_KEYS).toEqual(['argus', 'ariane', 'persee', 'athena', 'palamede']);
    expect(SUGGEST_ORDER).toEqual(['athena', 'argus', 'palamede', 'persee', 'ariane']);
    expect(AID_LABELS.athena).toMatchObject({ name: "La chouette d'Athéna", the: 'la chouette' });
    expect(AID_LABELS.palamede.name).toBe('Les jetons de Palamède');
    expect(aidDesc('athena', R)).toBe('3 indices pour repérer un piège.');
    expect(aidDesc('athena', { ...R, chouette_hints: 1 })).toBe('1 indice pour repérer un piège.');
    for (const k of ['argus', 'ariane', 'persee', 'athena'] as const) expect(aidIcon(k), k).toMatch(/^\/art\/icons\/tool-/);
  });

  it('reads a remembered or saved choice: all five when there is none, only the valid ones once each', () => {
    expect(normalizeAids(undefined)).toEqual(ALL);
    expect(normalizeAids('argus')).toEqual(ALL);
    expect(normalizeAids(null)).toEqual(ALL);
    expect(normalizeAids(['palamede', 'argus', 'argus', 'loupe'])).toEqual(['argus', 'palamede']);
    expect(normalizeAids([])).toEqual([]);
  });

  it('adds the bonuses the muster shows', () => {
    const b = bonusParts({ pace: 2, mode: 'dictation', aids: ['argus', 'ariane', 'persee'], prophecy: false }, R);
    expect(b.pace).toBe(0.25);
    expect(b.aids).toBeCloseTo(0.4, 10);
    expect(b.prophecy).toBe(0);
    expect(b.total).toBeCloseTo(0.65, 10);
    expect(bonusParts({ pace: 3, mode: 'grimoire', aids: [], prophecy: true }, R).total).toBeCloseTo(1.5, 10);
    expect(bonusParts({ pace: 1, mode: 'dictation', aids: ALL, prophecy: false }, R).total).toBe(0);
  });

  it('lists in French', () => {
    expect([listFr([]), listFr(['a']), listFr(['a', 'b']), listFr(['a', 'b', 'c'])]).toEqual(['', 'a', 'a et b', 'a, b et c']);
  });
});

describe('the suggestion, never automatic (spec 2026-09-29 §3)', () => {
  it('suggests leaving the next aid after three belles copies with the same aids', () => {
    expect(suggestion([belle(ALL), belle(ALL), belle(ALL)], ALL, R)).toEqual({ kind: 'leave', aid: 'athena' });
    expect(suggestion([belle(NO_OWL), belle(NO_OWL), belle(NO_OWL)], NO_OWL, R)).toEqual({ kind: 'leave', aid: 'argus' });
    expect(suggestion([belle(['ariane']), belle(['ariane']), belle(['ariane'])], ['ariane'], R)).toEqual({ kind: 'leave', aid: 'ariane' });
    expect(suggestion([belle([]), belle([]), belle([])], [], R)).toBeNull();
  });

  it('needs three dictations in a row, all belles, with the same aids', () => {
    expect(suggestion([belle(ALL), belle(ALL)], ALL, R)).toBeNull();
    expect(suggestion([belle(ALL), correcte, belle(ALL), belle(ALL)], ALL, R)).toBeNull();
    expect(suggestion([belle(ALL), belle(NO_OWL), belle(ALL)], ALL, R)).toBeNull();
    // A defence from before the aids breaks the run.
    expect(suggestion([belle(ALL), belle(ALL), belle(null)], ALL, R)).toBeNull();
    // A grimoire round between them neither counts nor breaks it (plan Ruling R3).
    expect(suggestion([belle(ALL), belle(ALL, 'grimoire'), belle(ALL), belle(ALL)], ALL, R)).toEqual({ kind: 'leave', aid: 'athena' });
  });

  it('never names an aid this muster already leaves', () => {
    expect(suggestion([belle(ALL), belle(ALL), belle(ALL)], NO_OWL, R)).toEqual({ kind: 'leave', aid: 'argus' });
  });

  it('suggests taking back the last aid left after two copies à reprendre', () => {
    expect(suggestion([reprendre, reprendre], ['ariane', 'persee'], R)).toEqual({ kind: 'take', aid: 'palamede' });
    expect(suggestion([reprendre, reprendre], ['argus', 'ariane', 'persee', 'palamede'], R)).toEqual({ kind: 'take', aid: 'athena' });
    expect(suggestion([reprendre, reprendre], ALL, R)).toBeNull();
    expect(suggestion([reprendre, correcte, reprendre], ['ariane'], R)).toBeNull();
  });

  it('reads the copy limits from the rules', () => {
    expect(suggestion([belle(ALL), belle(ALL), belle(ALL)], ALL, { ...R, copy_belle_max_per_100: 0.5 })).toBeNull();
  });
});
