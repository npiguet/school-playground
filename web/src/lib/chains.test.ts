import { describe, it, expect } from 'vitest';
import { chainsOf, explainChain, groupText, featureWords, numberWord } from './chains';
import { tokenize } from './grading/tokenize';
import type { Annotation, AnnotToken, Chain } from './grading/types';

// Shared fixture (spec: task-7-brief.md step 1) — "Les fées qui chantent dansent.": a relative
// clause subject ("qui" refers back to "Les fées") agreeing with "chantent" (a medium-confidence
// chain: coordination-free but through a relative pronoun), and a plain subject-verb chain for
// "dansent" (high confidence). Copied (not imported) into fil.test.ts too, per the brief.
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

describe('chainsOf', () => {
  it('returns every chain where the token is a target or in a controller_group', () => {
    expect(chainsOf(ann(), 1).map((c) => c.id)).toEqual([0, 1, 2]);
  });

  it('returns nothing for a null annotation', () => {
    expect(chainsOf(null, 1)).toEqual([]);
  });
});

describe('explainChain', () => {
  it('finds the medium-confidence chain for the relative-clause verb', () => {
    expect(explainChain(ann(), 3)?.id).toBe(1);
    expect(explainChain(ann(), 3, 'high')).toBeUndefined();
  });

  it('finds the high-confidence chain for the plain subject-verb pair', () => {
    expect(explainChain(ann(), 4)?.id).toBe(2);
  });

  it('finds a nominal chain when the token is itself a target', () => {
    expect(explainChain(ann(), 0)?.id).toBe(0);
  });
});

describe('groupText', () => {
  it('reads the controller group straight from the body', () => {
    expect(groupText(ann(), CHAINS[2], BODY)).toBe('Les fées');
  });
});

describe('featureWords / numberWord / genderWord', () => {
  it('combines gender and number, gender first', () => {
    expect(featureWords({ Gender: 'Fem', Number: 'Plur' })).toBe('féminin pluriel');
  });

  it('returns null when a feature is unknown', () => {
    expect(numberWord({})).toBeNull();
  });
});
