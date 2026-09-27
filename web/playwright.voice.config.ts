import { defineConfig, devices } from '@playwright/test';

// The real voice (spec 2026-09-27 §7, Kokoro plan Ruling K8): specs against the non-stub `tts`
// (Kokoro loaded), run with TTS_STUB=0 by scripts/check.sh (`voice-real`) and tools/tts/voice_walk.sh
// (`voice-walk`). One worker: every line is really synthesised on the CPU.
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/voice-*.spec.ts'],
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  // The same stall budget as playwright.config.ts (its `expect` comment says why).
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    locale: 'fr-CH',
    screenshot: 'only-on-failure',
    ...devices['Desktop Safari'],
  },
});
