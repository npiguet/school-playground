// The living dragon stays out of the game's entry chunk (Task 7, ruling O1: `vite build` must print no
// "chunks larger than 500 kB" warning): only DragonFigure loads LivingDragon, through a dynamic
// import, and the rest of the game reaches living/ only for the still pictures' tint (stillTint.ts,
// tint.ts) and the baked stages (stages.ts). The renderer, the rigs, the mesh, the pose and the atlas
// arrive with LivingDragon's chunk; each rig is its own lazily imported JSON chunk (rigs.ts).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

// A static, value-carrying import (`import type` erases at build time and is allowed).
const STATIC_IMPORT = /^\s*import\s+(?!type\s)[^'";]*?from\s+['"]([^'"]+)['"]/gm;
const EAGER_OK = /\/living\/(stillTint|tint|stages)$/;
const LAZY = /(\/LivingDragon\.svelte|\/living\/[\w]+)$/;

describe('the living dragon is lazily loaded', () => {
  it('no game module outside living/ imports LivingDragon or a living/ module other than the still tint and the stages statically', () => {
    const files = walk('src').filter((f) => !f.startsWith('src/lab/') && !f.startsWith('src/lib/living/') && !f.endsWith('/LivingDragon.svelte'));
    const bad: string[] = [];
    for (const f of files) {
      for (const m of readFileSync(f, 'utf-8').matchAll(STATIC_IMPORT)) {
        const spec = m[1].replace(/\.ts$/, '');
        if (LAZY.test(spec) && !EAGER_OK.test(spec)) bad.push(`${f}: ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the still tint and the stages pull no other living/ module in', () => {
    for (const f of ['src/lib/living/stillTint.ts', 'src/lib/living/tint.ts', 'src/lib/living/stages.ts']) {
      const specs = [...readFileSync(f, 'utf-8').matchAll(STATIC_IMPORT)].map((m) => m[1]);
      expect(specs.filter((s) => s.startsWith('./') && !/^\.\/(tint|stages)$/.test(s)), f).toEqual([]);
    }
  });

  it('DragonFigure imports LivingDragon dynamically', () => {
    expect(readFileSync('src/components/DragonFigure.svelte', 'utf-8')).toMatch(/import\(\s*['"]\.\/LivingDragon\.svelte['"]\s*\)/);
  });
});
