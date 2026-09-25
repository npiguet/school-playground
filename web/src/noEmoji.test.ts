// CLAUDE.md "No emoji" (user ruling 2026-09-24), UI3 Ruling A13: nothing the player can see may
// contain an emoji, and a fixed set of icon-lookalike glyphs (✓✔✕✖★☆▢▸▶✶❓❔) may never be used as
// an icon anywhere - not just in Svelte markup, but inside a <script> block, a .ts constant, a
// content/*.json string or a server string too. Arrows (←↑→↓) are checked in Svelte markup only:
// unlike the glyphs above, they have a legitimate prose use elsewhere (explain.ts's grammar
// explanations, content/homophones.json's hints, code comments) and are only ever an emoji-style
// icon substitute when used as markup. Fix round 1 #1-2 (reviewer Opus): the glyph check now runs
// over raw file content (so a <script> block is not blanked away first), and a matching Unicode
// escape (`\u2713`, `\u{1F4CA}`, `\U0001F4CA`) or HTML character reference (`&#10003;`, `&#x2713;`,
// `&check;`) is decoded and checked too, so a disguised code point can't slip past the plain-glyph
// scan. Every hit is reported as `file:line: char U+XXXX`. The allow-list is empty on purpose: an
// entry ('path:line') needs a user ruling.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOW = new Set<string>([]);
const EMOJI = /\p{Extended_Pictographic}|\u{FE0F}/gu;
// Never legitimate anywhere player-visible (checked over raw file content, everywhere).
const ICON_GLYPHS = /[✓✔✕✖★☆▢▸▶✶❓❔]/gu;
// Legitimate in prose (explain.ts, homophones.json) - only banned as a Svelte-markup icon.
const ARROW_GLYPHS = /[←-↓]/gu;

function walk(dir: string, exts: string[], out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__pycache__') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e)) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

function hits(file: string, text: string, re: RegExp): string[] {
  const out: string[] = [];
  text.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (ALLOW.has(at)) return;
    for (const m of line.matchAll(re)) {
      out.push(`${at}: ${m[0]} U+${m[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`);
    }
  });
  return out;
}

/** Blanks <script>, <style> and HTML comments (line breaks kept) so only the markup is left. */
function markupOnly(svelte: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  return svelte.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, blank);
}

// --- Fix round 1 #2: encoded forms (an escape or entity whose decoded code point is banned) -----

const UNICODE_ESCAPE = /\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})/g;
const HTML_ENTITY = /&#x([0-9a-fA-F]+);|&#([0-9]+);|&([a-zA-Z]+);/g;
// HTML5 named character references relevant to the icon-glyph set (the brief's own examples).
const NAMED_ENTITY_CODEPOINTS: Record<string, number> = { check: 0x2713, star: 0x2606, starf: 0x2605 };

const EMOJI_ONE = /^(\p{Extended_Pictographic}|\u{FE0F})$/u;
const ICON_ONE = /^[✓✔✕✖★☆▢▸▶✶❓❔]$/u;

/** `null` unless `cp` decodes to a code point the plain-glyph scans already ban. */
function bannedKind(cp: number): string | null {
  const ch = String.fromCodePoint(cp);
  if (EMOJI_ONE.test(ch)) return 'emoji';
  if (ICON_ONE.test(ch)) return 'icon glyph';
  return null;
}

function hex(cp: number): string {
  return cp.toString(16).toUpperCase().padStart(4, '0');
}

/** Finds a Unicode escape or HTML character reference whose decoded code point is a banned emoji
 *  or icon glyph - the disguised form of what `hits(..., EMOJI)`/`hits(..., ICON_GLYPHS)` already
 *  catch as a literal character (fix round 1 #2). */
function encodedHits(file: string, text: string): string[] {
  const out: string[] = [];
  text.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (ALLOW.has(at)) return;
    for (const m of line.matchAll(UNICODE_ESCAPE)) {
      const cp = parseInt(m[1] ?? m[2] ?? m[3], 16);
      const kind = bannedKind(cp);
      if (kind) out.push(`${at}: ${m[0]} decodes to U+${hex(cp)} (${kind})`);
    }
    for (const m of line.matchAll(HTML_ENTITY)) {
      const cp = m[1] !== undefined ? parseInt(m[1], 16) : m[2] !== undefined ? parseInt(m[2], 10) : NAMED_ENTITY_CODEPOINTS[m[3]];
      if (cp === undefined) continue;
      const kind = bannedKind(cp);
      if (kind) out.push(`${at}: ${m[0]} decodes to U+${hex(cp)} (${kind})`);
    }
  });
  return out;
}

