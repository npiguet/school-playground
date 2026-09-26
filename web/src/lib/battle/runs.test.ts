import { describe, expect, it } from 'vitest';
import { glueRuns, snug } from './runs';
import { tokenize } from '../grading/tokenize';

type Tok = { kind: 'tok'; index: number };
const tok = (index: number): Tok => ({ kind: 'tok', index });

describe('the words as runs (final review M15)', () => {
  it('glues the pieces between two gaps into one run', () => {
    const runs = glueRuns<Tok>([tok(0), { kind: 'gap', text: ' ' }, tok(1), tok(2), { kind: 'gap', text: ' ' }]);
    expect(runs).toEqual([
      { kind: 'run', items: [tok(0)] },
      { kind: 'gap', text: ' ' },
      { kind: 'run', items: [tok(1), tok(2)] },
      { kind: 'gap', text: ' ' },
    ]);
  });

  it('keeps any glued piece in its run (a missing-word marker after its word)', () => {
    const marker = { kind: 'missing' as const, anchor: 0 };
    expect(glueRuns<Tok | typeof marker>([tok(0), marker, { kind: 'gap', text: ' ' }])[0]).toEqual({ kind: 'run', items: [tok(0), marker] });
  });

  it('a word and its full stop touch, with no padding between them', () => {
    const tokens = tokenize('Le bruit. Les maisons, enfin');
    const texts = tokens.map((t) => t.text);
    const bruit = texts.indexOf('bruit');
    expect(snug(tokens, bruit)).toEqual({ left: false, right: true });
    expect(snug(tokens, bruit + 1)).toEqual({ left: true, right: false });
    expect(snug(tokens, 0)).toEqual({ left: false, right: false });
    expect(snug(tokens, tokens.length - 1)).toEqual({ left: false, right: false });
  });
});
