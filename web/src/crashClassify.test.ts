// Ruling F3(b) + U4-b: the crash-only retry counts crashGuard's named browser crash and a Playwright
// worker or browser segfault as crashes; every other failure stays a failure (never retried).
import { describe, expect, it } from 'vitest';
import { BROWSER_CRASHED, crashedWith, isCrash } from '../e2e/crashClassify';

describe('the crash-only retry classifier', () => {
  it("counts crashGuard's named error", () => {
    expect(isCrash(`${BROWSER_CRASHED}: page crashed at http://app/#/camp`)).toBe(true);
    expect(isCrash(`${BROWSER_CRASHED}: browser disconnected`)).toBe(true);
  });

  it('counts a worker or browser segfault (lane V gate, 2026-09-26)', () => {
    expect(isCrash('Error: worker process exited unexpectedly (code=null, signal=SIGSEGV)')).toBe(true);
    expect(isCrash('browserType.launch: Browser closed.\n==================== Browser output: ====================\n<process did exit: exitCode=null, signal=SIGSEGV>')).toBe(true);
  });

  it('never counts a real failure, a timeout or another signal', () => {
    expect(isCrash('expect(locator).toHaveText(expected) failed')).toBe(false);
    expect(isCrash('Test timeout of 60000ms exceeded.')).toBe(false);
    expect(isCrash('Error: worker process exited unexpectedly (code=1, signal=null)')).toBe(false);
    expect(isCrash('Error: worker process exited unexpectedly (code=null, signal=SIGKILL)')).toBe(false);
    // A segfault mentioned by the app under test is not the machinery crashing.
    expect(isCrash('expect(received).toContain(expected): SIGSEGV')).toBe(false);
  });

  it('classifies a test by any of its errors', () => {
    expect(crashedWith([{ message: 'Test timeout of 60000ms exceeded.' }, { message: `${BROWSER_CRASHED}: browser disconnected` }])).toBe(true);
    expect(crashedWith([{ message: 'Test timeout of 60000ms exceeded.' }, {}])).toBe(false);
    expect(crashedWith([])).toBe(false);
  });
});
