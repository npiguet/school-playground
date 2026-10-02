// tools/art/overlay.py paints its tinted previews with a hand copy of TINT_SPECS (its TINTS table,
// bronze left out as it is no tint): the two must never drift apart (living-dragon final review).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TINT_SPECS } from './dragon';

function overlayTints(): Record<string, { shift: number; chroma: number; lightness: number }> {
  const source = readFileSync('../tools/art/overlay.py', 'utf-8');
  const block = /^TINTS = \{\n([\s\S]*?)^\}/m.exec(source);
  if (!block) throw new Error('no TINTS table in tools/art/overlay.py');
  const out: Record<string, { shift: number; chroma: number; lightness: number }> = {};
  for (const line of block[1].split('\n')) {
    if (!line.trim()) continue;
    const m = /^\s*"(\w+)":\s*\(\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(-?[\d.]+)\s*\),\s*$/.exec(line);
    if (!m) throw new Error(`unreadable TINTS line: ${line}`);
    out[m[1]] = { shift: Number(m[2]), chroma: Number(m[3]), lightness: Number(m[4]) };
  }
  return out;
}

describe('overlay.py TINTS', () => {
  it('is TINT_SPECS exactly, every tint but the untinted bronze', () => {
    const expected = Object.fromEntries(Object.entries(TINT_SPECS).filter(([, spec]) => spec !== null));
    expect(TINT_SPECS.bronze).toBeNull();
    expect(overlayTints()).toEqual(expected);
  });
});
