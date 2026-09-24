import { describe, it, expect } from 'vitest';
import { gradeText, tokenize, mapAnnotation } from '$lib/grading';
import { caughtText, explain, erisLine, statKeyOf, CATEGORY_LABELS } from './explain';
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
    // Below 9H the fallback drops the avoir/COD clause too (final review ledger: the avoir rule
    // isn't taught yet); without a level (SP1 callers) the full sentence stays.
    expect(explain(g.errors[0], { ...ctxMangees, level: '8H' }).text).toBe(
      'Participe passé « mangées » : avec être, il s\'accorde avec le sujet.',
    );
    expect(explain(g.errors[0], { ...ctxMangees, level: '9H' }).text).toBe(
      'Avec « avoir », le participe « mangées » s\'accorde avec le complément « les » placé avant → pluriel',
    );
    expect(explain(g.errors[0], ctxMangees).text).toBe(
      'Participe passé « mangées » : avec être, il s\'accorde avec le sujet ; ' +
        'avec avoir, seulement si le complément est placé avant.',
    );
  });

  // Fix round 1 item 2: an empty featureWords (no Gender/Number known on the chain at all) must
  // not produce a dangling "→ " — fall back to the SP1 generic template instead.
  it('falls back to the generic template when the chain has no known features', () => {
    const REF5 = 'Elles sont parties.';
    const chainsNoFeatures: Chain[] = [
      {
        id: 0,
        kind: 'participle_etre',
        controller: 0,
        controller_group: [0],
        targets: [2],
        via: 'aux',
        via_token: 1,
        features: {},
        confidence: 'high',
        distance: 1,
        rule: null,
      },
    ];
    const spec: [string, string[], Record<string, string>?][] = [
      ['PRON', []],
      ['AUX', [], { VerbForm: 'Fin' }],
      ['VERB', ['verb'], { VerbForm: 'Part' }],
      ['PUNCT', []],
    ];
    const annotation: Annotation = {
      version: 2,
      model: 't',
      tokens: tokenize(REF5).map((t, i) => ({
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
      chains: chainsNoFeatures,
    };
    const g = gradeText(REF5, 'Elles sont partie.', annotation);
    const ctx = { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, annotation), annotation, body: REF5 };
    expect(explain(g.errors[0], ctx).text).toBe(
      'Participe passé « parties » : avec être, il s\'accorde avec le sujet ; ' +
        'avec avoir, seulement si le complément est placé avant.',
    );
    expect(explain(g.errors[0], ctx).text).not.toMatch(/→\s*$/);
  });

  // Fix round 1 item 3: without `ctx.body`, chain templates must not reconstruct the text from
  // `refTokens.join(' ')` — they must be skipped entirely, falling back to the SP1 template.
  it('falls back to the generic template when ctx.body is not supplied, even with a usable chain', () => {
    const { g, ctx } = ctxFor2('Les fées qui chantent danse.');
    const ctxNoBody = { ...ctx, body: undefined };
    expect(explain(g.errors[0], ctxNoBody).text).toBe(
      'Le verbe « dansent » s\'accorde avec son sujet. Cherche qui fait l\'action.',
    );
  });

  // Minor fix round 1 item: attribute/participle_etre via a relative pronoun use the same
  // "« qui », qui reprend « NP »" phrasing as subject_verb, instead of naming "qui" as if it were
  // the subject's own text.
  it('uses the "qui reprend" phrasing for a participle_etre chain through a relative pronoun', () => {
    const REF6 = 'Les fées qui sont parties dansent.';
    const chainsQui: Chain[] = [
      {
        id: 0,
        kind: 'participle_etre',
        controller: 1,
        controller_group: [0, 1],
        targets: [4],
        via: 'qui',
        via_token: 2,
        features: { Gender: 'Fem', Number: 'Plur' },
        confidence: 'high',
        distance: 2,
        rule: null,
      },
    ];
    const spec: [string, string[], Record<string, string>?][] = [
      ['DET', ['nominal_group']],
      ['NOUN', ['nominal_group'], { Gender: 'Fem', Number: 'Plur' }],
      ['PRON', []],
      ['AUX', [], { VerbForm: 'Fin' }],
      ['VERB', ['verb'], { VerbForm: 'Part' }],
      ['VERB', ['verb'], { VerbForm: 'Fin' }],
      ['PUNCT', []],
    ];
    const annotation: Annotation = {
      version: 2,
      model: 't',
      tokens: tokenize(REF6).map((t, i) => ({
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
      })),
      sentences: [],
      chains: chainsQui,
    };
    const g = gradeText(REF6, 'Les fées qui sont partie dansent.', annotation);
    const ctx = { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, annotation), annotation, body: REF6 };
    expect(explain(g.errors[0], ctx).text).toBe(
      'Avec « être », le participe « parties » s\'accorde avec le sujet « qui », qui reprend « Les fées » → féminin pluriel',
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

// P1-1 regression: `annot.subject`/`annot.head` are spaCy (annotation-space) token indexes, not
// client (reference) token indexes. An elision earlier in the sentence ("D'abord" -> spaCy splits
// "D'" + "abord", the client keeps "D'abord" as one token) shifts every later spaCy index by one
// relative to the client's, exactly like "n'intriguait"/"d'Athéna"/"l'avait" did in the reviewed
// build (playability.md P1-1: "« taisaient » s'accorde avec son sujet « taisaient »").
describe('explain (P1-1 elided-text regression)', () => {
  it('names the real subject, not the verb itself, when an earlier elision shifts spaCy indexes', () => {
    // "D'abord, les enfants chantent." — client tokens: 0 D'abord, 1 ',', 2 les, 3 enfants,
    // 4 chantent, 5 '.'. spaCy tokens: 0 D', 1 abord, 2 ',', 3 les, 4 enfants, 5 chantent, 6 '.'.
    // annot.subject on "chantent" is 4 (spaCy id of "enfants") — the *client* index 4 is
    // "chantent" itself, so the old bug named the verb as its own subject.
    const REF = "D'abord, les enfants chantent.";
    const spacyTokens: AnnotToken[] = [
      { i: 0, text: "D'", start: 0, end: 2, lemma: "d'", pos: 'DET', morph: {}, head: 1, dep: 'det', categories: [], homophone: null, subject: null },
      { i: 1, text: 'abord', start: 2, end: 7, lemma: 'abord', pos: 'ADV', morph: {}, head: 5, dep: 'advmod', categories: [], homophone: null, subject: null },
      { i: 2, text: ',', start: 7, end: 8, lemma: ',', pos: 'PUNCT', morph: {}, head: 5, dep: 'punct', categories: [], homophone: null, subject: null },
      { i: 3, text: 'les', start: 9, end: 12, lemma: 'le', pos: 'DET', morph: {}, head: 4, dep: 'det', categories: ['nominal_group'], homophone: null, subject: null },
      { i: 4, text: 'enfants', start: 13, end: 20, lemma: 'enfant', pos: 'NOUN', morph: { Gender: 'Masc', Number: 'Plur' }, head: 5, dep: 'nsubj', categories: ['nominal_group'], homophone: null, subject: null },
      { i: 5, text: 'chantent', start: 21, end: 29, lemma: 'chanter', pos: 'VERB', morph: { VerbForm: 'Fin', Number: 'Plur', Person: '3' }, head: 5, dep: 'root', categories: ['verb'], homophone: null, subject: 4 },
      { i: 6, text: '.', start: 29, end: 30, lemma: '.', pos: 'PUNCT', morph: {}, head: 5, dep: 'punct', categories: [], homophone: null, subject: null },
    ];
    const annotation: Annotation = { version: 1, model: 't', tokens: spacyTokens, sentences: [] };
    expect(REF.length).toBe(30); // sanity: fixture offsets above match the literal string
    const g = gradeText(REF, "D'abord, les enfants chante.", annotation);
    const ctx = { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, annotation), annotation };
    const err = g.errors.find((e) => e.category === 'agreement' && e.sub === 'verb');
    expect(err).toBeDefined();
    expect(explain(err!, ctx).text).toBe(
      '« chantent » s\'accorde avec son sujet « enfants » → pluriel → terminaison « nt »',
    );
  });

  it('names the real head noun, not the adjective itself, when an earlier elision shifts spaCy indexes', () => {
    // "D'abord, les ruelles étroites." — client ref index 4 is "étroites" itself; annot.head on
    // "étroites" is spaCy id 4 ("ruelles"), which the old bug looked up as client index 4.
    const REF = "D'abord, les ruelles étroites.";
    const spacyTokens: AnnotToken[] = [
      { i: 0, text: "D'", start: 0, end: 2, lemma: "d'", pos: 'DET', morph: {}, head: 1, dep: 'det', categories: [], homophone: null, subject: null },
      { i: 1, text: 'abord', start: 2, end: 7, lemma: 'abord', pos: 'ADV', morph: {}, head: 5, dep: 'advmod', categories: [], homophone: null, subject: null },
      { i: 2, text: ',', start: 7, end: 8, lemma: ',', pos: 'PUNCT', morph: {}, head: 5, dep: 'punct', categories: [], homophone: null, subject: null },
      { i: 3, text: 'les', start: 9, end: 12, lemma: 'le', pos: 'DET', morph: {}, head: 4, dep: 'det', categories: ['nominal_group'], homophone: null, subject: null },
      { i: 4, text: 'ruelles', start: 13, end: 20, lemma: 'ruelle', pos: 'NOUN', morph: { Gender: 'Fem', Number: 'Plur' }, head: 4, dep: 'root', categories: ['nominal_group'], homophone: null, subject: null },
      { i: 5, text: 'étroites', start: 21, end: 29, lemma: 'étroit', pos: 'ADJ', morph: { Gender: 'Fem', Number: 'Plur' }, head: 4, dep: 'amod', categories: ['nominal_group'], homophone: null, subject: null },
      { i: 6, text: '.', start: 29, end: 30, lemma: '.', pos: 'PUNCT', morph: {}, head: 4, dep: 'punct', categories: [], homophone: null, subject: null },
    ];
    const annotation: Annotation = { version: 1, model: 't', tokens: spacyTokens, sentences: [] };
    expect(REF.length).toBe(30);
    const g = gradeText(REF, "D'abord, les ruelles étroite.", annotation);
    const ctx = { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, annotation), annotation };
    const err = g.errors.find((e) => e.category === 'agreement' && e.sub === 'number');
    expect(err).toBeDefined();
    expect(explain(err!, ctx).text).toBe('« étroites » s\'accorde avec « ruelles » → pluriel');
  });
});

// P1-2 regression: an adjectival participle ("les toits endormis", dep amod — no être/avoir
// involved) must explain like a noun-group agreement, not the Protée être/avoir template.
describe('explain (P1-2 adjectival participle)', () => {
  const REF = 'Les toits endormis.';
  function ann3(): Annotation {
    const spec: [string, string, Record<string, string>?, Partial<AnnotToken>?][] = [
      ['DET', 'les', {}, { head: 1 }],
      ['NOUN', 'toit', { Number: 'Plur' }, { head: 1 }],
      ['VERB', 'endormir', { VerbForm: 'Part', Number: 'Plur' }, { head: 1, dep: 'amod', categories: ['participle', 'nominal_group'] }],
      ['PUNCT', '.', {}, {}],
    ];
    const tokens: AnnotToken[] = tokenize(REF).map((t, i) => ({
      i,
      text: t.text,
      start: t.start,
      end: t.end,
      lemma: spec[i][1],
      pos: spec[i][0],
      morph: spec[i][2] ?? {},
      head: i,
      dep: 'dep',
      categories: [],
      homophone: null,
      subject: null,
      ...(spec[i][3] ?? {}),
    }));
    return { version: 2, model: 't', tokens, sentences: [] };
  }
  it('explains it as noun-group number agreement, naming the noun, not the être/avoir rule', () => {
    const g = gradeText(REF, 'Les toits endormi.', ann3());
    const ctx = { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, ann3()), annotation: ann3() };
    const err = g.errors.find((e) => e.category === 'agreement');
    expect(err).toBeDefined();
    expect(err!.sub).toBe('number');
    expect(statKeyOf(err!)).toBe('agreement:number');
    const { title, text } = explain(err!, ctx);
    expect(title).toBe(CATEGORY_LABELS['agreement:number']);
    expect(text).toBe('« endormis » s\'accorde avec « toits » → pluriel');
    expect(text).not.toMatch(/avec être|avec avoir/);
  });
});

// SP2 playability P1-2: « « coupaient » a plusieurs sujets : « soir et cuisinier et fille » » named
// a time adverbial as a subject. A coordinated subject is quoted as written when the server gave
// its contiguous span; otherwise the generic sentence — never the mis-parsed `annot.subject`.
describe('explain (SP2 playability P1-2 coordinated subjects)', () => {
  const REF = "Le soir, le cuisinier et sa fille coupaient l'oignon.";
  // client/spaCy tokens agree here (no elision before the verb): 0 Le, 1 soir, 2 ',', 3 le,
  // 4 cuisinier, 5 et, 6 sa, 7 fille, 8 coupaient, 9 l'oignon (client) / l' + oignon (spaCy), '.'
  function annotation(group: number[], controller: number): Annotation {
    const spec: [string, string, Record<string, string>?][] = [
      ['DET', 'det'], ['NOUN', 'obl:mod', { Number: 'Sing' }], ['PUNCT', 'punct'], ['DET', 'det'],
      ['NOUN', 'nsubj', { Gender: 'Masc', Number: 'Sing' }], ['CCONJ', 'cc'], ['DET', 'det'],
      ['NOUN', 'conj', { Gender: 'Fem', Number: 'Sing' }], ['VERB', 'ROOT', { VerbForm: 'Fin', Number: 'Plur', Person: '3' }],
    ];
    const tokens: AnnotToken[] = tokenize(REF).slice(0, 9).map((t, i) => ({
      i, text: t.text, start: t.start, end: t.end, lemma: t.norm, pos: spec[i][0], morph: spec[i][2] ?? {},
      head: 8, dep: spec[i][1], categories: spec[i][0] === 'VERB' ? ['verb'] : [], homophone: null,
      subject: i === 8 ? controller : null,
    }));
    const chain: Chain = { id: 0, kind: 'subject_verb', controller, controller_group: group, targets: [8], via: 'conj',
      via_token: null, features: { Number: 'Plur', Person: '3' }, confidence: 'medium', distance: 1, rule: null };
    return { version: 3, model: 't', tokens, sentences: [], chains: [chain] };
  }
  function ctxFor(a: Annotation) {
    const g = gradeText(REF, "Le soir, le cuisinier et sa fille coupait l'oignon.", a);
    const err = g.errors.find((e) => e.category === 'agreement');
    expect(err).toBeDefined();
    return { err: err!, ctx: { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, a), annotation: a, body: REF } };
  }

  it('quotes the coordinated subject as written, determiners included', () => {
    const { err, ctx } = ctxFor(annotation([3, 4, 5, 6, 7], 4));
    expect(explain(err, ctx).text).toBe(
      '« coupaient » a plusieurs sujets : « le cuisinier et sa fille » → pluriel → terminaison « ent »',
    );
  });

  it('falls back to the generic verb sentence when the group is not quotable, never naming the mis-parsed subject', () => {
    const { err, ctx } = ctxFor(annotation([1, 4, 7], 1)); // « soir » attached as the subject
    const text = explain(err, ctx).text;
    expect(text).toBe('Le verbe « coupaient » s\'accorde avec son sujet. Cherche qui fait l\'action.');
    expect(text).not.toMatch(/soir/);
  });
});

