// Plan Global Constraints (Ethics): nothing is lost and no guilt wording - « manqué », « raté »,
// « perdu » are never on screen. The e2e scans (world.spec.ts, scenes-camp.spec.ts) only read the
// screens they visit, so the web sources are checked here as a whole (the server's strings are
// checked by server/tests/test_wording.py). « Il manque un mot » (a neutral hint) is allowed: only the
// participles are guilt wording.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GUILT } from './testing/copyRules';

// src/testing holds test support, never on screen (copyRules.ts spells the guilt words to ban them).
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (p.replaceAll('\\', '/') !== 'src/testing') walk(p, out);
    } else if ((name.endsWith('.ts') || name.endsWith('.svelte')) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

function guiltHits(file: string, text: string): string[] {
  const out: string[] = [];
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(GUILT)) out.push(`${file}:${i + 1}: ${m[0]}`);
  });
  return out;
}

describe('no guilt wording in the web sources', () => {
  it('finds none of « manqué », « raté », « perdu » in any component or module', () => {
    const files = walk('src');
    expect(files.length).toBeGreaterThan(100);
    expect(files.flatMap((f) => guiltHits(f, readFileSync(f, 'utf-8')))).toEqual([]);
  });

  it('catches a planted participle and lets « Il manque » or « ratisser » through', () => {
    expect(guiltHits('f.svelte', '<p>Rien n\'est perdu.</p>\n<p>Tu as raté.</p>\n')).toEqual([
      'f.svelte:1: perdu',
      'f.svelte:2: raté',
    ]);
    expect(guiltHits('f.ts', "const s = 'Il manque un mot. On va ratisser.';\n")).toEqual([]);
  });
});
