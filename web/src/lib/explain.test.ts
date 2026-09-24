import { describe, it, expect } from 'vitest';
import { gradeText, tokenize, mapAnnotation } from '$lib/grading';
import { explain, erisLine, statKeyOf } from './explain';
import type { Annotation, AnnotToken } from '$lib/grading/types';

const REF = 'Les fées dansent dans la clairière.';
function ann(): Annotation {
  const spec: [string, string[], Record<string, string>?, Partial<AnnotToken>?][] = [
    ['DET', ['nominal_group'], { Number: 'Plur' }, { head: 1, dep: 'det' }], ['NOUN', ['nominal_group'], { Gender: 'Fem', Number: 'Plur' }, { head: 2, dep: 'nsubj' }],
    ['VERB', ['verb'], { VerbForm: 'Fin', Number: 'Plur' }, { subject: 1 }], ['ADP', ['homophone'], {}, { homophone: 'dans' }],
    ['DET', ['nominal_group', 'homophone'], { Gender: 'Fem' }, { head: 5, homophone: 'la' }], ['NOUN', ['nominal_group'], { Gender: 'Fem' }], ['PUNCT', []],
  ];
  const tokens: AnnotToken[] = tokenize(REF).map((t, i) => ({ i, text: t.text, start: t.start, end: t.end, lemma: t.norm, pos: spec[i][0],
    morph: spec[i][2] ?? {}, head: i, dep: 'dep', categories: spec[i][1], homophone: null, subject: null, ...(spec[i][3] ?? {}) }));
  return { version: 1, model: 't', tokens, sentences: [] };
}
function ctxFor(typed: string) {
  const g = gradeText(REF, typed, ann());
  return { g, ctx: { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, ann()), annotation: ann() } };
}

describe('explain', () => {
  it('uses the subject for verb agreement', () => {
    const { g, ctx } = ctxFor('Les fées danse dans la clairière.');
    expect(explain(g.errors[0], ctx)).toEqual({ title: "Accord du verbe avec son sujet (L'Hydre)",
      text: '« dansent » s\'accorde avec son sujet « fées » → pluriel → terminaison « nt »' });
  });
  it('uses the head noun for number agreement', () => {
    const { g, ctx } = ctxFor('Le fées dansent dans la clairière.');
    expect(explain(g.errors[0], ctx).text).toBe('« Les » s\'accorde avec « fées » → pluriel');
  });
  it('explains homophones with the table hint', () => {
    const { g, ctx } = ctxFor('Les fées dansent dans là clairière.');
    expect(explain(g.errors[0], ctx).text).toMatch(/^« là » ou « la » \? Ici il faut « la »\. /);
    expect(statKeyOf(g.errors[0])).toBe('homophone');
  });
  it('explains missing words and accents', () => {
    const { g, ctx } = ctxFor('Les fées dansent dans la clairiere');
    expect(explain(g.errors[0], ctx).text).toBe('Un accent change tout : « clairière », pas « clairiere ».');
    expect(explain(g.errors[1], ctx).text).toBe('Il manque « . » ici.');
  });
});

describe('erisLine', () => {
  it('never blames the player', () => {
    expect(erisLine(null, 0, 0)).toMatch(/reviendrai/);
    expect(erisLine(1, 4, 0)).toMatch(/Impossible/);
    expect(erisLine(0.5, 4, 1)).toMatch(/Sournois/);
    expect(erisLine(0, 4, 0)).toMatch(/bien cachés/);
  });
});
