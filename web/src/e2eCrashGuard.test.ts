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
