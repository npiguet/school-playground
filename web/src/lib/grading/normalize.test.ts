import { describe, it, expect } from 'vitest';
import { normalizeWord, caseNormalizeWord, stripDiacritics } from './normalize';

describe('normalizeWord', () => {
  it('lower-cases and unifies apostrophes and quotes', () => {
    expect(normalizeWord('C’est')).toBe("c'est");
    expect(normalizeWord('Cʼest')).toBe("c'est");
    expect(normalizeWord('“')).toBe('"');
    expect(normalizeWord('”')).toBe('"');
  });
  it('unifies ligatures', () => {
    expect(normalizeWord('cœur')).toBe('coeur');
    expect(normalizeWord('Œuvre')).toBe('oeuvre');
    expect(normalizeWord('ex æquo')).toBe('ex aequo');
  });
  it('turns non-breaking spaces into spaces and trims', () => {
    expect(normalizeWord(' mot ')).toBe('mot');
  });
  it('keeps accents (accents are graded separately)', () => {
    expect(normalizeWord('élève')).toBe('élève');
  });
  // Ruling: typographic punctuation variants are not graded (spec §3.5 "typographic
  // apostrophes/quotes unified"; the iPad keyboard can't easily produce them).
  it('unifies guillemets into straight double quotes', () => {
    expect(normalizeWord('«')).toBe('"');
    expect(normalizeWord('»')).toBe('"');
    expect(normalizeWord('‹')).toBe('"');
    expect(normalizeWord('›')).toBe('"');
  });
  it('unifies the single ellipsis glyph into three dots', () => {
    expect(normalizeWord('…')).toBe('...');
  });
  it('unifies en/em dashes and the Unicode hyphen into the ASCII hyphen-minus', () => {
    expect(normalizeWord('—')).toBe('-');
    expect(normalizeWord('–')).toBe('-');
    expect(normalizeWord('‐')).toBe('-');
  });
});

describe('caseNormalizeWord', () => {
  it('keeps case but unifies the rest', () => {
    expect(caseNormalizeWord('Cœur’s')).toBe("Coeur's");
  });
});

describe('stripDiacritics', () => {
  it('removes accents and cedilla', () => {
    expect(stripDiacritics('élève')).toBe('eleve');
    expect(stripDiacritics('garçon')).toBe('garcon');
    expect(stripDiacritics('où')).toBe('ou');
    expect(stripDiacritics('a')).toBe('a');
  });
});
