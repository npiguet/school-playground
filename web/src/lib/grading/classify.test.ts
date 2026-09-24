import { describe, it, expect, vi } from 'vitest';
import { tokenize } from './tokenize';
import { classifyPair, isAgreement, isVerbEndingHomophone, agreementSub } from './classify';
import type { AnnotToken } from './types';

// content/homophones.json is a placeholder maintained by another task in a parallel lane
// (see the task brief's dependency note); these tests supply their own fixture so
// classification is deterministic regardless of that file's real content. vi.mock calls
// are hoisted above the imports above by vitest, so this still takes effect for them.
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

const tok = (s: string) => tokenize(s)[0];
const annot = (pos: string, morph: Record<string, string> = {}): AnnotToken =>
  ({ i: 0, text: '', start: 0, end: 0, lemma: '', pos, morph, head: 0, dep: '', categories: [], homophone: null, subject: null });
const cls = (ref: string, typed: string, a?: AnnotToken) => classifyPair(tok(ref), tok(typed), a, -1);

describe('rule 0: identical and case', () => {
  it('returns null for a correct word', () => expect(cls('chat', 'chat')).toBeNull());
  it('ignores ligature and apostrophe variants', () => {
    expect(cls('cœur', 'coeur')).toBeNull();
    expect(cls('c’est', "c'est")).toBeNull();
  });
  it('flags a case-only difference as punctuation_case', () => {
    expect(cls('Marie', 'marie')).toMatchObject({ category: 'punctuation_case', expected: 'Marie', typed: 'marie' });
  });
  // Ruling: typographic punctuation variants are not graded (spec §3.5).
  it('does not grade an em dash typed as a plain hyphen', () => {
    expect(cls('—', '-')).toBeNull();
  });
});

describe('rule 1: homophones come first', () => {
  it.each([['à', 'a'], ['a', 'à'], ['est', 'et'], ["c'est", 'ses'], ['sont', 'son'], ['où', 'ou'], ["l'a", 'la'], ['peut', 'peu'], ["qu'elle", 'quelle']])(
    '%s vs %s', (r, t) => expect(cls(r, t)).toMatchObject({ category: 'homophone', homophoneSet: expect.any(String) }));
  it('wins over the accent rule (a/à)', () => expect(cls('à', 'a')?.category).toBe('homophone'));
  it('wins over the agreement rule (son/sont, leur/leurs)', () => {
    expect(cls('sont', 'son')?.category).toBe('homophone');
    expect(cls('leurs', 'leur')?.category).toBe('homophone');
  });
  it('detects -é / -er / -ez / -ait confusions as verb_ending homophones', () => {
    expect(cls('mangé', 'manger')).toMatchObject({ category: 'homophone', sub: 'verb_ending' });
    expect(cls('manger', 'mangez')).toMatchObject({ category: 'homophone', sub: 'verb_ending' });
    expect(cls('chantait', 'chanté')).toMatchObject({ category: 'homophone', sub: 'verb_ending' });
    expect(isVerbEndingHomophone('mangés', 'mangé')).toBe(false); // same class -> agreement
    expect(isVerbEndingHomophone('mer', 'mé')).toBe(false);       // prefix too short
  });
});

