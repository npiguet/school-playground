// CLAUDE.md "No emoji" (user ruling 2026-09-24), UI3 Ruling A13: nothing the player can see may
// contain an emoji, and no Svelte markup may use a pictograph character as an icon. Every hit is
// reported as `file:line: char U+XXXX`. The allow-list is empty on purpose: an entry ('path:line')
// needs a user ruling.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ALLOW = new Set<string>([]);
const EMOJI = /\p{Extended_Pictographic}|\u{FE0F}/gu;
const ICON_GLYPHS = /[←-↓✓✔✕✖★☆▢▸▶✶❓❔]/gu;

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

  it('uses no pictograph character as an icon in Svelte markup', () => {
    const found = PLAYER_VISIBLE.filter((f) => f.endsWith('.svelte')).flatMap((f) =>
      hits(f, markupOnly(readFileSync(f, 'utf-8')), ICON_GLYPHS),
    );
    expect(found).toEqual([]);
  });
});
