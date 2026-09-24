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
  ],
});