describe('rule 2: agreement', () => {
  it('same stem, inflectional ending differs', () => {
    expect(isAgreement('dansent', 'danse')).toBe(true);
    expect(isAgreement('chats', 'chat')).toBe(true);
    expect(isAgreement('jolie', 'joli')).toBe(true);
    expect(isAgreement('mangées', 'mangé')).toBe(true);
    expect(isAgreement('a', 'as')).toBe(true);
    expect(isAgreement('beaux', 'beau')).toBe(true);
    expect(isAgreement('chevaux', 'chevals')).toBe(false); // irregular plural -> lexical (known limitation)
    expect(isAgreement('maison', 'mison')).toBe(false);
    expect(isAgreement('chat', 'chaton')).toBe(false);
  });
  it('subclassifies with the annotation', () => {
    expect(cls('dansent', 'danse', annot('VERB', { VerbForm: 'Fin' }))).toMatchObject({ category: 'agreement', sub: 'verb' });
    expect(cls('chantais', 'chantait', annot('VERB', { VerbForm: 'Fin' }))).toMatchObject({ category: 'agreement', sub: 'verb' });
    expect(cls('mangées', 'mangé', annot('VERB', { VerbForm: 'Part' }))).toMatchObject({ category: 'agreement', sub: 'participle' });
    expect(cls('chats', 'chat', annot('NOUN'))).toMatchObject({ category: 'agreement', sub: 'number' });
    expect(cls('jolies', 'jolis', annot('ADJ'))).toMatchObject({ category: 'agreement', sub: 'gender' });
    expect(cls('jolie', 'joli', annot('ADJ'))).toMatchObject({ category: 'agreement', sub: 'gender' });
    expect(cls('les', 'le', annot('DET'))).toMatchObject({ category: 'agreement', sub: 'number' });
    expect(cls('dansent', 'danse')).toMatchObject({ category: 'agreement' });
    expect(cls('dansent', 'danse')?.sub).toBeUndefined();
  });
  it('knows irregular gender pairs', () => {
    expect(cls('la', 'le', annot('DET'))).toMatchObject({ category: 'agreement', sub: 'gender' });
    expect(cls('belle', 'beau')).toMatchObject({ category: 'agreement', sub: 'gender' });
  });
});

describe('ruling: verb-only endings require a VERB/AUX annotation (or none)', () => {
  it('falls through to lexical for known non-verbs misspelled with a verb-like ending', () => {
    expect(cls('papier', 'papié', annot('NOUN'))).toMatchObject({ category: 'lexical' });
    expect(cls('premier', 'premié', annot('NOUN'))).toMatchObject({ category: 'lexical' });
    expect(cls('chez', 'ché', annot('ADP'))).toMatchObject({ category: 'lexical' });
    expect(cls('assez', 'assé', annot('ADV'))).toMatchObject({ category: 'lexical' });
    expect(cls('jamais', 'jamé', annot('ADV'))).toMatchObject({ category: 'lexical' });
  });
  // Fix round 2: spaCy frequently tags adjectival participles as ADJ rather than VERB, so
  // gender/number variation within the -é family (é/ée/és/ées) must always be graded as
  // agreement, regardless of POS — only a pair against a truly verb-only ending (-er/-ez/-ai...)
  // needs the VERB/AUX gate.
  it('still grades é-family gender/number agreement on an ADJ-tagged participle', () => {
    expect(cls('fermées', 'fermé', annot('ADJ'))).toMatchObject({ category: 'agreement', sub: agreementSub('fermées', 'fermé', annot('ADJ')) });
    expect(cls('fatiguée', 'fatigué', annot('ADJ'))).toMatchObject({ category: 'agreement', sub: agreementSub('fatiguée', 'fatigué', annot('ADJ')) });
  });
});

describe('rule 3: accent', () => {
  it('identical after removing diacritics', () => {
    expect(cls('élève', 'eleve')).toMatchObject({ category: 'accent' });
    expect(cls('garçon', 'garcon')).toMatchObject({ category: 'accent' });
    expect(cls('forêt', 'foret')).toMatchObject({ category: 'accent' });
  });
  it('stays conservative when accents and endings both differ', () => {
    expect(cls('élèves', 'eleve')?.category).toBe('lexical'); // stems differ once accents differ: not agreement, not accent
  });
});

describe('rule 4: punctuation', () => {
  it('different punctuation', () => expect(cls('.', '!')).toMatchObject({ category: 'punctuation_case' }));
  it('missing punctuation', () => expect(classifyPair(tok(','), null, undefined, 3)).toMatchObject({ category: 'punctuation_case', typed: null, expected: ',' }));
  it('extra punctuation', () => expect(classifyPair(null, tok(';'), undefined, 3)).toMatchObject({ category: 'punctuation_case', expected: null, typed: ';' }));
});

