// Ruling F3(b): a browser crash is only told apart from a real failure (and retried once) when the
// test runs under e2e/crashGuard.ts's fixture. A spec taking `test` straight from
// '@playwright/test' would lose that: its crashes would fail the gate as plain errors.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const E2E = fileURLToPath(new URL('../e2e', import.meta.url));
const specs = readdirSync(E2E).filter((n) => n.endsWith('.spec.ts'));

/** The files whose value imports from '@playwright/test' (type-only imports are fine). */
function bareImports(files: Record<string, string>): string[] {
  return Object.entries(files)
    .filter(([, text]) => /^import\s+(?!type\s)[^;]*from\s+'@playwright\/test'/m.test(text) || !text.includes("from './crashGuard'"))
    .map(([name]) => name);
}

/** The files that make a soft assertion (`expect.soft`, or `expect.configure({ soft: true })`). */
function softAssertions(files: Record<string, string>): string[] {
  return Object.entries(files)
    .filter(([, text]) => /\bexpect\s*\.\s*soft\b|\bsoft\s*:\s*true\b/.test(text))
    .map(([name]) => name);
}

// Ruling F3b: the crash-only retry counts every failure of a body that crashed as the crash's
// aftermath, because a body stops at its first failure. A soft assertion would let a real failure
// come first and the body run on into a crash, and the retry would turn it green.
describe('no e2e source makes a soft assertion (Ruling F3b)', () => {
  it('uses no expect.soft anywhere under e2e, nor in the Playwright configs', () => {
    const e2eFiles = readdirSync(E2E).filter((n) => n.endsWith('.ts')).map((n) => join(E2E, n));
    const configs = readdirSync(join(E2E, '..')).filter((n) => /^playwright.*\.config\.ts$/.test(n)).map((n) => join(E2E, '..', n));
    expect(configs.length).toBeGreaterThan(0);
    const files = Object.fromEntries([...e2eFiles, ...configs].map((p) => [p, readFileSync(p, 'utf8')]));
    expect(softAssertions(files)).toEqual([]);
  });

  it('flags expect.soft and a soft expect.configure (self-test)', () => {
    expect(
      softAssertions({
        'a.spec.ts': 'await expect.soft(page).toHaveURL(/x/);\n',
        'b.spec.ts': 'const e = expect.configure({ soft: true });\n',
        'c.spec.ts': "await expect(page).toHaveURL(/x/); // a soft landing is not an assertion\n",
      }),
    ).toEqual(['a.spec.ts', 'b.spec.ts']);
  });
});

describe('every e2e spec runs under the crash guard', () => {
  it('takes test and expect from ./crashGuard, never from @playwright/test', () => {
    expect(specs.length).toBeGreaterThan(10);
    const files = Object.fromEntries(specs.map((n) => [n, readFileSync(join(E2E, n), 'utf8')]));
    expect(bareImports(files)).toEqual([]);
  });

  it('flags a spec that imports test from @playwright/test, and one that skips the guard', () => {
    expect(
      bareImports({
        'bare.spec.ts': "import { test, expect } from '@playwright/test';\n",
        'types.spec.ts': "import { test } from './crashGuard';\nimport type { Page } from '@playwright/test';\n",
        'none.spec.ts': "import { chooseLevel } from './helpers';\n",
      }),
    ).toEqual(['bare.spec.ts', 'none.spec.ts']);
  });
});
