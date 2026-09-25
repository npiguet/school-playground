import { defineConfig, devices } from '@playwright/test';

// Main e2e run (scripts/playwright.sh, part of scripts/check.sh), two WebKit projects (scenes
// spec §10): `desktop` runs every functional spec (Desktop Safari 1280x720, the pre-UI1 setup);
// `ipad` runs the scene specs (scenes-*.spec.ts) at iPad landscape 1180x820 with touch.
// Playability walks (playability*.spec.ts) write review screenshots and only run through
// playwright.playability.config.ts.
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/playability*.spec.ts'],
  timeout: 60_000,
  retries: 0,
  // Every worker drives the same single app container (compose.e2e.yaml), and Alexandria refreshes
  // run spaCy on it: at 24 concurrent workers that container can no longer answer in time. Cap the
  // worker count so the suite's load doesn't depend on the host's core count (Playwright's default
  // is half the cores). The specs themselves stay correct at any count (proven at 12).
  workers: 8,
  reporter: [['list']],
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
