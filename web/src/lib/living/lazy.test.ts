// The living dragon stays out of the game's entry chunk (Task 7, ruling O1: `vite build` must print no
// "chunks larger than 500 kB" warning): only DragonFigure loads LivingDragon, through a dynamic
// import, and the rest of the game reaches living/ only for the still pictures' tint (stillTint.ts,
// tint.ts) and the baked stages (stages.ts). The renderer, the rigs, the mesh, the pose and the atlas
// arrive with LivingDragon's chunk; each rig is its own lazily imported JSON chunk (rigs.ts). The
// battle screens (Play, Boss) are their own chunk too, loaded by App.svelte alone.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(svelte|ts)$/.test(name) && !name.endsWith('.test.ts')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

// A static, value-carrying import: `import x from '…'`, a side-effect `import '…'`, or a re-export
// (`export { x } from '…'`, `export * from '…'`). `import type` and `export type` erase at build
// time and are allowed. The bindings are matched by their own characters, so a `from` elsewhere (a
// parameter: `export function f(from = 0)`) is never taken for a module.
const STATIC_IMPORT =
  /^\s*(?:import\s+(?!type\s)(?:[\w$*{},\s]+?\s+from\s+)?|export\s+(?!type\s)(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s+)['"]([^'"]+)['"]/gm;
const staticImports = (source: string): string[] => [...source.matchAll(STATIC_IMPORT)].map((m) => m[1]);
const EAGER_OK = /\/living\/(stillTint|tint|stages)$/;
const LAZY = /(\/LivingDragon\.svelte|\/living\/[\w]+)$/;

describe('the import scan', () => {
  it('sees value imports, side-effect imports and re-exports, never a type-only or a dynamic one', () => {
    const source = [
      "import a from './a';",
      "import { b, c as d } from './b';",
      "import * as e from './e';",
      "import f, { g } from './f';",
      'import {',
      '  h,',
      '  i,',
      "} from './h';",
      "import './side';",
      "  import './indented';",
      "export { j } from './j';",
      "export * from './star';",
      "export * as k from './k';",
      "import type { T } from './type';",
      "export type { U } from './type2';",
      "const lazy = import('./lazy');",
      'export function run(steps: string[], from = 0) {',
      "  return import('./inner');",
      '}',
    ].join('\n');
    expect(staticImports(source)).toEqual(['./a', './b', './e', './f', './h', './side', './indented', './j', './star', './k']);
  });
});

describe('the living dragon is lazily loaded', () => {
  it('no game module outside living/ imports LivingDragon or a living/ module other than the still tint and the stages statically', () => {
    const files = walk('src').filter((f) => !f.startsWith('src/lab/') && !f.startsWith('src/lib/living/') && !f.endsWith('/LivingDragon.svelte'));
    const bad: string[] = [];
    for (const f of files) {
      for (const m of staticImports(readFileSync(f, 'utf-8'))) {
        const spec = m.replace(/\.ts$/, '');
        if (LAZY.test(spec) && !EAGER_OK.test(spec)) bad.push(`${f}: ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the still tint and the stages pull no other living/ module in', () => {
    for (const f of ['src/lib/living/stillTint.ts', 'src/lib/living/tint.ts', 'src/lib/living/stages.ts']) {
      const specs = staticImports(readFileSync(f, 'utf-8'));
      expect(specs.filter((s) => s.startsWith('./') && !/^\.\/(tint|stages)$/.test(s)), f).toEqual([]);
    }
  });

  it('DragonFigure imports LivingDragon dynamically', () => {
    expect(readFileSync('src/components/DragonFigure.svelte', 'utf-8')).toMatch(/import\(\s*['"]\.\/LivingDragon\.svelte['"]\s*\)/);
  });
});

// The battle screens (Play, Boss and the battle stage under them) are their own chunk (ruling O1):
// App.svelte loads them as soon as a hero is open, and no module imports them statically.
describe('the battle screens are lazily loaded', () => {
  it('no module imports Play.svelte or Boss.svelte statically', () => {
    const bad: string[] = [];
    for (const f of walk('src')) {
      for (const spec of staticImports(readFileSync(f, 'utf-8'))) {
        const target = spec.startsWith('.') ? posix.join(posix.dirname(f), spec) : spec;
        if (/^src\/screens\/(Play|Boss)\.svelte$/.test(target)) bad.push(`${f}: ${spec}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('App.svelte imports them dynamically', () => {
    const app = readFileSync('src/App.svelte', 'utf-8');
    expect(app).toMatch(/import\(\s*['"]\.\/screens\/Play\.svelte['"]\s*\)/);
    expect(app).toMatch(/import\(\s*['"]\.\/screens\/Boss\.svelte['"]\s*\)/);
  });
});
