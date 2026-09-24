import { describe, it, expect } from 'vitest';
import { FIL_START, filDoneAction, filExit, filStart, filTap, type TypedTextLookup } from './fil';
import { gradeText } from './grading/grade';
import { mapAnnotation, reverseAnnotationMap } from './grading/annotationMap';
import { tokenize } from './grading/tokenize';
import type { Annotation, AnnotToken, Chain } from './grading/types';

// Shared fixture (spec: task-7-brief.md step 1), copied from chains.test.ts rather than
// imported — never import test files. See that file's comment for the fixture's grammar.
const BODY = 'Les fées qui chantent dansent.';

const CHAINS: Chain[] = [
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

// tokens: [Les DET, fées NOUN, qui PRON, chantent VERB, dansent VERB, . PUNCT]
function ann(): Annotation {
  const spec: [string, string[], Record<string, string>?][] = [
    ['DET', ['nominal_group']],
    ['NOUN', ['nominal_group'], { Gender: 'Fem', Number: 'Plur' }],
    ['PRON', []],
    ['VERB', ['verb'], { VerbForm: 'Fin' }],
    ['VERB', ['verb'], { VerbForm: 'Fin' }],
    ['PUNCT', []],
  ];
  const tokens: AnnotToken[] = tokenize(BODY).map((t, i) => ({
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
  return { version: 2, model: 't', tokens, sentences: [], chains: CHAINS };
}

const ANN = ann();

// This fixture never introduces a typo, so the typed word and the reference word are always
// identical — a lookup straight into the fixture's own annotation tokens is a faithful stand-in
// for the real (typed-alignment-based) lookup Proofreading.svelte builds, for these tests only.
const identityTypedTextOf: TypedTextLookup = (annotIndex) => ANN.tokens[annotIndex]?.text;

describe('filTap', () => {
  it('walks verb → subject and counts a correct thread', () => {
    let s = filStart();
    expect(s.step).toBe('pick-verb');
    s = filTap(s, 0, ANN, identityTypedTextOf); // "Les" is not a verb
    expect(s.step).toBe('pick-verb');
    expect(s.message).toMatch(/ne semble pas être un verbe/);
    s = filTap(s, 3, ANN, identityTypedTextOf); // "chantent": verb but only a medium chain
    expect(s.step).toBe('pick-verb');
    expect(s.message).toMatch(/s'emmêle/);
    s = filTap(s, 4, ANN, identityTypedTextOf); // "dansent": high chain
    expect(s.step).toBe('pick-subject');
    expect(s.highlightVerb).toBe(4);
    expect(s.message).toBe('Verbe : « dansent ». Maintenant, touche son sujet.');
    s = filTap(s, 0, ANN, identityTypedTextOf); // "Les" belongs to the subject group → correct
    expect(s.step).toBe('done');
    expect(s.correct).toBe(1);
    expect(s.drawn).toBe(1);
    expect(s.highlightSubject).toEqual([0, 1]);
    expect(s.message).toBe('Le fil est tendu : « dansent » ↔ « Les fées » (pluriel). Vérifie la terminaison du verbe.');
  });

  it('reveals the subject after two wrong taps and counts the thread as drawn but not correct', () => {
    let s = filTap(filStart(), 4, ANN, identityTypedTextOf);
    s = filTap(s, 3, ANN, identityTypedTextOf);
    expect(s.step).toBe('pick-subject');
    expect(s.attempts).toBe(1);
    expect(s.message).toMatch(/Le fil ne tient pas/);
    s = filTap(s, 5, ANN, identityTypedTextOf);
    expect(s.step).toBe('done');
    expect(s.drawn).toBe(1);
    expect(s.correct).toBe(0);
    expect(s.message).toBe('Le fil te guide : le sujet de « dansent », c\'est « Les fées » (pluriel).');
  });

  // SP2 playability P1-7: after a drawn thread the Fil stays armed — the next tap on another verb
  // starts a new thread; the threaded verb itself or a non-verb goes to the editor (the caller
  // reads `filDoneAction`) and the Fil is back to picking.
  it('starts a new thread from another verb once a thread is drawn, and re-arms for anything else', () => {
    let s = filTap(filStart(), 4, ANN, identityTypedTextOf);
    s = filTap(s, 1, ANN, identityTypedTextOf); // "fées" → done
    expect(s.step).toBe('done');
    expect(filDoneAction(s, 3, ANN)).toBe('thread'); // another verb (even a medium one: the pick decides)
    expect(filDoneAction(s, 4, ANN)).toBe('edit'); // the threaded verb: fix it
    expect(filDoneAction(s, 0, ANN)).toBe('edit'); // a non-verb
    expect(filDoneAction(s, undefined, ANN)).toBe('edit');
    const next = filTap(s, 3, ANN, identityTypedTextOf); // "chantent": a new pick, refused as medium
    expect(next.step).toBe('pick-verb');
    expect(next.message).toMatch(/s'emmêle/);
    expect(next.drawn).toBe(1);
    expect(next.correct).toBe(1);
    expect(next.highlightSubject).toEqual([]);
    const again = filTap(s, 4, ANN, identityTypedTextOf); // the threaded verb: re-armed, untouched
    expect(again.step).toBe('pick-verb');
    expect(again.message).toBe(FIL_START);
    expect(again.highlightVerb).toBeNull();
    expect(filTap(s, 0, ANN, identityTypedTextOf).step).toBe('pick-verb');
    expect(filDoneAction(filStart(), 3, ANN)).toBe('edit'); // only meaningful in the done state
  });

  it("tapping the verb again cancels; unaligned taps and exit", () => {
    let s = filTap(filStart(), 4, ANN, identityTypedTextOf);
    s = filTap(s, 4, ANN, identityTypedTextOf);
    expect(s.step).toBe('pick-verb');
    s = filTap(s, undefined, ANN, identityTypedTextOf);
    expect(s.message).toMatch(/ne s'accroche pas/);
    expect(filExit(s).step).toBe('idle');
    expect(filStart({ drawn: 2, correct: 1 })).toMatchObject({
      drawn: 2,
      correct: 1,
      step: 'pick-verb',
      message: FIL_START,
    });
  });

  // Fix round 1 (Fable review, critical): the Fil must never leak the reference spelling. Build
  // the same annotIndex<->typedIndex lookup Proofreading.svelte builds, from a real typo'd
  // alignment, and check the messages quote the typed words, never the reference ones.
  it("uses the player's typed words in its messages, never the reference spelling", () => {
    const typed = 'Les fée qui chantent danse.'; // "fées"->"fée", "dansent"->"danse"
    const g = gradeText(BODY, typed, ANN);
    const annots = mapAnnotation(g.refTokens, ANN);
    const refByAnnot = reverseAnnotationMap(annots);
    const typedByRef = new Map(
      g.pairs
        .filter((p): p is { refIndex: number; typedIndex: number } => p.refIndex !== null && p.typedIndex !== null)
        .map((p) => [p.refIndex, p.typedIndex] as const),
    );
    const typedTextOf: TypedTextLookup = (annotIndex) => {
      const refIndex = refByAnnot.get(annotIndex);
      if (refIndex === undefined) return undefined;
      const typedIndex = typedByRef.get(refIndex);
      return typedIndex === undefined ? undefined : g.typedTokens[typedIndex]?.text;
    };

    let s = filTap(filStart(), 4, ANN, typedTextOf); // "dansent" -> typed "danse"
    expect(s.step).toBe('pick-subject');
    expect(s.message).toBe('Verbe : « danse ». Maintenant, touche son sujet.');
    s = filTap(s, 0, ANN, typedTextOf); // "Les" (unchanged) belongs to the subject group
    expect(s.step).toBe('done');
    expect(s.message).toBe(
      'Le fil est tendu : « danse » ↔ « Les fée » (pluriel). Vérifie la terminaison du verbe.',
    );
    expect(s.message).not.toMatch(/dansent/);
    expect(s.message).not.toMatch(/fées/);
  });
});