// SP2 playability P1-3: « Athéna l'avait choisie » — the participle with avoir and a clitic COD
// was explained as « s'accorde avec le nom qu'il accompagne » (the small model tags it ADJ).
describe('explain (SP2 playability P1-3 participle with avoir and a clitic COD)', () => {
  const REF = "Athéna l'avait choisie pour compagne.";
  // client tokens: 0 Athéna, 1 l'avait, 2 choisie, 3 pour, 4 compagne, 5 '.'
  // spaCy tokens: 0 Athéna, 1 l', 2 avait, 3 choisie, 4 pour, 5 compagne, 6 '.'
  function annotation(withChain: boolean, categories: string[]): Annotation {
    const tokens: AnnotToken[] = [
      { i: 0, text: 'Athéna', start: 0, end: 6, lemma: 'Athéna', pos: 'PROPN', morph: {}, head: 3, dep: 'nsubj', categories: [], homophone: null, subject: null },
      { i: 1, text: "l'", start: 7, end: 9, lemma: 'le', pos: 'PRON', morph: { Number: 'Sing', Person: '3' }, head: 3, dep: 'obj', categories: [], homophone: null, subject: null },
      { i: 2, text: 'avait', start: 9, end: 14, lemma: 'avoir', pos: 'AUX', morph: { VerbForm: 'Fin', Number: 'Sing' }, head: 3, dep: 'aux:tense', categories: ['verb'], homophone: null, subject: 0 },
      { i: 3, text: 'choisie', start: 15, end: 22, lemma: 'choisir', pos: 'ADJ', morph: { Gender: 'Masc', Number: 'Sing' }, head: 3, dep: 'ROOT', categories, homophone: null, subject: 0 },
      { i: 4, text: 'pour', start: 23, end: 27, lemma: 'pour', pos: 'ADP', morph: {}, head: 5, dep: 'case', categories: [], homophone: null, subject: null },
      { i: 5, text: 'compagne', start: 28, end: 36, lemma: 'compagne', pos: 'NOUN', morph: { Gender: 'Fem', Number: 'Sing' }, head: 3, dep: 'obl:mod', categories: ['nominal_group'], homophone: null, subject: null },
      { i: 6, text: '.', start: 36, end: 37, lemma: '.', pos: 'PUNCT', morph: {}, head: 3, dep: 'punct', categories: [], homophone: null, subject: null },
    ];
    const chains: Chain[] = withChain
      ? [{ id: 0, kind: 'participle_avoir', controller: 1, controller_group: [1], targets: [3], via: null, via_token: null,
          features: { Number: 'Sing', Person: '3' }, confidence: 'medium', distance: 2, rule: 'cod_before' }]
      : [];
    return { version: 3, model: 't', tokens, sentences: [], chains };
  }
  function ctxFor(a: Annotation, level?: string) {
    expect(REF.length).toBe(37);
    const g = gradeText(REF, "Athéna l'avait choisi pour compagne.", a);
    const err = g.errors.find((e) => e.category === 'agreement');
    expect(err).toBeDefined();
    return { err: err!, ctx: { refTokens: g.refTokens, annots: mapAnnotation(g.refTokens, a), annotation: a, body: REF, level } };
  }

  it('is graded as a participle (Protée) and explained with the avoir/COD chain from 9H', () => {
    const { err, ctx } = ctxFor(annotation(true, ['participle']), '10H');
    expect(err.sub).toBe('participle');
    expect(explain(err, ctx).title).toBe(CATEGORY_LABELS['agreement:participle']);
    // the clitic carries no gender in the parse and the slip is the gender: no false « → singulier »
    expect(explain(err, ctx).text).toBe(
      'Avec « avoir », le participe « choisie » s\'accorde avec le complément « l\' » placé avant. Regarde ce que « l\' » remplace.',
    );
  });

  it('uses the generic participle sentence, level-gated, when there is no participle_avoir chain', () => {
    const { err, ctx } = ctxFor(annotation(false, ['participle']), '10H');
    expect(explain(err, ctx).text).toBe(
      'Participe passé « choisie » : avec être, il s\'accorde avec le sujet ; avec avoir, seulement si le complément est placé avant.',
    );
    expect(explain(err, { ...ctx, level: '8H' }).text).toBe('Participe passé « choisie » : avec être, il s\'accorde avec le sujet.');
  });

  it('never uses the noun-group sentence even on an older annotation that filed it under gender', () => {
    const { err, ctx } = ctxFor(annotation(false, ['nominal_group']), '10H'); // v2 categories: ADJ → nominal_group
    expect(err.sub).toBe('gender');
    const text = explain(err, ctx).text;
    expect(text).not.toMatch(/accompagne/);
    expect(text).toMatch(/^Participe passé « choisie »/);
  });
});

