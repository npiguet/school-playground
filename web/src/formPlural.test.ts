// UI1 playability #6, UI3a playability #10: never a form plural « quête(s) », « nouveau(x) » on
// screen - count with plural() (lib/text/french.ts). Only what can reach the screen is scanned
// (lib/text/screenText.ts): comments and code such as `handle(e)` are not text.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screenText } from './lib/text/screenText';

const PLURAL = /[A-Za-zÀ-ÿ]\((?:s|x|e|es)\)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const formPlurals = (source: string, kind: 'svelte' | 'ts') => screenText(source, kind).match(PLURAL) ?? [];

describe('no form plurals on screen', () => {
  it('finds none in the components, the screens and the world data', () => {
    const report: string[] = [];
    for (const f of [...walk('src/components'), ...walk('src/screens'), ...walk('src/lib/world')]) {
      for (const hit of formPlurals(readFileSync(f, 'utf-8'), f.endsWith('.svelte') ? 'svelte' : 'ts')) report.push(`${f}: ${hit}`);
    }
    expect(report).toEqual([]);
  });

  it('catches the planted forms and ignores comments and code (self-test)', () => {
    expect(formPlurals('<p>dans {n} quête(s)</p>\n<p>{n} nouveau(x) piège(s)</p>', 'svelte')).toHaveLength(3);
    expect(formPlurals("<p>{n > 1 ? 'ruse(s)' : ''}</p>", 'svelte')).toHaveLength(1);
    expect(formPlurals('<script>// photo(s)\nfunction onKey(e) { handle(e); }</script>\n<!-- jour(s) -->\n<button onclick={() => handle(e)}>x</button>', 'svelte')).toEqual([]);
    expect(formPlurals("const a = 'quête(s)'; // mot(s)\nfoo(e);", 'ts')).toEqual(['e(s)']);
  });
});
