import { defineConfig, devices } from '@playwright/test';

// Playability walks (scenes spec §10): one long test per iPad orientation. Screenshots go to a
// scratch dir under web/test-results, or to the tracked docs/reviews/<milestone>/ baseline with
// WALK_OUT (playability-ui3.spec.ts's header has both commands). Run with
// scripts/playwright.sh --config playwright.playability.config.ts playability-ui3
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/playability*.spec.ts'],
  timeout: 600_000,
  retries: 0,
  reporter: [['list']],
  // The same stall budget as playwright.config.ts (its `expect` comment says why).
  expect: { timeout: 15_000 },
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    locale: 'fr-CH',
    ...devices['iPad Pro 11'],
    hasTouch: true,
    // 1× screenshots: the review reads them, and 2× PNGs would put ~30 MB into the repo.
    deviceScaleFactor: 1,
  },
  projects: [
    {
      name: 'ipad-landscape',
      use: { ...devices['iPad Pro 11 landscape'], viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 },
    },
    {
      name: 'ipad-portrait',
      use: { ...devices['iPad Pro 11'], viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1 },
    },
  ],
});
