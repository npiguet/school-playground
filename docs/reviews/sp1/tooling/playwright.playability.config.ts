import { defineConfig, devices } from '@playwright/test';

// Playability walk (spec §6.2): one long test per iPad orientation, screenshots into
// docs/reviews/sp1/. Run with scripts/playwright.sh --config playwright.playability.config.ts
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/playability.spec.ts'],
  timeout: 240_000,
  retries: 0,
  reporter: [['list']],
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
