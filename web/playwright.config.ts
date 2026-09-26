import { defineConfig, devices } from '@playwright/test';

// Main e2e run (scripts/playwright.sh, part of scripts/check.sh), three projects: two WebKit ones
// (scenes spec §10) and one Chromium. `desktop` runs every functional spec (Desktop Safari
// 1280x720, the pre-UI1 setup); `ipad` runs the scene specs (scenes-*.spec.ts) at iPad landscape
// 1180x820 with touch; `chromium` runs the one history test whose bug only Chromium shows (below).
// Playability walks (playability*.spec.ts) write review screenshots and only run through
// playwright.playability.config.ts.
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/playability*.spec.ts'],
  timeout: 60_000,
  // Never any retry: a failure is a defect (CLAUDE.md). The one exception, a test whose browser
  // crashed (upstream WebKit, Ruling F3), runs once more through scripts/playwright-crash-retry.mjs,
  // which reads what crashReporter.ts sorts out; the retry is not Playwright's.
  retries: 0,
  // Every worker drives the same single app container (compose.e2e.yaml), and Alexandria refreshes
  // run spaCy on it: at 24 concurrent workers that container can no longer answer in time. Cap the
  // worker count so the suite's load doesn't depend on the host's core count (Playwright's default
  // is half the cores). The specs themselves stay correct at any count (proven at 12).
  // PW_WORKERS (passed through by compose.e2e.yaml) lowers it for a second stack running side by
  // side, e.g. `STACK=b PW_WORKERS=4 scripts/check.sh` (README §6).
  workers: Number(process.env.PW_WORKERS) || 8,
  reporter: [['list'], ['./e2e/crashReporter.ts']],
  // Every web-first assertion (expect(locator)..., expect.poll) waits up to 15 s, not Playwright's
  // 5 s. The browser pages sometimes stall for seconds as a whole: timers, rAF, animation events and
  // fetch callbacks all stop together, in every worker at once, whenever the host itself is
  // saturated (a heavy job outside Docker; a CPU/RAM load on the Windows host reproduces 1-3 s
  // stalls, and 3-6 s ones were measured). A 5 s wait that spans such a stall fails although the
  // page is right: an overlay's fly-in is left "finished" on the panel until its `finish` event
  // runs, or a closed overlay's fade-out has not ended (overlay-flake-report.md, UI3b). 15 s
  // absorbs those stalls; something that never settles still fails. crashGuard.ts names a stall
  // next to any failure it overlaps.
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    locale: 'fr-CH',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Safari'] } },
    {
      name: 'ipad',
      testMatch: ['**/scenes-*.spec.ts'],
      use: {
        ...devices['iPad Pro 11 landscape'],
        viewport: { width: 1180, height: 820 },
        deviceScaleFactor: 1,
        hasTouch: true,
      },
    },
    // Final review I1: WebKit keeps `history.state` across a fragment `location.replace()`, while
    // Chromium (the laptops' Chrome and Edge) resets it to null as the HTML spec says - the case
    // panelNav's `replacePanel` re-tags the entry for. On WebKit alone the "save, close, Back" test
    // passes with or without the re-tag, so that one history test also runs on Chromium, where it
    // fails without it.
    {
      name: 'chromium',
      testMatch: ['**/scenes-library.spec.ts'],
      grep: /Back leaves the tent in one press/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
