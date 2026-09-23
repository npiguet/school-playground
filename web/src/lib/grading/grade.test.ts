import { describe, it, expect, vi } from 'vitest';

// content/homophones.json is a placeholder maintained by another task in a parallel lane
// (see the task brief's dependency note); this fixture supplies the "et/est" pair these
// tests rely on, so grading is deterministic regardless of that file's real content.
// vi.mock is hoisted above the imports below by vitest.
vi.mock('@content/homophones.json', () => ({
  default: {
    version: 1,
    sets: [
      { id: 'a_agrave', words: ['à', 'a'], hint: '"a" (verbe avoir) vs "à" (préposition)' },
      { id: 'et_est', words: ['et', 'est'], hint: '"et" (conjonction) vs "est" (verbe être)' },
      { id: 'ces_ses_cest_sest', words: ["c'est", 'ces', 'ses', "s'est", 'sais', 'sait'], hint: 'homophones en "s(es)"' },
      { id: 'son_sont', words: ['son', 'sont'], hint: '"son" (possessif) vs "sont" (verbe être)' },
      { id: 'ou_ouaccent', words: ['où', 'ou'], hint: '"ou" (choix) vs "où" (lieu)' },
      { id: 'la_family', words: ["l'a", 'la', 'là'], hint: '"la" (article) vs "l\'a" vs "là" (lieu)' },
      { id: 'peu_peut', words: ['peu', 'peut', 'peux'], hint: '"peu" (quantité) vs "peut/peux" (verbe pouvoir)' },
      { id: 'quelle_family', words: ["qu'elle", 'quelle', 'quel', 'quels', 'quelles'], hint: '"quelle" vs "qu\'elle"' },
      { id: 'leur_leurs', words: ['leur', 'leurs'], hint: '"leur" (singulier) vs "leurs" (pluriel)' },
    ],
  },
}));

import { gradeText, gradeSession, computeScore, errorKey } from './grade';
import type { Annotation } from './types';

import { tokenize } from './tokenize';
import type { AnnotToken } from './types';

const REF = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
// Hand-built annotation: one entry per client token of REF, in order (offsets come from the tokenizer, so
// the client and "spaCy" spans coincide exactly in this test).
// Tokens: Les fées dansent dans la clairière . Elles chantent et les oiseaux les écoutent .
function ann(): Annotation {
  const spec: [string, string[], Record<string, string>?, Partial<AnnotToken>?][] = [
    ['DET', ['nominal_group']], ['NOUN', ['nominal_group']],
    ['VERB', ['verb'], { VerbForm: 'Fin', Number: 'Plur' }, { subject: 1 }],
    ['ADP', ['homophone'], {}, { homophone: 'dans' }], ['DET', ['nominal_group', 'homophone'], {}, { homophone: 'la' }],
    ['NOUN', ['nominal_group']], ['PUNCT', []],
    ['PRON', []], ['VERB', ['verb'], { VerbForm: 'Fin' }, { subject: 7 }], ['CCONJ', ['homophone'], {}, { homophone: 'et' }],
    ['DET', ['nominal_group']], ['NOUN', ['nominal_group']], ['PRON', []], ['VERB', ['verb'], { VerbForm: 'Fin' }, { subject: 11 }], ['PUNCT', []],
  ];
  const tokens: AnnotToken[] = tokenize(REF).map((t, i) => ({
    i, text: t.text, start: t.start, end: t.end, lemma: t.norm, pos: spec[i][0], morph: spec[i][2] ?? {},
    head: i, dep: 'dep', categories: spec[i][1], homophone: null, subject: null, ...(spec[i][3] ?? {}),
  }));
  return { version: 1, model: 'test', tokens, sentences: [] };
}
// Opportunity counts implied by this annotation: verb 3, nominal_group 6, homophone 3,
// words with diacritics 3 (fées, clairière, écoutent), words 13.

