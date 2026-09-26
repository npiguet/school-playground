// UI5 Ruling E15: French typography on every string the player reads: a narrow no-break space
// (U+202F) before « : ; ! ? » and inside « guillemets », never a plain or a no-break (U+00A0) one.
// Scans the same files as registerGuard (markup text and string literals, screenText) plus the
// scene components and the shared UI; the content files are spaced by their loader.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screenText } from './lib/text/screenText';

// validate.ts's messages are English developer diagnostics for the scene unit tests (never shown
// to the player - `docs/art/scenes.md`'s `?debug` overlay does not render them); greeting.ts's only
// string is an internal Set-key template (`<place>:<profileId>`), not player copy. Both are code
// tokens screenText can't tell from prose (like the ternary/CSS-pseudo-class exceptions it already
// carves out), so they are excluded here rather than have French spacing rules mangle English text
// and an opaque cache key.
const SCENE_EXCLUDE = new Set(['src/lib/scene/validate.ts', 'src/lib/scene/greeting.ts']);
const FILES = [
  'src/App.svelte',
  ...walk('src/components'),
  ...walk('src/screens'),
  ...walk('src/lib/world'),
  ...walk('src/lib/battle'),
  ...walk('src/lib/scene').filter((p) => !SCENE_EXCLUDE.has(p)),
  'src/lib/library/shelf.ts',
  'src/lib/explain.ts',
  'src/lib/argus.ts',
  'src/lib/dictation/script.ts',
];
const BAD = /[ \u00a0][:;!?»]|«[ \u00a0]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(svelte|ts)$/.test(n) && !n.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('French spacing on screen', () => {
  it('puts U+202F before « : ; ! ? » and inside guillemets everywhere', () => {
    const report: string[] = [];
    for (const f of FILES) {
      const text = screenText(readFileSync(f, 'utf-8'), f.endsWith('.svelte') ? 'svelte' : 'ts');
      for (const m of text.matchAll(BAD)) report.push(`${f}: «${text.slice(Math.max(0, m.index! - 20), m.index! + 3)}»`);
    }
    expect(report).toEqual([]);
  });

  it('catches a planted plain space and ignores code (self-test)', () => {
    expect([...screenText('<p>Victoire !</p>', 'svelte').matchAll(BAD)]).toHaveLength(1);
    expect([...screenText("<script>const x = a ? b : c;</script><p>Victoire\u202f!</p>", 'svelte').matchAll(BAD)]).toHaveLength(0);
  });
});
