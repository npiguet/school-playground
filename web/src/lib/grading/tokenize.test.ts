import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenize';

const texts = (s: string) => tokenize(s).map((t) => t.text);
const kinds = (s: string) => tokenize(s).map((t) => t.kind);

describe('tokenize', () => {
  it('splits words and punctuation', () => {
    expect(texts("L'enfant a dit : « Bonjour ! »")).toEqual(["L'enfant", 'a', 'dit', ':', '«', 'Bonjour', '!', '»']);
    expect(kinds('Oui, non.')).toEqual(['word', 'punct', 'word', 'punct']);
  });
  it('keeps elisions, hyphens and typographic apostrophes inside words', () => {
    expect(texts("aujourd’hui peut-être dit-il c'est")).toEqual(['aujourd’hui', 'peut-être', 'dit-il', "c'est"]);
  });
  it('groups ellipses and treats dashes as punctuation', () => {
    expect(texts('Bon... enfin… — oui')).toEqual(['Bon', '...', 'enfin', '…', '—', 'oui']);
  });
  it('records exact offsets and normalised forms', () => {
    const t = tokenize('Les fées dansent.');
    expect(t[1]).toMatchObject({ text: 'fées', norm: 'fées', start: 4, end: 8, kind: 'word' });
    expect(t[3]).toMatchObject({ text: '.', start: 16, end: 17, kind: 'punct' });
    expect(tokenize('Œuf')[0].norm).toBe('oeuf');
  });
  it('ignores whitespace and returns nothing for blank input', () => {
    expect(tokenize('  \n\t ')).toEqual([]);
  });
});
