// UI5 Ruling E15: French typography on every string the player reads: a narrow no-break space
// (U+202F) before « : ; ! ? » and inside « guillemets », never a plain or a no-break (U+00A0) one,
// and never none at all. Final review I5: the guard walks every source under src (markup text and
// string literals, screenText) except the tests, src/testing and the files named in EXCLUDE; an
// allow-list is how the Fil d'Ariane's messages (lib/fil.ts) slipped through. The content files are
// spaced by their loader; the server's strings have their own guard (server/tests/test_french_spacing.py,
// the same two rules).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screenText } from './lib/text/screenText';

// Sources whose string literals are never shown to the player, and which screenText can't tell
// from prose (code tokens, English diagnostics, URLs, keys):
const EXCLUDE: Record<string, string> = {
  // English developer diagnostics for the scene unit tests (the `?debug` overlay does not render them).
  'src/lib/scene/validate.ts': 'developer diagnostics',
  // An internal Set-key template (`<place>:<profileId>`), not player copy.
  'src/lib/scene/greeting.ts': 'a cache key',
  // The dialogue loader's English validation errors (thrown at import, never shown).
  'src/lib/dialogue/content.ts': 'developer diagnostics',
  // A developer's console line (`[audio] … could not load; it stays silent.`), never shown.
  'src/lib/audio/howlerBackend.ts': 'a console line',
  // Regular expressions over French punctuation (screenText reads a regex literal as a string).
  'src/lib/dictation/segment.ts': 'regular expressions',
  'src/lib/grading/grade.ts': 'regular expressions and alignment keys',
  'src/lib/grading/reform.ts': 'regular expressions',
  'src/lib/grading/tokenize.ts': 'regular expressions',
  // URL templates (`#/p/${id}/…?…`) and storage keys (`${hero}:${place}`).
  'src/lib/routes.ts': 'URLs',
  'src/lib/tours/seen.svelte.ts': 'storage keys',
  // The living dragon's GLSL shaders (`a ? b : c;` everywhere) and English WebGL diagnostics, never shown.
  'src/lib/living/renderer.ts': 'GLSL sources',
};

const BAD_SPACE = /[ \u00a0][:;!?»]|«[ \u00a0]/g;
// A missing space: a letter, digit or closing bracket right against « ; ! ? » », or « right against
// a word. The colon is left out: in code it is everywhere (`a:b`, `http:`), and screenText keeps no
// code. `?.` and `??` are code (optional chaining, nullish coalescing) and `texts?page=` a URL's
// query: French punctuation is never followed by a letter, a digit or « = ».
const NO_SPACE = /[\p{L}\d)][;!?»](?![.?=\p{L}\d])|«[\p{L}\d]/gu;

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) {
      if (p !== 'src/testing') walk(p, out);
    } else if (/\.(svelte|ts)$/.test(n) && !n.endsWith('.test.ts') && !n.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const FILES = walk('src').filter((p) => !(p in EXCLUDE));

/** Each spacing fault in `text`, with a little context. */
function faults(source: string): string[] {
  // A literal's `\u202f` escape and the markup's `&nbsp;` are the characters they stand for.
  const text = source
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)))
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&[a-z]+;/gi, '&');
  const found: string[] = [];
  for (const re of [BAD_SPACE, NO_SPACE]) {
    for (const m of text.matchAll(re)) found.push(text.slice(Math.max(0, m.index! - 20), m.index! + 3));
  }
  return found;
}

describe('French spacing on screen', () => {
  it('walks every player-visible source under src', () => {
    expect(FILES).toContain('src/lib/fil.ts');
    expect(FILES).toContain('src/App.svelte');
    expect(FILES.some((f) => f.startsWith('src/testing/') || f.endsWith('.test.ts'))).toBe(false);
    expect(FILES.length).toBeGreaterThan(150);
    // No stale exclusion: each one names a real source.
    for (const f of Object.keys(EXCLUDE)) expect(() => statSync(f), f).not.toThrow();
  });

  it('puts U+202F before « : ; ! ? » and inside guillemets everywhere', () => {
    const report: string[] = [];
    for (const f of FILES) {
      const text = screenText(readFileSync(f, 'utf-8'), f.endsWith('.svelte') ? 'svelte' : 'ts');
      for (const at of faults(text)) report.push(`${f}: «${at}»`);
    }
    expect(report).toEqual([]);
  });

  it('catches a planted plain space or a missing one, and ignores code (self-test)', () => {
    const svelte = (s: string) => faults(screenText(s, 'svelte'));
    expect(svelte('<p>Victoire !</p>')).toHaveLength(1);
    expect(svelte('<p>Victoire!</p>')).toHaveLength(1);
    expect(svelte('<p>Prêt?</p>')).toHaveLength(1);
    expect(svelte('<p>«mot\u202f»</p>')).toHaveLength(1);
    expect(svelte('<p>«\u202fmot»</p>')).toHaveLength(1);
    expect(svelte('<p>« mot »</p>')).toHaveLength(2);
    expect(svelte('<p>Victoire&nbsp;!</p>')).toHaveLength(1);
    expect(svelte('<p>Rejouer&nbsp;(2)</p>')).toHaveLength(0);
    expect(faults(screenText("const u = `/api/texts?page=${n}`; const v = '/api/x?since=1';", 'ts'))).toHaveLength(0);
    expect(svelte("<script>const x = a ? b : c; const y = p?.q ?? r;</script><p>Victoire\u202f! «\u202fmot\u202f»</p>")).toHaveLength(0);
    expect(faults(screenText('const m = `Verbe : « ${v} ».`;', 'ts'))).toHaveLength(3);
    expect(faults(screenText('const m = `Verbe\u202f: «\u202f${v}\u202f».`;', 'ts'))).toHaveLength(0);
  });
});
