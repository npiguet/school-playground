import { describe, it, expect } from 'vitest';
import { replaceSpan, sentenceSpans } from './textEdit';

describe('replaceSpan', () => {
  it('replaces a word', () => expect(replaceSpan('les chat dorment', 4, 8, 'chats')).toBe('les chats dorment'));
  it('can insert several words', () => expect(replaceSpan('le dort', 3, 7, 'chat noir dort')).toBe('le chat noir dort'));
  it('removes a word and one adjacent space', () => {
    expect(replaceSpan('le petit chat', 3, 8, '')).toBe('le chat');
    expect(replaceSpan('le chat', 3, 7, '')).toBe('le');
    expect(replaceSpan('chat noir', 0, 4, '')).toBe('noir');
  });
  it('removes punctuation cleanly', () => expect(replaceSpan('oui, non', 3, 4, '')).toBe('oui non'));
});

describe('sentenceSpans', () => {
  it('returns spans in reading order', () => {
    expect(sentenceSpans('Il dort. Elle lit.')).toEqual([{ start: 0, end: 8 }, { start: 9, end: 18 }]);
  });
});
