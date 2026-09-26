// UI4 Ruling C14: every scene background shipped under public/art/scenes is used by the game (an
// unused one is dead weight in the PWA cache and misleads the art inventory).
// The scan reads the raw sources: a path inside a comment counts as a reference too. It is a guard
// against forgotten files, not proof of use: a file named only in a comment would pass it.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('scene art in use', () => {
  it('references every file of public/art/scenes from the game sources', () => {
    const code = sources('src').map((f) => readFileSync(f, 'utf-8')).join('\n');
    const unused = readdirSync('public/art/scenes').filter((f) => f.endsWith('.webp') && !code.includes(`/art/scenes/${f}`));
    expect(unused).toEqual([]);
  });
});
