import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError } from '@playwright/test/reporter';
import { BROWSER_CRASHED } from './crashGuard';

// Ruling F3(b): sorts a run's failures into "the browser crashed" (crashGuard.ts's named error) and
// everything else, for scripts/playwright-crash-retry.mjs. It writes CRASH_SUMMARY:
// - `crashed`: tests that failed with the named error;
// - `rerun`: the tests to run once more, as a Playwright last-run file (`failedTests`) - the
//   crashed tests, plus every test of a serial group that holds one (a serial group's tests share
//   state, e.g. world.spec.ts's profile, and the ones after the crash never ran);
// - `otherFailures`: every other failed or timed-out test, and `runErrors` (errors outside any
//   test). Either one means no retry at all.
export const CRASH_SUMMARY = 'test-results/crash-summary.json';

const crashedWith = (errors: TestError[]) => errors.some((e) => (e.message ?? '').includes(BROWSER_CRASHED));

// The outermost serial describe around a test, if any (Playwright retries a serial group whole).
function serialGroup(test: TestCase): Suite | undefined {
  let group: Suite | undefined;
  for (let s: Suite | undefined = test.parent; s; s = s.parent) {
    if ((s as unknown as { _parallelMode?: string })._parallelMode === 'serial') group = s;
  }
  return group;
}

export default class CrashReporter implements Reporter {
  private root?: Suite;
  private runErrors: string[] = [];

  onBegin(_config: FullConfig, suite: Suite) {
    this.root = suite;
  }

  onError(error: TestError) {
    this.runErrors.push(error.message ?? String(error.value));
  }

  onEnd(result: FullResult) {
    const crashed: TestCase[] = [];
    const otherFailures: string[] = [];
    for (const test of this.root?.allTests() ?? []) {
      const last = test.results.at(-1);
      if (!last || last.status === 'passed' || last.status === 'skipped') continue;
      if (crashedWith(last.errors)) crashed.push(test);
      else otherFailures.push(`${test.titlePath().filter(Boolean).join(' > ')}: ${last.status}`);
    }
    const rerun = new Set<string>();
    for (const test of crashed) {
      const group = serialGroup(test);
      for (const t of group ? group.allTests() : [test]) rerun.add(t.id);
    }
    const summary = {
      status: result.status,
      crashed: crashed.map((t) => t.titlePath().filter(Boolean).join(' > ')),
      otherFailures,
      runErrors: this.runErrors,
      rerun: { status: 'failed', failedTests: [...rerun] },
    };
    mkdirSync(dirname(CRASH_SUMMARY), { recursive: true });
    writeFileSync(CRASH_SUMMARY, JSON.stringify(summary, null, 2));
  }

  printsToStdio() {
    return false;
  }
}
