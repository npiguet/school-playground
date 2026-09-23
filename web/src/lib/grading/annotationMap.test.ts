import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenize';
import { mapAnnotation } from './annotationMap';
import type { Annotation } from './types';

const a = (i: number, text: string, start: number, pos: string, categories: string[]): Annotation['tokens'][number] =>
  ({ i, text, start, end: start + text.length, lemma: text, pos, morph: {}, head: i, dep: 'dep', categories, homophone: null, subject: null });

describe('mapAnnotation', () => {
  it('maps client tokens to spaCy tokens by span overlap, largest overlap wins', () => {
    const text = "L'enfant dort.";
    const annotation: Annotation = { version: 1, model: 't', sentences: [], tokens: [
      a(0, "L'", 0, 'DET', ['nominal_group']), a(1, 'enfant', 2, 'NOUN', ['nominal_group']),
      a(2, 'dort', 9, 'VERB', ['verb']), a(3, '.', 13, 'PUNCT', [])] };
    const mapped = mapAnnotation(tokenize(text), annotation);
    expect(mapped.map((m) => m?.text)).toEqual(['enfant', 'dort', '.']);
  });
  it('returns undefined entries without annotation or when spans do not overlap', () => {
    expect(mapAnnotation(tokenize('a b'), null)).toEqual([undefined, undefined]);
    const annotation: Annotation = { version: 1, model: 't', sentences: [], tokens: [a(0, 'zzz', 40, 'X', [])] };
    expect(mapAnnotation(tokenize('a b'), annotation)).toEqual([undefined, undefined]);
  });
});
