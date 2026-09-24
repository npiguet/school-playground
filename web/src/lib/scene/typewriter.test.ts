import { describe, expect, it } from 'vitest';
import { TYPE_CPS, advance, typedLength } from './typewriter';

const lines = [{ text: 'Bonjour.' }, { text: 'Au revoir.' }];

describe('typewriter', () => {
  it('types TYPE_CPS characters per second and stops at the end', () => {
    expect(TYPE_CPS).toBe(45);
    expect(typedLength('Bonjour.', 0)).toBe(0);
    expect(typedLength('Bonjour.', 100)).toBe(4);
    expect(typedLength('Bonjour.', 10_000)).toBe(8);
    expect(typedLength('Bonjour.', -50)).toBe(0);
  });

  it('a tap first completes the line, then moves to the next, then finishes', () => {
    expect(advance({ index: 0, shown: 3 }, lines)).toEqual({ index: 0, shown: 8, done: false });
    expect(advance({ index: 0, shown: 8 }, lines)).toEqual({ index: 1, shown: 0, done: false });
    expect(advance({ index: 1, shown: 10 }, lines)).toEqual({ index: 1, shown: 10, done: true });
  });

  it('is done on an empty script', () => {
    expect(advance({ index: 0, shown: 0 }, []).done).toBe(true);
  });
});
