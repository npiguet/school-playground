// Ruling F3(b) + U4-b: the crash-only retry counts crashGuard's named browser crash and a Playwright
// worker or browser segfault as crashes; every other failure stays a failure (never retried).
import { describe, expect, it } from 'vitest';
import { BROWSER_CRASHED, DURING_BODY, crashedWith, isCrash } from '../e2e/crashClassify';

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

  it('classifies a test as crashed when a crash and only its aftermath failed it', () => {
    const crash = { message: `${BROWSER_CRASHED}: page crashed at http://app/#/camp` };
    expect(crashedWith([{ message: 'Test timeout of 60000ms exceeded.' }, { message: `${BROWSER_CRASHED}: browser disconnected` }])).toBe(true);
    expect(crashedWith([{ message: 'locator.click: Target crashed' }, crash])).toBe(true);
    expect(crashedWith([{ message: 'page.goto: Target page, context or browser has been closed' }, crash])).toBe(true);
    expect(crashedWith([{ message: 'Test timeout of 60000ms exceeded.' }, {}])).toBe(false);
    expect(crashedWith([])).toBe(false);
  });

  // UI5 Task 9 gate: the page crashed mid-test and the pending `expect` failed at once, with an empty
  // call log instead of « Target crashed ». A crash seen while the body still ran explains whatever
  // failed the body: the body stops at its first failure, so that failure came at or after the crash.
  it('counts any body failure as aftermath when the page crashed while the body ran', () => {
    const during = { message: `${BROWSER_CRASHED}: page crashed at http://app/#/play/1 ${DURING_BODY}` };
    expect(crashedWith([{ message: 'expect(locator).toHaveAttribute(expected) failed\n\nReceived: ""' }, during])).toBe(true);
    // Crashed after the body ended (at teardown): M21's rule holds.
    const after = { message: `${BROWSER_CRASHED}: page crashed at http://app/#/play/1` };
    expect(crashedWith([{ message: 'expect(locator).toHaveAttribute(expected) failed' }, after])).toBe(false);
    // The marker alone, in a message that is no crash, counts for nothing.
    expect(crashedWith([{ message: `expect(received).toContain(expected): ${DURING_BODY}` }])).toBe(false);
  });

  it('never retries a real failure that a crash happened to follow (final review M21)', () => {
    const segfault = { message: 'Error: worker process exited unexpectedly (code=null, signal=SIGSEGV)' };
    expect(crashedWith([{ message: 'expect(locator).toHaveText(expected) failed' }, segfault])).toBe(false);
    expect(crashedWith([{ message: 'expect(received).toEqual(expected)' }, { message: `${BROWSER_CRASHED}: browser disconnected` }])).toBe(false);
  });
});
