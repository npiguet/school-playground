import { describe, it, expect } from 'vitest';
import { tokenize } from './tokenize';
import { alignTokens } from './align';

const pairs = (ref: string, typed: string) =>
  alignTokens(tokenize(ref), tokenize(typed)).map((p) => [p.refIndex, p.typedIndex]);

describe('alignTokens', () => {
  it('aligns identical texts one to one', () => {
    expect(pairs('Les chats dorment.', 'Les chats dorment.')).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]]);
  });
  it('pairs a misspelled word with its reference', () => {
    expect(pairs('les chats dorment', 'les chat dorment')).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
  it('detects a missing word', () => {
    expect(pairs('le chat noir dort', 'le chat dort')).toEqual([[0, 0], [1, 1], [2, null], [3, 2]]);
  });
  it('detects an extra word', () => {
    expect(pairs('le chat dort', 'le petit chat dort')).toEqual([[0, 0], [null, 1], [1, 2], [2, 3]]);
  });
  it('never pairs a word with punctuation', () => {
    expect(pairs('Bonjour, Marie', 'Bonjour Marie')).toEqual([[0, 0], [1, null], [2, 1]]);
    expect(pairs('Il dort.', 'Il dort !')).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
  it('prefers substituting a similar word over a gap pair', () => {
    expect(pairs('les fées dansent', 'les fée danse')).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
  it('pairs homophones even when they look different', () => {
    expect(pairs("il s'est levé", 'il ses levé')).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
  it('handles an empty typed text', () => {
    expect(pairs('a b', '')).toEqual([[0, null], [1, null]]);
  });
});
