import { describe, it, expect } from 'vitest';
import { isReformEquivalent, numberHyphensToSpaces, reformCanon } from './reform';
import { classifyPair } from './classify';
import { tokenize } from './tokenize';

const tk = (w: string) => tokenize(w)[0];

describe('reformCanon', () => {
  it('maps explicit reform pairs to the traditional spelling', () => {
    expect(reformCanon('ognon')).toBe('oignon');
    expect(reformCanon('oignon')).toBe('oignon');
    expect(reformCanon('évènement')).toBe('événement');
    expect(reformCanon('weekend')).toBe('week-end');
  });
  it('drops the circumflex on i and u except protected words and verb endings', () => {
    expect(reformCanon('maître')).toBe('maitre');
    expect(reformCanon('coût')).toBe('cout');
    expect(reformCanon('dû')).toBe('dû');
    expect(reformCanon('sûr')).toBe('sûr');
    expect(reformCanon('fûmes')).toBe('fûmes');
    expect(reformCanon('fût')).toBe('fût');
    expect(reformCanon('vînt')).toBe('vînt');
    expect(reformCanon('île')).toBe('ile');
    expect(reformCanon('tête')).toBe('tête'); // ê untouched
  });
  it('folds -eler/-eter reform forms onto the doubled consonant', () => {
    expect(reformCanon('ruissèle')).toBe('ruisselle');
    expect(reformCanon('ruissèlent')).toBe('ruissellent');
    expect(reformCanon('étiquète')).toBe('étiquette');
    expect(reformCanon('appèle')).toBe('appèle'); // appeler is not in the list: unchanged
  });
  it('isReformEquivalent', () => {
    expect(isReformEquivalent('maître', 'maitre')).toBe(true);
    expect(isReformEquivalent('sur', 'sûr')).toBe(false);
  });
});

// Fix round 1, CRITICAL 1: the imperfect subjunctive ("qu'il eût", "qu'il fît"...) must keep its
// circumflex — canonicalising it onto the passé simple ("eut", "fit"...) would silently accept a
// tense confusion as correct.
describe('reformCanon: imperfect-subjunctive circumflex (fix round 1, CRITICAL 1)', () => {
  it('keeps the circumflex on 3rd-singular imperfect-subjunctive forms', () => {
    expect(reformCanon('eût')).toBe('eût');
    expect(reformCanon('eut')).toBe('eut');
    expect(reformCanon('fît')).toBe('fît');
    expect(reformCanon('fit')).toBe('fit');
    expect(reformCanon('pût')).toBe('pût');
    expect(reformCanon('put')).toBe('put');
    expect(reformCanon('dût')).toBe('dût');
    expect(reformCanon('dut')).toBe('dut');
    expect(reformCanon('prît')).toBe('prît');
    expect(reformCanon('prit')).toBe('prit');
  });
  it('keeps the circumflex on the venir/tenir-family irregular 3rd singular', () => {
    expect(reformCanon('vînt')).toBe('vînt');
  });
  it('drops the circumflex on -aît/-oît present-tense indicatives (not the subjunctive)', () => {
    expect(reformCanon('connaît')).toBe('connait');
    expect(reformCanon('plaît')).toBe('plait');
    expect(reformCanon('accroît')).toBe('accroit');
  });
  it('drops the circumflex on the explicit noun exceptions even though they end in -oût/-ût', () => {
    expect(reformCanon('goût')).toBe('gout');
    expect(reformCanon('août')).toBe('aout');
  });
  it('grades an eût/eut mix-up as an accent error, not a silent pass', () => {
    expect(classifyPair(tk('eût'), tk('eut'), undefined, -1)).toMatchObject({ category: 'accent' });
  });
});

// Fix round 1, IMPORTANT 1: these four stems are "è verbs" whose traditional spelling was never
// doubled (il martèle, not il martelle) — there is no reform variant to accept for them.
describe('reformCanon: -eler/-eter stems (fix round 1, IMPORTANT 1)', () => {
  it('leaves martèle (and the other removed stems) unchanged, and does not accept martelle', () => {
    expect(reformCanon('martèle')).toBe('martèle');
    expect(reformCanon('martelle')).not.toBe(reformCanon('martèle'));
  });
});

// Fix round 1, IMPORTANT 3: an inflected plural of an explicit pair is accepted too.
describe('reformCanon: inflected plurals of explicit pairs (fix round 1, IMPORTANT 3)', () => {
  it('re-derives the plural from the traditional stem', () => {
    expect(reformCanon('évènements')).toBe('événements');
    expect(reformCanon('ognons')).toBe('oignons');
    expect(reformCanon('nénufars')).toBe('nénuphars');
    expect(reformCanon('weekends')).toBe('week-ends');
    expect(reformCanon('charriots')).toBe('chariots');
    expect(reformCanon('aigües')).toBe('aiguës');
  });
});

