// The tints' settings have one source, tintSpecs.json: dragon.ts builds TINT_SPECS from it and the art
// tools read it (tools/art/tints.py, for bake_tints.py and overlay.py). Before the baked tints
// (2026-10-03) overlay.py kept a hand copy, pinned here; now no art tool may keep one.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TINT_SPECS } from './dragon';
import TINT_JSON from './tintSpecs.json' with { type: 'json' };

describe('the tints have one source', () => {
  it('TINT_SPECS is tintSpecs.json: the six tints in the game\'s order, the bronze untinted', () => {
    expect(TINT_SPECS).toBe(TINT_JSON);
    expect(Object.keys(TINT_SPECS)).toEqual(['bronze', 'ecume', 'olivier', 'braise', 'jade', 'argent']);
    expect(TINT_SPECS.bronze).toBeNull();
    for (const [k, spec] of Object.entries(TINT_SPECS)) {
      if (spec) expect(Object.keys(spec).sort(), k).toEqual(['chroma', 'lightness', 'shift']);
    }
  });

  it('the art tools read the JSON and keep no hand copy of the settings', () => {
    expect(readFileSync('../tools/art/tints.py', 'utf-8')).toContain('web/src/lib/world/tintSpecs.json');
    for (const tool of ['overlay.py', 'bake_tints.py', 'accessories_sheet.py']) {
      const source = readFileSync(`../tools/art/${tool}`, 'utf-8');
      expect(source, tool).not.toMatch(/^TINTS\s*=\s*\{/m);
      expect(source, tool).not.toMatch(/"argent":\s*\(/);
    }
  });
});
