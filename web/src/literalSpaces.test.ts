// SP4 final review M3: no literal narrow no-break space (U+202F) or no-break space (U+00A0) in the
// source. They are invisible in a diff and in a review (« drachmes ? » reads as a plain space), so the
// code writes them as escapes (`\u202f`, `\u00a0`), and the content JSON uses plain spaces (the
// dialogue loader adds the narrow ones, lib/text/french.ts). Scans every code and data file of the
// repository the game is built from; the one exception is listed with its reason.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src', 'e2e', 'scripts', '../server', '../tts', '../tools', '../content', '../scripts'];
const CODE = /\.(ts|mts|js|mjs|cjs|svelte|py|json|sh|sql|css|html|ya?ml)$/;
// Never walked: dependencies, virtual environments, caches and build output.
const SKIP = new Set(['node_modules', '__pycache__', 'dist', 'build', 'test-results', 'playwright-report']);
// {path: why its literal spaces are deliberate}.
const ALLOWED: Record<string, string> = {
  '../tools/tts/parity.json': 'written by tools/tts/parity.py (ensure_ascii=False): the phonemes Kokoro produced, kept as it printed them',
};

function walk(dir: string, out: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out; // a root this checkout does not have
  }
  for (const n of names) {
    if (n.startsWith('.') || SKIP.has(n)) continue;
    const p = join(dir, n).replaceAll('\\', '/');
    if (statSync(p).isDirectory()) walk(p, out);
    else if (CODE.test(n)) out.push(p);
  }
  return out;
}

const SPECIAL = /[\u202f\u00a0]/;

describe('the source writes its special spaces as escapes', () => {
  it('holds no literal U+202F or U+00A0 outside the allowed files', () => {
    const files = ROOTS.flatMap((r) => walk(r));
    expect(files.length).toBeGreaterThan(500);
    const found: string[] = [];
    for (const f of files) {
      if (f in ALLOWED) continue;
      readFileSync(f, 'utf-8')
        .split('\n')
        .forEach((line, i) => {
          if (SPECIAL.test(line)) found.push(`${f}:${i + 1}`);
        });
    }
    expect(found).toEqual([]);
    // The walk reads the whole repository through scripts/npm.sh's bind mount: a cold file cache on
    // the Windows host took it past vitest's 5 s default (1 run in 13, 2026-10-02).
  }, 30_000);

  it('keeps its exceptions real', () => {
    for (const f of Object.keys(ALLOWED)) expect(SPECIAL.test(readFileSync(f, 'utf-8')), f).toBe(true);
  });
});
