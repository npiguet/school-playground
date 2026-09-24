import { describe, it, expect } from 'vitest';
import { gradeText, tokenize } from '$lib/grading';
import { typedPassSets, orderPasses, activePasses } from './argus';
import type { Annotation, AnnotToken } from '$lib/grading/types';

const REF = 'Les fées ont dansé. Il a chanté.';
function ann(): Annotation {
  const spec: [string, string[]][] = [
    ['DET', ['nominal_group']], ['NOUN', ['nominal_group']], ['AUX', ['verb']], ['VERB', ['participle']], ['PUNCT', []],
    ['PRON', []], ['AUX', ['verb', 'homophone']], ['VERB', ['participle']], ['PUNCT', []],
  ];
  const tokens: AnnotToken[] = tokenize(REF).map((t, i) => ({ i, text: t.text, start: t.start, end: t.end, lemma: t.norm, pos: spec[i][0],
    morph: {}, head: i, dep: 'dep', categories: spec[i][1], homophone: spec[i][1].includes('homophone') ? 'a' : null, subject: null }));
  return { version: 1, model: 't', tokens, sentences: [] };
}
const sets = (typed: string, level: string, traps: string[] = []) =>
  typedPassSets(gradeText(REF, typed, ann()), ann(), traps, level).map((s) => [...s].sort());

describe('typedPassSets', () => {
  it('maps categories through the alignment', () => {
    expect(sets('Les fée ont dansé. Il a chanté.', '10H')).toEqual([
      ['groupes_nominaux'], ['groupes_nominaux'], ['verbes'], ['verbes'], [], [], ['homophones', 'verbes'], ['verbes'], []]);
  });
  it('excludes participles from the verb pass below 8H', () => {
    expect(sets(REF, '7H')[3]).toEqual([]);
    expect(sets(REF, '8H')[3]).toEqual(['verbes']);
  });
  it('lights trap words and unaligned homophones', () => {
    expect(sets(REF, '10H', ['fées'])[1]).toEqual(['groupes_nominaux', 'mots_pieges']);
    expect(sets('Les fées ont dansé à. Il a chanté.', '10H')[4]).toEqual(['homophones']); // extra "à"
  });
});

describe('orderPasses', () => {
  it('accepts a full order and completes a partial or invalid one', () => {
    expect(orderPasses(['homophones', 'verbes', 'groupes_nominaux', 'mots_pieges'])).toEqual(['homophones', 'verbes', 'groupes_nominaux', 'mots_pieges']);
    expect(orderPasses(['homophones'])).toEqual(['homophones', 'verbes', 'groupes_nominaux', 'mots_pieges']);
    expect(orderPasses(undefined)).toEqual(['verbes', 'groupes_nominaux', 'homophones', 'mots_pieges']);
  });
});

// P1-5: a profile with no trap words yet must never get the Mots-pièges pass offered — spotlighting
// it dims the whole text (nothing can ever be in its pass set) and lights nothing.
describe('activePasses', () => {
  it('drops mots_pieges when there are no trap words', () => {
    expect(activePasses(undefined, [])).toEqual(['verbes', 'groupes_nominaux', 'homophones']);
    expect(activePasses(['mots_pieges', 'verbes'], [])).toEqual(['verbes', 'groupes_nominaux', 'homophones']);
  });
  it('keeps mots_pieges once the profile has at least one trap word', () => {
    expect(activePasses(undefined, ['attentive'])).toEqual(['verbes', 'groupes_nominaux', 'homophones', 'mots_pieges']);
  });
});
