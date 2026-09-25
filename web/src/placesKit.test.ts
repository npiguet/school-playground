// Immersion wave Ruling W4 (playability #1): the places are built from kit classes only. Fails on a
// legacy class - .btn, .btn-primary, .btn-ghost, .card, .chip, .chip-active, .parchment - used in
// the markup (class attribute or class: directive) or reached through :global() in the <style> of
// any component under components/places/, and of the shared components the places render.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LEGACY = ['btn', 'btn-primary', 'btn-ghost', 'card', 'chip', 'chip-active', 'parchment'];
const SHARED = ['src/components/QuestCard.svelte'];
// Files still waiting for their task. Tasks 6-12 each remove theirs; it may only shrink (a clean
// file left here fails below), and Task 13 asserts it is empty.
const PENDING = new Set<string>([
  'src/components/places/delphi/TabletsPanel.svelte',
  'src/components/QuestCard.svelte',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.svelte')) out.push(p);
  }
  return out;
}

export function legacyUses(source: string): string[] {
  const hits: string[] = [];
  const lineOf = (i: number) => source.slice(0, i).split('\n').length;
  // Markup: drop <script> and HTML comments; keep <style> for the :global() check below.
  const markup = source
    .replace(/<script[\s\S]*?<\/script>/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const style = /<style[\s\S]*?<\/style>/.exec(markup);
  const body = style ? markup.slice(0, style.index) + markup.slice(style.index).replace(style[0], (m) => m.replace(/[^\n]/g, ' ')) : markup;
  // class="a b" or class={expr}; an expression runs to the `}` that closes the attribute (followed
  // by whitespace, `>` or `/`), so a template literal's own `${x}` does not cut it short.
  for (const m of body.matchAll(/\bclass=(?:"([^"]*)"|\{([^\n]*?)\}(?=[\s>/]))/g)) {
    const raw = (m[1] ?? '') + ' ' + [...(m[2] ?? '').matchAll(/['"`]([^'"`]*)['"`]/g)].map((s) => s[1]).join(' ');
    for (const token of raw.split(/[\s{}$]+/)) if (LEGACY.includes(token)) hits.push(`${lineOf(m.index!)}: class ${token}`);
  }
  for (const m of body.matchAll(/\bclass:([\w-]+)/g)) if (LEGACY.includes(m[1])) hits.push(`${lineOf(m.index!)}: class:${m[1]}`);
  if (style) {
    for (const m of style[0].matchAll(/:global\(\s*\.([\w-]+)/g)) {
      if (LEGACY.includes(m[1])) hits.push(`${lineOf(style.index + m.index!)}: :global(.${m[1]})`);
    }
  }
  return hits;
}

const files = [...walk('src/components/places'), ...SHARED.filter((f) => existsSync(f))];

describe('places use the kit, never the legacy UI classes (Ruling W4)', () => {
  it('finds no legacy class outside the pending files', () => {
    const report: string[] = [];
    for (const f of files) {
      if (PENDING.has(f)) continue;
      for (const hit of legacyUses(readFileSync(f, 'utf-8'))) report.push(`${f}:${hit}`);
    }
    expect(report).toEqual([]);
  });

  it('keeps the pending list honest: every pending file still has a legacy class', () => {
    for (const f of PENDING) {
      expect(existsSync(f), `${f} no longer exists: remove it from PENDING`).toBe(true);
      expect(legacyUses(readFileSync(f, 'utf-8')).length, `${f} is clean: remove it from PENDING`).toBeGreaterThan(0);
    }
  });

  it('catches every legacy form (self-test)', () => {
    const planted = [
      '<button class="btn btn-primary">x</button>',
      '<div class="card text-card">x</div>',
      '<button class="chip" class:chip-active={on}>x</button>',
      "<span class={`chip ${x}`}>x</span>",
      '<style>.grid :global(.chip) { min-height: 48px; }</style>',
    ].join('\n');
    expect(legacyUses(planted)).toHaveLength(7);
    expect(legacyUses('<button class="kit-bronze is-quiet">x</button><div class="kit-cubby">y</div>')).toEqual([]);
    expect(legacyUses('<script>const btn = "btn";</script><!-- class="card" -->')).toEqual([]);
  });
});