// Final review M14: a CSS escape (`content: '\2713'`) is the stylesheet's way to hide a code point.
// Only CSS text is decoded this way (a `.css` file or a Svelte `<style>` block): elsewhere a
// backslash + hex digits means something else (a regex, a Windows path, a TeX-ish hint).
const CSS_ESCAPE = /\\([0-9a-fA-F]{1,6})\s?/g;

/** Keeps only the `<style>` blocks of a Svelte file (everything else blanked, line breaks kept). */
function styleOnly(svelte: string): string {
  const blank = (s: string) => s.replace(/[^\n]/g, ' ');
  let out = '';
  let last = 0;
  for (const m of svelte.matchAll(/<style[\s\S]*?<\/style>/g)) {
    out += blank(svelte.slice(last, m.index)) + m[0];
    last = m.index! + m[0].length;
  }
  return out + blank(svelte.slice(last));
}

/** Finds a CSS escape whose decoded code point is a banned emoji or icon glyph. */
function cssEscapeHits(file: string, css: string): string[] {
  const out: string[] = [];
  css.split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (ALLOW.has(at)) return;
    for (const m of line.matchAll(CSS_ESCAPE)) {
      const cp = parseInt(m[1], 16);
      if (cp > 0x10ffff) continue;
      const kind = bannedKind(cp);
      if (kind) out.push(`${at}: ${m[0].trim()} decodes to U+${hex(cp)} (${kind})`);
    }
  });
  return out;
}

/** The CSS text of a file: the whole of a `.css` file, the `<style>` blocks of a `.svelte` one. */
function cssOf(file: string, text: string): string | null {
  if (file.endsWith('.css')) return text;
  if (file.endsWith('.svelte')) return styleOnly(text);
  return null;
}

const PLAYER_VISIBLE = [
  ...walk('src', ['.ts', '.svelte', '.css']),
  'index.html',
  'public/manifest.json',
  ...walk('../content', ['.json']),
  ...walk('../server/app', ['.py']),
];

describe('no emoji anywhere the player can see (CLAUDE.md)', () => {
  it('scans the real trees', () => {
    expect(PLAYER_VISIBLE.length).toBeGreaterThan(100);
    expect(PLAYER_VISIBLE).toContain(join('../server/app/world', 'catalog.py'));
    expect(PLAYER_VISIBLE).toContain(join('src/lib', 'levels.ts'));
  });

  it('finds no emoji in the web sources, the content files or the server', () => {
    const found = PLAYER_VISIBLE.flatMap((f) => hits(f, readFileSync(f, 'utf-8'), EMOJI));
    expect(found).toEqual([]);
  });

  // Fix round 1 #1: over raw file content (not markup-only), so a glyph hiding in a <script>
  // block, a .ts label, a JSON string or a server string is caught too, not just in .svelte markup.
  it('uses no icon-lookalike glyph anywhere, including inside <script> blocks', () => {
    const found = PLAYER_VISIBLE.flatMap((f) => hits(f, readFileSync(f, 'utf-8'), ICON_GLYPHS));
    expect(found).toEqual([]);
  });

  it('uses no arrow character as an icon in Svelte markup', () => {
    const found = PLAYER_VISIBLE.filter((f) => f.endsWith('.svelte')).flatMap((f) =>
      hits(f, markupOnly(readFileSync(f, 'utf-8')), ARROW_GLYPHS),
    );
    expect(found).toEqual([]);
  });

  it('finds no encoded emoji or icon glyph (Unicode escape or HTML character reference)', () => {
    const found = PLAYER_VISIBLE.flatMap((f) => encodedHits(f, readFileSync(f, 'utf-8')));
    expect(found).toEqual([]);
  });

  it('finds no CSS escape of an emoji or icon glyph in a stylesheet or a <style> block', () => {
    const found = PLAYER_VISIBLE.flatMap((f) => {
      const css = cssOf(f, readFileSync(f, 'utf-8'));
      return css === null ? [] : cssEscapeHits(f, css);
    });
    expect(found).toEqual([]);
  });
});

