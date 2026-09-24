import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/playability.spec.ts', '**/playability-sp2.spec.ts'],
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    locale: 'fr-CH',
    screenshot: 'only-on-failure',
    ...devices['Desktop Safari'],
  },
});