describe('rule 5: lexical', () => {
  it('everything else', () => expect(cls('maison', 'mison')).toMatchObject({ category: 'lexical' }));
  it('missing word', () => expect(classifyPair(tok('noir'), null, undefined, 1)).toMatchObject({ category: 'lexical', sub: 'missing', anchor: 1 }));
  it('extra word', () => expect(classifyPair(null, tok('petit'), undefined, 0)).toMatchObject({ category: 'lexical', sub: 'extra', anchor: 0 }));
});

const tk = (w: string) => tokenize(w)[0];
function ann(pos: string, morph: Record<string, string>, extra: Partial<AnnotToken> = {}): AnnotToken {
  return { i: 0, text: '', start: 0, end: 0, lemma: '', pos, morph, head: 0, dep: 'dep', categories: [], homophone: null, subject: null, ...extra };
}
describe('classify v2', () => {
  it('accepts 1990 reform spellings as correct', () => {
    expect(classifyPair(tk('maître'), tk('maitre'), undefined, -1)).toBeNull();
    expect(classifyPair(tk('oignon'), tk('ognon'), undefined, -1)).toBeNull();
    expect(classifyPair(tk('ruisselle'), tk('ruissèle'), undefined, -1)).toBeNull();
    expect(classifyPair(tk('dû'), tk('du'), undefined, -1)).toMatchObject({ category: 'accent' });
  });
  it('uses lexicon forms for irregular agreement and picks the subcategory from features', () => {
    const chevaux = ann('NOUN', { Gender: 'Masc', Number: 'Plur' }, { forms: { cheval: { g: 'm', n: 's' } } });
    expect(classifyPair(tk('chevaux'), tk('cheval'), chevaux, -1)).toMatchObject({ category: 'agreement', sub: 'number' });
    const belle = ann('ADJ', { Gender: 'Fem', Number: 'Sing' }, { forms: { beau: { g: 'm', n: 's' }, belles: { g: 'f', n: 'p' }, beaux: { g: 'm', n: 'p' } } });
    expect(classifyPair(tk('belle'), tk('beau'), belle, -1)).toMatchObject({ category: 'agreement', sub: 'gender' });
    expect(classifyPair(tk('belle'), tk('belles'), belle, -1)).toMatchObject({ category: 'agreement', sub: 'number' });
    expect(classifyPair(tk('belle'), tk('beaux'), belle, -1)).toMatchObject({ category: 'agreement', sub: 'number' });
    const parties = ann('VERB', { VerbForm: 'Part', Gender: 'Fem', Number: 'Plur' }, { forms: { parti: { g: 'm', n: 's' } } });
    expect(classifyPair(tk('parties'), tk('parti'), parties, -1)).toMatchObject({ category: 'agreement', sub: 'participle' });
    const vont = ann('VERB', { VerbForm: 'Fin', Number: 'Plur' }, { forms: { va: { g: null, n: 's' } } });
    expect(classifyPair(tk('vont'), tk('va'), vont, -1)).toMatchObject({ category: 'agreement', sub: 'verb' });
  });
  it('marks lexicon sound-alikes as lexical with a sub, still after homophone sets', () => {
    const mere = ann('NOUN', { Gender: 'Fem', Number: 'Sing' }, { sound_alikes: ['mer', 'maire'] });
    expect(classifyPair(tk('mère'), tk('mer'), mere, -1)).toMatchObject({ category: 'lexical', sub: 'sound_alike' });
    const a = ann('AUX', { VerbForm: 'Fin' }, { sound_alikes: ['à'] });
    expect(classifyPair(tk('a'), tk('à'), a, -1)).toMatchObject({ category: 'homophone' });
  });
});