// Final review I-1: "-îmes/-ûmes/-îtes/-ûtes" protects the simple past (an open class of verbs),
// not the ordinary nouns and present-tense forms that happen to end the same way.
describe('reformCanon: -ûtes/-îtes/-îmes nouns vs the simple past (final review I-1)', () => {
  it('drops the circumflex on nouns and present-tense forms', () => {
    expect(reformCanon('croûtes')).toBe('croutes');
    expect(reformCanon('croûte')).toBe('croute');
    expect(reformCanon('flûtes')).toBe('flutes');
    expect(reformCanon('voûtes')).toBe('voutes');
    expect(reformCanon('boîtes')).toBe('boites');
    expect(reformCanon('gîtes')).toBe('gites');
    expect(reformCanon('abîmes')).toBe('abimes');
    expect(reformCanon('emboîtes')).toBe('emboites');
    expect(reformCanon('goûtes')).toBe('goutes');
  });
  it('keeps the circumflex on 1st/2nd plural simple-past forms', () => {
    expect(reformCanon('fûmes')).toBe('fûmes');
    expect(reformCanon('fûtes')).toBe('fûtes');
    expect(reformCanon('eûtes')).toBe('eûtes');
    expect(reformCanon('fîtes')).toBe('fîtes');
    expect(reformCanon('vînmes')).toBe('vînmes');
    expect(reformCanon('tîntes')).toBe('tîntes');
    expect(reformCanon('finîmes')).toBe('finîmes');
    expect(reformCanon('subîmes')).toBe('subîmes');
    expect(reformCanon('écrivîtes')).toBe('écrivîtes');
    expect(reformCanon('voulûmes')).toBe('voulûmes');
    expect(reformCanon('dîmes')).toBe('dîmes');
  });
  it('grades a reform-spelt plural noun as correct, and a simple-past mix-up as an accent error', () => {
    expect(tokenize('croûtes')[0].norm).toBe(tokenize('croutes')[0].norm);
    expect(classifyPair(tk('fûtes'), tk('futes'), undefined, -1)).toMatchObject({ category: 'accent' });
  });
});

// Final review I-4: orthographic doublets outside the reform are both correct too.
describe('reformCanon: doublets and -ayer verbs (final review I-4)', () => {
  it('accepts both members of a doublet, including inflected plurals', () => {
    expect(isReformEquivalent('clé', 'clef')).toBe(true);
    expect(isReformEquivalent('clés', 'clefs')).toBe(true);
    expect(isReformEquivalent('paie', 'paye')).toBe(true);
    expect(isReformEquivalent('cuillère', 'cuiller')).toBe(true);
    expect(isReformEquivalent('bistrot', 'bistro')).toBe(true);
    expect(tokenize('clef')[0].norm).toBe(tokenize('clé')[0].norm);
  });
  it('accepts the i/y spellings of -ayer verbs before a mute e', () => {
    expect(isReformEquivalent('essaie', 'essaye')).toBe(true);
    expect(isReformEquivalent('paient', 'payent')).toBe(true);
    expect(isReformEquivalent('balaiera', 'balayera')).toBe(true);
    expect(isReformEquivalent('effraies', 'effrayes')).toBe(true);
    expect(isReformEquivalent('payons', 'paions')).toBe(false); // no mute e: only « payons »
  });
  it('never lets a doublet swallow an unrelated word', () => {
    expect(isReformEquivalent('lis', 'lys')).toBe(false); // je lis
    expect(isReformEquivalent('raie', 'raye')).toBe(false); // la raie
    expect(isReformEquivalent('baie', 'baye')).toBe(false); // la baie
    expect(isReformEquivalent('clé', 'clés')).toBe(false);
  });
});

describe('numberHyphensToSpaces', () => {
  it('keeps length and only touches hyphens between number words', () => {
    expect(numberHyphensToSpaces('vingt-et-un chats')).toBe('vingt et un chats');
    expect(numberHyphensToSpaces('deux-cent-mille')).toBe('deux cent mille');
    expect(numberHyphensToSpaces('Vingt-Deux')).toBe('Vingt Deux');
    expect(numberHyphensToSpaces('porte-monnaie et un-deux')).toBe('porte-monnaie et un deux');
    expect(numberHyphensToSpaces('grand-père')).toBe('grand-père');
  });
});
