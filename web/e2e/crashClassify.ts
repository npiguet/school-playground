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

// crashGuard.ts appends this to its named error when the page crashed while the test body still ran
// (UI5 Task 9: a pending `expect` then fails at once with an empty call log, not « Target crashed »).
// The body stops at its first failure (the specs use no soft assertions, guarded by
// src/e2eCrashGuard.test.ts, Ruling F3b), and the mark is only set while no failure was recorded
// (crashNote), so whatever failed the body came at or after the crash: the crash explains it.
export const DURING_BODY = '(while the test body ran)';

/** What crashGuard.ts appends to a crash seen now: DURING_BODY only while the body still runs and no
 *  failure has been recorded yet (`testInfo.errors` empty; final review I4). Playwright records a
 *  failed assertion, then takes the failure screenshot and the trace and runs the hooks before any
 *  fixture teardown: a crash in that window comes after the real failure and explains nothing. */
export const crashNote = (bodyEnded: boolean, errorsSoFar: number): string =>
  !bodyEnded && errorsSoFar === 0 ? ` ${DURING_BODY}` : '';

/** A test crashed when one of its errors is a crash and every other one is only what the crash did
 *  to the body (final review M21): a real assertion failure followed by a teardown segfault stays a
 *  failure, never retried into a green. A crash that came while the body ran explains every error. */
export const crashedWith = (errors: { message?: string }[]): boolean => {
  const crashes = errors.filter((e) => isCrash(e.message ?? ''));
  if (crashes.length === 0) return false;
  if (crashes.some((e) => (e.message ?? '').includes(DURING_BODY))) return true;
  return errors.every((e) => isCrash(e.message ?? '') || AFTERMATH.test(e.message ?? ''));
};
