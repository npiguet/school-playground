import { describe, it, expect } from 'vitest';
import { gradeSession } from '../grading';
import type { AnnotToken } from '../grading/types';
import { letheCut, sireneLike, withDerivedCategories } from './derived';

function tok(i: number, text: string, start: number, extra: Partial<AnnotToken> = {}): AnnotToken {
  return {
    i,
    text,
    start,
    end: start + text.length,
    lemma: text,
    pos: 'NOUN',
    morph: {},
    head: i,
    dep: 'dep',
    categories: [],
    homophone: null,
    subject: null,
    ...extra,
  };
}

describe('sireneLike', () => {
  it('flags relative qui, long distance, inversion and object pronoun (v2 chains)', () => {
    const annots = [
      tok(0, 'a', 0),
      tok(1, 'b', 2),
      tok(2, 'c', 4),
      tok(3, 'd', 6),
      tok(4, 'e', 8, { pos: 'PRON', dep: 'obj' }),
      tok(5, 'f', 10, { pos: 'VERB' }),
    ];
    const chain = (o: object) =>
      ({
        id: 0,
        kind: 'subject_verb',
        controller: 3,
        controller_group: [3],
        targets: [5],
        via: null,
        via_token: null,
        features: {},
        confidence: 'high',
        distance: 2,
        rule: null,
        ...o,
      }) as never;
    expect(sireneLike(annots, [chain({})], 5)).toBe(true); // pronoun 'e' between d and f
    expect(sireneLike(annots, [chain({ controller: 4, targets: [5], distance: 1 })], 5)).toBe(false);
    expect(sireneLike(annots, [chain({ controller: 0, distance: 5 })], 5)).toBe(true);
    expect(sireneLike(annots, [chain({ via: 'qui', controller: 4, distance: 1 })], 5)).toBe(true);
    expect(sireneLike(annots, [chain({ controller: 4, distance: 1, confidence: 'low', via: 'qui' })], 5)).toBe(false);
  });

  it('falls back to the v1 subject field', () => {
    const annots = [tok(0, 'a', 0), tok(1, 'b', 2), tok(2, 'c', 4), tok(3, 'd', 6), tok(4, 'e', 8), tok(5, 'f', 10, { pos: 'VERB', subject: 0 })];
    expect(sireneLike(annots, undefined, 5)).toBe(true);
    annots[5].subject = 4;
    expect(sireneLike(annots, undefined, 5)).toBe(false);
  });
});

describe('withDerivedCategories', () => {
  // 90 words: cut at token 60 (Léthé requires >= 60 words - see LETHE_MIN_WORDS in derived.ts).
  const ref = Array.from({ length: 90 }, (_, i) => (i === 89 ? 'fin.' : `mot${i}`)).join(' ');

  it('adds derived:lethe from the last third and leaves the original categories intact', () => {
    const draft = ref.replace('mot75', 'moX75').replace('mot3', 'moX3');
    const base = gradeSession(ref, draft, draft, null);
    const out = withDerivedCategories(base, ref, draft, null);
    expect(out.byCategory.lexical).toEqual(base.byCategory.lexical);
    expect(out.byCategory['derived:lethe' as never]).toMatchObject({ draft: 1, caught: 0, missed: 1 });
    expect((out.byCategory['derived:lethe' as never] as unknown as { opportunities: number }).opportunities).toBeGreaterThanOrEqual(25);
  });

  it('skips lethe on short texts and sirenes without annotation', () => {
    const short = 'Les fées dansent dans la clairière.';
    const out = withDerivedCategories(gradeSession(short, short, short, null), short, short, null);
    expect(out.byCategory['derived:lethe' as never]).toBeUndefined();
    expect(out.byCategory['derived:sirenes' as never]).toBeUndefined();
  });

  it('letheCut is the floor of two thirds', () => {
    expect(letheCut(30)).toBe(20);
    expect(letheCut(31)).toBe(20);
  });
});