// Fix round 1 #1: proves the matcher reaches every kind of location the review flagged, without
// committing a planted file anywhere in the real trees above.
describe('the icon-glyph matcher reaches every file kind, including <script> blocks', () => {
  it('catches a planted glyph in a <script> block, a .ts constant, JSON content and a python string', () => {
    expect(hits('fixture.svelte', "<script>\n  const label = '✓ Fait';\n</script>\n<p>hi</p>\n", ICON_GLYPHS)).toEqual([
      'fixture.svelte:2: ✓ U+2713',
    ]);
    expect(hits('fixture.ts', "export const LABEL = 'Choix : ★';\n", ICON_GLYPHS)).toEqual(['fixture.ts:1: ★ U+2605']);
    expect(hits('fixture.json', '{"hint": "Coche ✔ pour valider"}', ICON_GLYPHS)).toEqual(['fixture.json:1: ✔ U+2714']);
    expect(hits('fixture.py', 'label = "Erreur ✕"\n', ICON_GLYPHS)).toEqual(['fixture.py:1: ✕ U+2715']);
  });

  it('still lets a legitimate arrow through outside Svelte markup (explain.ts/homophones.json style prose)', () => {
    expect(hits('fixture.ts', "return `« a » → « b »`;\n", ICON_GLYPHS)).toEqual([]);
  });
});

// Fix round 1 #2: proves the encoded-form matcher decodes and flags a disguised code point,
// again without committing a planted file.
describe('the encoded-glyph matcher', () => {
  it('flags a banned code point behind a JS/TS unicode escape', () => {
    expect(encodedHits('fixture.ts', "const ok = '\\u2713 Fait';\n")).toEqual(['fixture.ts:1: \\u2713 decodes to U+2713 (icon glyph)']);
    expect(encodedHits('fixture.ts', "const chart = '\\u{1F4CA}';\n")).toEqual(['fixture.ts:1: \\u{1F4CA} decodes to U+1F4CA (emoji)']);
  });

  it('flags a banned code point behind a Python wide unicode escape', () => {
    expect(encodedHits('fixture.py', 'label = "\\U0001F4CA"\n')).toEqual(['fixture.py:1: \\U0001F4CA decodes to U+1F4CA (emoji)']);
  });

  it('flags a banned code point behind an HTML numeric or named character reference', () => {
    expect(encodedHits('fixture.svelte', '<span>&#10003;</span>\n')).toEqual(['fixture.svelte:1: &#10003; decodes to U+2713 (icon glyph)']);
    expect(encodedHits('fixture.svelte', '<span>&#x2713;</span>\n')).toEqual(['fixture.svelte:1: &#x2713; decodes to U+2713 (icon glyph)']);
    expect(encodedHits('fixture.svelte', '<span>&check;</span>\n')).toEqual(['fixture.svelte:1: &check; decodes to U+2713 (icon glyph)']);
    expect(encodedHits('fixture.svelte', '<span>&star;</span>\n')).toEqual(['fixture.svelte:1: &star; decodes to U+2606 (icon glyph)']);
  });

  it('lets an ordinary escape or entity through', () => {
    expect(encodedHits('fixture.ts', "const s = 'caf\\u00e9';\n")).toEqual([]);
    expect(encodedHits('fixture.svelte', '<span>&amp; &nbsp;</span>\n')).toEqual([]);
  });
});

// Final review M14: proves the CSS-escape matcher decodes a disguised code point in both places CSS
// lives, and leaves ordinary escapes and non-CSS text alone.
describe('the CSS-escape matcher', () => {
  it('flags a banned code point behind a CSS escape in a .css file', () => {
    expect(cssEscapeHits('fixture.css', ".done::before { content: '\\2713'; }\n")).toEqual([
      'fixture.css:1: \\2713 decodes to U+2713 (icon glyph)',
    ]);
    expect(cssEscapeHits('fixture.css', "a::after { content: '\\1F4CA '; }\n")).toEqual([
      'fixture.css:1: \\1F4CA decodes to U+1F4CA (emoji)',
    ]);
  });

  it('flags one inside a Svelte <style> block, on its real line', () => {
    const svelte = "<script>\n  const a = 1;\n</script>\n<p>hi</p>\n<style>\n  p::before { content: '\\2605'; }\n</style>\n";
    expect(cssEscapeHits('fixture.svelte', cssOf('fixture.svelte', svelte)!)).toEqual([
      'fixture.svelte:6: \\2605 decodes to U+2605 (icon glyph)',
    ]);
  });

  it('ignores the markup and script of a Svelte file, and an ordinary CSS escape', () => {
    expect(cssOf('fixture.svelte', "<script>\n  const re = /\\2713/;\n</script>\n")!.trim()).toBe('');
    expect(cssOf('fixture.ts', 'const re = /\\2713/;\n')).toBeNull();
    expect(cssEscapeHits('fixture.css', "q::before { content: '\\AB'; }\n")).toEqual([]);
  });
});