describe('gradeText', () => {
  it('finds no errors on a perfect text', () => {
    const g = gradeText(REF, REF, ann());
    expect(g.errors).toEqual([]);
    expect(g.totalWords).toBe(13);
    expect(g.correctWords).toBe(13);
    expect(gradeText("cœur d’or", "coeur d'or", null).errors).toEqual([]);
  });
  it('classifies each wrong token with the reference index', () => {
    const typed = 'Les fée danse dans la clairiere. Elles chantent est les oiseaux les écoute.';
    const g = gradeText(REF, typed, ann());
    expect(g.errors.map((e) => [e.expected, e.typed, e.category, e.sub])).toEqual([
      ['fées', 'fée', 'agreement', 'number'],
      ['dansent', 'danse', 'agreement', 'verb'],
      ['clairière', 'clairiere', 'accent', undefined],
      ['et', 'est', 'homophone', undefined],
      ['écoutent', 'écoute', 'agreement', 'verb'],
    ]);
    expect(g.errors[0].refIndex).toBe(1);
    expect(g.correctWords).toBe(8);
  });
  it('reports missing and extra words with anchors', () => {
    const g = gradeText('le chat noir dort', 'le petit chat dort', null);
    expect(g.errors.map((e) => [e.category, e.sub, e.expected, e.typed, e.anchor])).toEqual([
      ['lexical', 'extra', null, 'petit', 0],
      ['lexical', 'missing', 'noir', null, 1],
    ]);
  });
});

describe('errorKey', () => {
  it('keys reference-anchored errors by refIndex and extra words by anchor and text', () => {
    const g = gradeText('le chat noir dort', 'le petit chat dort', null);
    expect(g.errors.map(errorKey)).toEqual(['x0:petit', 'r2']);
  });
});

describe('computeScore', () => {
  it('follows the formula and pace multiplier', () => {
    expect(computeScore(10, 0, null, 1)).toBe(70);          // 20 + 50 bonus
    expect(computeScore(10, 2, 0.5, 1)).toBe(110);          // 20 + 40 + 50
    expect(computeScore(10, 2, 0.5, 4)).toBe(220);
    expect(computeScore(0, 0, 0, 2)).toBe(0);
  });
});

describe('gradeSession', () => {
  const draft = 'Les fée danse dans la clairiere. Elles chantent est les oiseaux les écoutent.';
  it('splits draft errors into caught, missed and introduced', () => {
    const final = 'Les fées dansent dans la clairiere. Elles chante est les oiseaux les écoutent.';
    const s = gradeSession(REF, draft, final, ann(), { paceLevel: 2 });
    expect(s.draftErrors).toHaveLength(4);
    expect(s.caught.map((e) => e.expected)).toEqual(['fées', 'dansent']);
    expect(s.missed.map((e) => e.expected)).toEqual(['clairière', 'et']);
    expect(s.introduced.map((e) => e.expected)).toEqual(['chantent']);
    expect(s.catchRate).toBeCloseTo(0.5);
    expect(s.finalErrors).toHaveLength(3);
    expect(s.correctWords).toBe(10);
    expect(s.score).toBe(computeScore(10, 2, 0.5, 2));
    expect(s.byCategory['agreement:verb']).toEqual({ opportunities: 3, draft: 1, caught: 1, missed: 0, introduced: 1 });
    expect(s.byCategory['agreement:number']).toEqual({ opportunities: 6, draft: 1, caught: 1, missed: 0, introduced: 0 });
    expect(s.byCategory['homophone']).toEqual({ opportunities: 3, draft: 1, caught: 0, missed: 1, introduced: 0 });
    expect(s.byCategory['accent']).toEqual({ opportunities: 3, draft: 1, caught: 0, missed: 1, introduced: 0 });
    expect(s.byCategory['lexical']?.opportunities).toBe(13);
    expect(s.version).toBe(1);
  });
  it('returns a null catch rate when the draft had no errors', () => {
    const s = gradeSession(REF, REF, REF, ann(), { paceLevel: 1 });
    expect(s.catchRate).toBeNull();
    expect(s.caught).toEqual([]);
    expect(s.score).toBe(computeScore(13, 0, null, 1));
  });
  it('counts a wrong word changed into another wrong word as missed', () => {
    const final = draft.replace('danse ', 'dansant ');
    const s = gradeSession(REF, draft, final, ann(), { paceLevel: 1 });
    expect(s.missed.some((e) => e.expected === 'dansent' && e.typed === 'dansant')).toBe(true);
    expect(s.caught.map((e) => e.expected)).not.toContain('dansent');
  });
});
