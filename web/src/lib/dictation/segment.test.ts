import { describe, it, expect } from 'vitest';
import { splitSentences, splitChunks, countWords } from './segment';

describe('splitSentences', () => {
  it('splits on terminal punctuation followed by space', () => {
    const s = splitSentences('Il pleut. Elle sort ! Pourquoi ? Parce que.');
    expect(s.map((x) => x.text)).toEqual(['Il pleut.', 'Elle sort !', 'Pourquoi ?', 'Parce que.']);
    expect(s[1]).toMatchObject({ start: 10, end: 21, newParagraph: false });
  });
  it('keeps closing quotes with the sentence', () => {
    expect(splitSentences('Il dit : « Viens ici. » Elle vint.').map((x) => x.text)).toEqual(['Il dit : « Viens ici. »', 'Elle vint.']);
  });
  it('does not split on abbreviations or mid-sentence ellipses', () => {
    expect(splitSentences('La chèvre de M. Seguin broutait. Elle rêvait… et partit.').map((x) => x.text))
      .toEqual(['La chèvre de M. Seguin broutait.', 'Elle rêvait… et partit.']);
  });
  it('treats blank lines as boundaries and flags paragraphs', () => {
    const s = splitSentences('Fin du premier\n\nDébut du second. Suite.');
    expect(s.map((x) => [x.text, x.newParagraph])).toEqual([['Fin du premier', false], ['Début du second.', true], ['Suite.', false]]);
  });
  it('returns nothing for blank text', () => expect(splitSentences('  ')).toEqual([]));
});

describe('splitChunks', () => {
  it('splits at punctuation and merges tiny pieces', () => {
    expect(splitChunks('Le loup, affamé, arriva près de la bergerie.')).toEqual(['Le loup, affamé,', 'arriva près de la bergerie.']);
  });
  it('splits long runs near the middle', () => {
    const s = 'un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze';
    const chunks = splitChunks(s);
    expect(chunks).toEqual(['un deux trois quatre cinq six sept', 'huit neuf dix onze douze treize quatorze']);
    expect(chunks.join(' ')).toBe(s);
  });
  it('keeps short quoted speech attached', () => {
    expect(splitChunks('Il dit : « Viens ici. »')).toEqual(['Il dit : « Viens ici. »']);
  });
  it('never exceeds ten words per chunk', () => {
    const s = Array.from({ length: 33 }, (_, i) => `mot${i}`).join(' ');
    for (const c of splitChunks(s)) expect(countWords(c)).toBeLessThanOrEqual(10);
  });
});
