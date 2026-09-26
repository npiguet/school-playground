// Ruling F3(b), widened by Ruling U4-b: which test failures are crashes of the machinery under the
// test rather than failures of the test, so scripts/playwright-crash-retry.mjs runs them once more.
// Pure (no Playwright import), so src/crashClassify.test.ts unit-tests it.
// - crashGuard.ts's named error: WPE WebKit's web process crashed, or the browser disconnected;
// - a segfault of the Playwright worker (« worker process exited unexpectedly (code=null,
//   signal=SIGSEGV) », seen once in lane V's gate at 0 ms, before the test body ran) or of the
//   browser process (its launch or close error carries the signal).
// Any other failure, a timeout or another signal included, is a defect and never retries.
export const BROWSER_CRASHED = 'browser crashed (upstream WebKit)';

const SEGFAULT = /\bSIGSEGV\b/;
const CRASHED_PROCESS = /worker process exited unexpectedly|browser/i;

export function isCrash(message: string): boolean {
  if (message.includes(BROWSER_CRASHED)) return true;
  return SEGFAULT.test(message) && CRASHED_PROCESS.test(message);
}

// What a crash does to the test body next to it (crashGuard.ts: the body fails on whatever it was
// doing, "Target crashed", a closed page or browser, a timeout). Nothing else rides along with one.
const AFTERMATH = /Target crashed|Page crashed|(?:Target page, context or browser|Browser) has been closed|browser has disconnected|Test timeout of \d+ms exceeded/i;

/** A test crashed when one of its errors is a crash and every other one is only what the crash did
 *  to the body (final review M21): a real assertion failure followed by a teardown segfault stays a
 *  failure, never retried into a green. */
export const crashedWith = (errors: { message?: string }[]): boolean =>
  errors.some((e) => isCrash(e.message ?? '')) &&
  errors.every((e) => isCrash(e.message ?? '') || AFTERMATH.test(e.message ?? ''));
