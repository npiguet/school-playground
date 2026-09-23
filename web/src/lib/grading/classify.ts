import type { AnnotToken, ErrorSub, Token, TokenError } from './types';
import { homophoneSetOf } from './homophones';
import { stripDiacritics } from './normalize';

const GENDER_PAIRS: [string, string][] = [
  ['le', 'la'],
  ['un', 'une'],
  ['ce', 'cette'],
  ['cet', 'cette'],
  ['mon', 'ma'],
  ['ton', 'ta'],
  ['son', 'sa'],
  ['ceux', 'celles'],
  ['celui', 'celle'],
  ['tout', 'toute'],
  ['tous', 'toutes'],
  ['nouveau', 'nouvelle'],
  ['beau', 'belle'],
  ['vieux', 'vieille'],
];

function isGenderPair(a: string, b: string): boolean {
  return GENDER_PAIRS.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

const ENDINGS = [
  '',
  's',
  'x',
  'e',
  'es',
  'nt',
  'ent',
  'é',
  'ée',
  'és',
  'ées',
  'ai',
  'ais',
  'ait',
  'aient',
  'a',
  'as',
  'ons',
  'ez',
  'er',
];

/** Returns the common stem when r ends with `a`, t ends with `b`, and the remainders are equal; else null. */
function stemIf(r: string, t: string, a: string, b: string): string | null {
  if (!r.endsWith(a) || !t.endsWith(b)) return null;
  const rs = r.slice(0, r.length - a.length);
  const ts = t.slice(0, t.length - b.length);
  return rs === ts ? rs : null;
}

export function isAgreement(r: string, t: string): boolean {
  for (const a of ENDINGS) {
    for (const b of ENDINGS) {
      if (a === b) continue;
      const stem = stemIf(r, t, a, b);
      if (stem !== null && stem.length >= 1) return true;
    }
  }
  return false;
}

// Endings that unambiguously signal a verb form: infinitive -er, imperative/2nd-plural -ez, and
// the imparfait -ai/-ais/-ait/-aient. The participle/adjective -é family (é, ée, és, ées) is
// deliberately NOT in this set: spaCy frequently tags adjectival participles as ADJ rather than
// VERB ("les portes fermées", "fatiguée"), and gender/number variation within that family (e.g.
// "fermées" -> "fermé") is a genuine agreement error regardless of POS. Ruling (fix round 2):
// only gate a pair when it involves one of THESE endings (including é-family vs one of these —
// the infinitive/participle/imperfect confusion, e.g. "mangé"/"manger") behind the reference
// token's annotation POS being VERB/AUX, or there being no annotation at all (too ambiguous to
// tell). Otherwise known non-verbs (papier, premier, chez, assez, jamais) would be misclassified
// as verb-form confusions when misspelled with a verb-like ending.
const VERB_ONLY_ENDINGS = new Set(['er', 'ez', 'ai', 'ais', 'ait', 'aient']);

function allowsVerbSpecificEndings(annot: AnnotToken | undefined): boolean {
  return annot === undefined || annot.pos === 'VERB' || annot.pos === 'AUX';
}

/** Like isAgreement, but ignores ending pairs that involve a verb-only ending unless `annot` says VERB/AUX. */
function agreementEndingMatch(r: string, t: string, annot: AnnotToken | undefined): boolean {
  const verbAllowed = allowsVerbSpecificEndings(annot);
  for (const a of ENDINGS) {
    for (const b of ENDINGS) {
      if (a === b) continue;
      if (!verbAllowed && (VERB_ONLY_ENDINGS.has(a) || VERB_ONLY_ENDINGS.has(b))) continue;
      const stem = stemIf(r, t, a, b);
      if (stem !== null && stem.length >= 1) return true;
    }
  }
  return false;
}

const INF = ['er'];
const IMP = ['ez'];
const PP = ['é', 'ée', 'és', 'ées'];
const PAST = ['ai', 'ais', 'ait', 'aient'];
const VERB_ENDING_CLASSES: [string, string[]][] = [
  ['INF', INF],
  ['IMP', IMP],
  ['PP', PP],
  ['PAST', PAST],
];

export function isVerbEndingHomophone(r: string, t: string): boolean {
  for (const [classR, endingsR] of VERB_ENDING_CLASSES) {
    for (const a of endingsR) {
      for (const [classT, endingsT] of VERB_ENDING_CLASSES) {
        if (classT === classR) continue;
        for (const b of endingsT) {
          const stem = stemIf(r, t, a, b);
          if (stem !== null && stem.length >= 2) return true;
        }
      }
    }
  }
  return false;
}

export function agreementSub(r: string, t: string, annot: AnnotToken | undefined): ErrorSub | undefined {
  if (!annot) return undefined;
  if (annot.pos === 'VERB' || annot.pos === 'AUX') {
    return annot.morph.VerbForm === 'Part' ? 'participle' : 'verb';
  }
  if (annot.pos === 'DET' || annot.pos === 'NOUN' || annot.pos === 'ADJ' || annot.pos === 'PRON') {
    const strip = (w: string) => (w.endsWith('s') || w.endsWith('x') ? w.slice(0, -1) : w);
    return strip(r) === strip(t) ? 'number' : 'gender';
  }
  return undefined;
}

export function classifyPair(
  ref: Token | null,
  typed: Token | null,
  annot: AnnotToken | undefined,
  anchor: number,
): TokenError | null {
  // Unpaired tokens: missing (ref only) or extra (typed only).
  if (ref !== null && typed === null) {
    if (ref.kind === 'punct') {
      return {
        refIndex: null,
        typedIndex: null,
        expected: ref.text,
        typed: null,
        category: 'punctuation_case',
        anchor,
      };
    }
    return {
      refIndex: null,
      typedIndex: null,
      expected: ref.text,
      typed: null,
      category: 'lexical',
      sub: 'missing',
      anchor,
    };
  }
  if (ref === null && typed !== null) {
    if (typed.kind === 'punct') {
      return {
        refIndex: null,
        typedIndex: null,
        expected: null,
        typed: typed.text,
        category: 'punctuation_case',
        anchor,
      };
    }
    return {
      refIndex: null,
      typedIndex: null,
      expected: null,
      typed: typed.text,
      category: 'lexical',
      sub: 'extra',
      anchor,
    };
  }
  if (ref === null || typed === null) return null; // both null: nothing to classify

  // Word <-> punct pair should not occur from alignment, but is defensively lexical.
  if (ref.kind !== typed.kind) {
    return {
      refIndex: null,
      typedIndex: null,
      expected: ref.text,
      typed: typed.text,
      category: 'lexical',
      anchor,
    };
  }

  if (ref.kind === 'punct') {
    if (ref.norm === typed.norm) return null;
    return {
      refIndex: null,
      typedIndex: null,
      expected: ref.text,
      typed: typed.text,
      category: 'punctuation_case',
      anchor,
    };
  }

  const r = ref.norm;
  const t = typed.norm;

  // Rule 0: identical and case.
  if (r === t) {
    if (ref.caseNorm === typed.caseNorm) return null;
    return {
      refIndex: null,
      typedIndex: null,
      expected: ref.text,
      typed: typed.text,
      category: 'punctuation_case',
      anchor,
    };
  }

  // Rule 1: homophones.
  const setR = homophoneSetOf(r);
  if (setR !== undefined && setR === homophoneSetOf(t)) {
    return {
      refIndex: null,
      typedIndex: null,
      expected: ref.text,
      typed: typed.text,
      category: 'homophone',
      homophoneSet: setR,
      anchor,
    };
  }
  if (allowsVerbSpecificEndings(annot) && isVerbEndingHomophone(r, t)) {
    return {
      refIndex: null,
      typedIndex: null,
      expected: ref.text,
      typed: typed.text,
      category: 'homophone',
      sub: 'verb_ending',
      anchor,
    };
  }

  // Rule 2: agreement.
  if (isGenderPair(r, t)) {
    return {
      refIndex: null,
      typedIndex: null,
      expected: ref.text,
      typed: typed.text,
      category: 'agreement',
      sub: 'gender',
      anchor,
    };
  }
  if (agreementEndingMatch(r, t, annot)) {
    return {
      refIndex: null,
      typedIndex: null,
      expected: ref.text,
      typed: typed.text,
      category: 'agreement',
      sub: agreementSub(r, t, annot),
      anchor,
    };
  }

  // Rule 3: accent.
  if (stripDiacritics(r) === stripDiacritics(t)) {
    return {
      refIndex: null,
      typedIndex: null,
      expected: ref.text,
      typed: typed.text,
      category: 'accent',
      anchor,
    };
  }

  // Rule 5: lexical (rule 4, punctuation_case, is handled above for word==word and punct pairs).
  return {
    refIndex: null,
    typedIndex: null,
    expected: ref.text,
    typed: typed.text,
    category: 'lexical',
    anchor,
  };
}
