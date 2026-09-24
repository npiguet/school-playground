import { describe, it, expect } from 'vitest';
import { isReformEquivalent, numberHyphensToSpaces, reformCanon } from './reform';

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

describe('numberHyphensToSpaces', () => {
  it('keeps length and only touches hyphens between number words', () => {
    expect(numberHyphensToSpaces('vingt-et-un chats')).toBe('vingt et un chats');
    expect(numberHyphensToSpaces('deux-cent-mille')).toBe('deux cent mille');
    expect(numberHyphensToSpaces('Vingt-Deux')).toBe('Vingt Deux');
    expect(numberHyphensToSpaces('porte-monnaie et un-deux')).toBe('porte-monnaie et un deux');
    expect(numberHyphensToSpaces('grand-père')).toBe('grand-père');
  });
});
