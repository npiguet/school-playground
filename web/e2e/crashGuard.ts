import { test as base, expect } from '@playwright/test';

// Ruling F3(b): WPE WebKit's web process crashes about once in 1 300 test executions (an upstream
// fault in libWPEWebKit, docs/reviews/ui3/webkit-crash-upstream.md). A test whose browser crashed
// fails with this named error, and only such a test is run once more, by
// scripts/playwright-crash-retry.mjs (Playwright's own `retries` stays 0: every other failure is a
// defect and never retries). Every spec imports `test` from here, not from '@playwright/test'
// (guarded by src/e2eCrashGuard.test.ts).
export const BROWSER_CRASHED = 'browser crashed (upstream WebKit)';

export const test = base.extend({
  // Watches every page of the test's context (the default page and any popup) for a renderer
  // crash, and the browser for a disconnect. Checked after the test body, whether it passed or not:
  // a crash makes the body fail on whatever it was doing ("Target crashed", a closed page, a
  // timeout), and this error names the cause next to it.
  context: async ({ context, browser }, use) => {
    const crashes: string[] = [];
    const watch = (page: import('@playwright/test').Page) =>
      page.on('crash', () => crashes.push(`page crashed at ${page.url()}`));
    context.pages().forEach(watch);
    context.on('page', watch);
    const onDisconnect = () => crashes.push('browser disconnected');
    browser.on('disconnected', onDisconnect);
    await use(context);
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    browser.off('disconnected', onDisconnect);
    if (crashes.length) throw new Error(`${BROWSER_CRASHED}: ${crashes.join('; ')}`);
  },
  // A route handler (a spec's /camp fixture, onlyOwnProphecy) can still be in flight when the body
  // ends: the page refetches /camp after the last assertion, the page closes under the handler's
  // route.fetch()/json(), and its « Response has been disposed » failed a test whose assertions had
  // all passed (scenes-war's foiled lieutenant, 1 run in 460). Before the page closes, unroute and
  // let a handler cut short fail silently (Playwright's documented `ignoreErrors`).
  page: async ({ page }, use) => {
    await use(page);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  },
});

export { expect };
