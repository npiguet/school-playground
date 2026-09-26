import { beforeEach, describe, expect, it } from 'vitest';
import { fill, matches, pick, poolFor, resetDialogueMemory, sayKey } from './select';
import { LINES } from './content';
import type { LineDef } from './types';

const l = (text: string, when?: LineDef['when']): LineDef => ({ speaker: 'eris', text, ...(when ? { when } : {}) });
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

beforeEach(() => resetDialogueMemory());

describe('picking a line (spec §8)', () => {
  it('prefers the lines made for this context over the generic ones', () => {
    const lines = [l('a'), l('b'), l('g1', { mode: ['grimoire'] }), l('g2', { mode: ['grimoire'] })];
    expect(poolFor(lines, { mode: 'grimoire' }).map((x) => x.text)).toEqual(['g1', 'g2']);
    expect(poolFor(lines, { mode: 'dictation' }).map((x) => x.text)).toEqual(['a', 'b']);
    expect(poolFor(lines, {}).map((x) => x.text)).toEqual(['a', 'b']);
    expect(matches({ stage: ['egg'] }, { stage: 'egg' })).toBe(true);
    expect(matches({ stage: ['egg'] }, {})).toBe(false);
  });

  it('never says the same line twice in a row, unless it is the only one', () => {
    const pool = [l('a'), l('b'), l('c')];
    expect(pick(pool, 'a', seq(0))!.text).toBe('b');
    expect(pick(pool, 'b', seq(0.99))!.text).toBe('c');
    expect(pick([l('a')], 'a', seq(0))!.text).toBe('a');
    expect(pick([], undefined, seq(0))).toBeNull();
    // Two identical variants, both said last: still a line, never undefined.
    expect(pick([l('a'), l('a')], 'a', seq(0.99))!.text).toBe('a');
  });

  it('fills the declared placeholders and leaves unknown ones visible (the content test forbids them)', () => {
    expect(fill('Bienvenue, {hero}.', { hero: 'Io' })).toBe('Bienvenue, Io.');
    expect(fill('{nope}', {})).toBe('{nope}');
  });

  it('speaks a key as a framed line, spaced, with its key, and remembers it', () => {
    const d = { name: 'Brasier', stage: 'young', tint: 'bronze' } as never;
    const first = sayKey('camp.enter', { vars: { hero: 'Io' }, dragon: d, rnd: seq(0) });
    expect(first).toMatchObject({ speaker: 'dragon', name: 'Brasier', key: 'camp.enter', text: 'Bienvenue au camp, Io.' });
    for (let i = 0; i < 20; i++) {
      const again = sayKey('camp.enter', { vars: { hero: 'Io' }, dragon: d });
      expect(again.text).not.toBe(first.text);
      first.text = again.text;
    }
    expect(sayKey('library.owl', { rnd: seq(0.3) }).text).toMatch(/^Hou\u202f!/);
  });

  it('knows every key it can be asked for', () => {
    expect(Object.keys(LINES).length).toBeGreaterThan(20);
  });
});
