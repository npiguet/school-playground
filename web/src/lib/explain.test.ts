import { describe, it, expect } from 'vitest';
import { gradeText, tokenize, mapAnnotation } from '$lib/grading';
import { caughtText, explain, erisLine, statKeyOf } from './explain';
import type { Annotation, AnnotToken, Chain, TokenError } from '$lib/grading/types';

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

// SP2 Task 7: chain-aware explanations. Fixture copied from chains.test.ts/fil.test.ts (never
// import test files) — "Les fées qui chantent dansent.": a relative-clause subject-verb chain
// (medium confidence, via "qui"), a plain subject-verb chain (high confidence), and a nominal
// chain for "Les"/"fées" agreement.
describe('explain (chain-aware, SP2 Task 7)', () => {
  const REF2 = 'Les fées qui chantent dansent.';
  const CHAINS2: Chain[] = [
    {
      id: 0,
      kind: 'nominal',
      controller: 1,
      controller_group: [0, 1],
      targets: [0],
      via: null,
      via_token: null,
      features: { Gender: 'Fem', Number: 'Plur' },
      confidence: 'high',
      distance: 1,
      rule: null,
    },
    {
      id: 1,
      kind: 'subject_verb',
      controller: 1,
      controller_group: [0, 1],
      targets: [3],
      via: 'qui',
      via_token: 2,
      features: { Gender: 'Fem', Number: 'Plur', Person: '3' },
      confidence: 'medium',
      distance: 2,
      rule: null,
    },
    {
      id: 2,
      kind: 'subject_verb',
      controller: 1,
      controller_group: [0, 1],
      targets: [4],
      via: null,
      via_token: null,
      features: { Gender: 'Fem', Number: 'Plur', Person: '3' },
      confidence: 'high',
      distance: 3,
      rule: null,
    },
  ];
  function ann2(): Annotation {
    const spec: [string, string[], Record<string, string>?][] = [
      ['DET', ['nominal_group']],
      ['NOUN', ['nominal_group'], { Gender: 'Fem', Number: 'Plur' }],
      ['PRON', []],
      ['VERB', ['verb'], { VerbForm: 'Fin' }],
      ['VERB', ['verb'], { VerbForm: 'Fin' }],
      ['PUNCT', []],
    ];
    const tokens: AnnotToken[] = tokenize(REF2).map((t, i) => ({
      i,
      text: t.text,
      start: t.start,
      end: t.end,
      lemma: t.norm,
      pos: spec[i][0],
      morph: spec[i][2] ?? {},
      head: 1,
      dep: 'dep',
      categories: spec[i][1],
      homophone: null,
      subject: null,
    }));
    return { version: 2, model: 't', tokens, sentences: [], chains: CHAINS2 };
  }
  function ctxFor2(typed: string) {
    const g = gradeText(REF2, typed, ann2());
    return { g, ctx: { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, ann2()), annotation: ann2(), body: REF2 } };
  }

  it('names "qui" and the noun it reprend for a relative-clause subject-verb chain', () => {
    const { g, ctx } = ctxFor2('Les fées qui chante dansent.');
    expect(explain(g.errors[0], ctx).text).toBe(
      '« chantent » s\'accorde avec « qui », qui reprend « Les fées » → pluriel → terminaison « nt »',
    );
  });

  it('names the subject for a plain subject-verb chain', () => {
    const { g, ctx } = ctxFor2('Les fées qui chantent danse.');
    expect(explain(g.errors[0], ctx).text).toBe(
      '« dansent » s\'accorde avec son sujet « Les fées » → pluriel → terminaison « nt »',
    );
  });

  it('names the controller noun for a nominal chain', () => {
    const { g, ctx } = ctxFor2('Le fées qui chantent dansent.');
    expect(explain(g.errors[0], ctx).text).toBe('« Les » s\'accorde avec le nom « fées » → féminin pluriel');
  });

  it('explains a participle_etre chain', () => {
    const REF3 = 'Elles sont parties.';
    const CHAINS3: Chain[] = [
      {
        id: 0,
        kind: 'participle_etre',
        controller: 0,
        controller_group: [0],
        targets: [2],
        via: 'aux',
        via_token: 1,
        features: { Gender: 'Fem', Number: 'Plur' },
        confidence: 'high',
        distance: 1,
        rule: null,
      },
    ];
    const spec: [string, string[], Record<string, string>?][] = [
      ['PRON', [], { Gender: 'Fem', Number: 'Plur' }],
      ['AUX', [], { VerbForm: 'Fin' }],
      ['VERB', ['verb'], { VerbForm: 'Part' }],
      ['PUNCT', []],
    ];
    const annotation: Annotation = {
      version: 2,
      model: 't',
      tokens: tokenize(REF3).map((t, i) => ({
        i,
        text: t.text,
        start: t.start,
        end: t.end,
        lemma: t.norm,
        pos: spec[i][0],
        morph: spec[i][2] ?? {},
        head: 2,
        dep: 'dep',
        categories: spec[i][1],
        homophone: null,
        subject: null,
      })),
      sentences: [],
      chains: CHAINS3,
    };
    const g = gradeText(REF3, 'Elles sont partie.', annotation);
    const ctx = { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, annotation), annotation, body: REF3 };
    expect(explain(g.errors[0], ctx).text).toBe(
      'Avec « être », le participe « parties » s\'accorde avec le sujet « Elles » → féminin pluriel',
    );
  });

  it('explains a participle_avoir/cod_before chain from 9H, and falls back to the generic sentence below it', () => {
    const REF4 = 'Elle les a mangées.';
    const CHAINS4: Chain[] = [
      {
        id: 0,
        kind: 'participle_avoir',
        controller: 1,
        controller_group: [1],
        targets: [3],
        via: 'aux',
        via_token: 2,
        features: { Number: 'Plur' },
        confidence: 'high',
        distance: 2,
        rule: 'cod_before',
      },
    ];
    const spec: [string, string[], Record<string, string>?][] = [
      ['PRON', []],
      ['PRON', []],
      ['AUX', [], { VerbForm: 'Fin' }],
      ['VERB', ['verb'], { VerbForm: 'Part' }],
      ['PUNCT', []],
    ];
    const annotation: Annotation = {
      version: 2,
      model: 't',
      tokens: tokenize(REF4).map((t, i) => ({
        i,
        text: t.text,
        start: t.start,
        end: t.end,
        lemma: t.norm,
        pos: spec[i][0],
        morph: spec[i][2] ?? {},
        head: 3,
        dep: 'dep',
        categories: spec[i][1],
        homophone: null,
        subject: null,
      })),
      sentences: [],
      chains: CHAINS4,
    };
    const g = gradeText(REF4, 'Elle les a mangé.', annotation);
    const ctxMangees = { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, annotation), annotation, body: REF4 };
    expect(explain(g.errors[0], { ...ctxMangees, level: '10H' }).text).toBe(
      'Avec « avoir », le participe « mangées » s\'accorde avec le complément « les » placé avant → pluriel',
    );
    expect(explain(g.errors[0], { ...ctxMangees, level: '8H' }).text).toBe(
      'Participe passé « mangées » : avec être, il s\'accorde avec le sujet ; ' +
        'avec avoir, seulement si le complément est placé avant.',
    );
  });

  it('explains a lexical sound-alike error without ever naming the typed spelling as correct', () => {
    const { ctx } = ctxFor2(REF2);
    const soundAlikeErr: TokenError = {
      refIndex: null,
      typedIndex: null,
      expected: 'mère',
      typed: 'mer',
      category: 'lexical',
      sub: 'sound_alike',
      anchor: 0,
    };
    expect(explain(soundAlikeErr, ctx).text).toBe(
      '« mer » se prononce comme « mère », mais ici c\'est « mère ». Il rejoint tes mots-pièges.',
    );
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

describe('caughtText', () => {
  it('quotes what she typed and what she corrected it to', () => {
    const caught: TokenError = {
      refIndex: 2,
      typedIndex: 2,
      expected: 'dansent',
      typed: 'danse',
      category: 'agreement',
      sub: 'verb',
      anchor: 1,
    };
    expect(caughtText(caught)).toBe('Tu avais écrit « danse », tu as corrigé en « dansent ». Bravo !');
  });

  it('never says "null" for a word she had omitted and then added back (no agreement risk)', () => {
    const caught: TokenError = {
      refIndex: 5,
      typedIndex: null,
      expected: 'chevaux',
      typed: null,
      category: 'lexical',
      sub: 'missing',
      anchor: 4,
    };
    // "de l'ajouter" is an infinitive: it never agrees, unlike "l'as ajouté(e)(s)" would.
    expect(caughtText(caught)).toBe("Tu avais oublié « chevaux » : tu as bien fait de l'ajouter en te relisant. Bravo !");
  });
});