describe('erisLine', () => {
  it('never blames the player', () => {
    expect(erisLine(null, 0, 0)).toMatch(/reviendrai/);
    expect(erisLine(1, 4, 0)).toMatch(/Impossible/);
    expect(erisLine(0.5, 4, 1)).toMatch(/Sournois/);
    expect(erisLine(0, 4, 0)).toMatch(/bien cachés/);
  });

  it('leaves the dictation strings unchanged when mode is omitted or "dictation"', () => {
    expect(erisLine(null, 0, 0, 'dictation')).toBe(erisLine(null, 0, 0));
    expect(erisLine(1, 4, 0, 'dictation')).toBe(erisLine(1, 4, 0));
  });

  it('uses grimoire-flavoured wording, keyed on the catch rate, never mentioning a dictation', () => {
    expect(erisLine(1, 5, 0, 'grimoire')).toBe(
      'Quoi ?! Tu as trouvé tous mes dés-accords dans ce grimoire. Je le corromprai mieux la prochaine fois.',
    );
    expect(erisLine(0.5, 4, 0, 'grimoire')).toBe(
      'Hmpf. La moitié de mes dés-accords retrouvés. Le grimoire garde encore quelques secrets…',
    );
    expect(erisLine(0, 4, 0, 'grimoire')).toBe(
      'Mes dés-accords sont restés bien cachés dans ce grimoire. Cette fois.',
    );
    expect(erisLine(0.3, 4, 0, 'grimoire')).toBe(
      'Ha ! Quelques dés-accords retrouvés. Le grimoire commence à se réparer.',
    );
  });

  it('still mentions plants Éris slipped in during a grimoire proofreading', () => {
    expect(erisLine(0.9, 10, 2, 'grimoire')).toMatch(
      / \(Et j'en ai glissé 2 pendant ta relecture\. Sournois, je sais\.\)$/,
    );
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
