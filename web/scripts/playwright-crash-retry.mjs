// `npx playwright test <args>`, plus Ruling F3(b)'s crash-only retry: when every failure of the run
// is « browser crashed (upstream WebKit) » (e2e/crashGuard.ts), those tests - and the rest of a
// serial group that holds one - run once more, with the same arguments. Any other failure, or an
// error outside the tests, ends the run red at once: it never retries. Playwright's own `retries`
// stays 0. The run's crash summary comes from e2e/crashReporter.ts (only playwright.config.ts
// registers it: a config without it just runs once).
// Used by scripts/playwright.sh inside the Playwright container, from web/.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SUMMARY = 'test-results/crash-summary.json';
const args = process.argv.slice(2);

function playwright(extra) {
  const run = spawnSync('npx', ['playwright', 'test', ...args, ...extra], { stdio: 'inherit' });
  return run.status ?? 1;
}

rmSync(SUMMARY, { force: true });
const status = playwright([]);
if (status === 0 || !existsSync(SUMMARY)) process.exit(status);

const summary = JSON.parse(readFileSync(SUMMARY, 'utf8'));
if (summary.status !== 'failed' || summary.crashed.length === 0) process.exit(status);
if (summary.otherFailures.length || summary.runErrors.length) {
  console.log(`\n== crash-only retry: not retrying, the run has failures other than a browser crash`);
  process.exit(status);
}

console.log(`\n== crash-only retry: the browser crashed (upstream WebKit) in ${summary.crashed.length} test(s):`);
for (const t of summary.crashed) console.log(`   ${t}`);
console.log(`== running ${summary.rerun.failedTests.length} test(s) once more (the crashed ones and their serial groups)\n`);
const list = join(tmpdir(), `crash-rerun-${process.pid}.json`);
writeFileSync(list, JSON.stringify(summary.rerun));
const again = playwright(['--last-failed', '--last-failed-file', list]);
rmSync(list, { force: true });
process.exit(again);
