import { test, expect } from './crashGuard';
test('serves the SPA and the API', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('La Discorde');
});

// Kokoro plan Task 5: the e2e stack runs the voice's stub (TTS_STUB=1), reached through the game server.
test('the voice is reached through the game server, as its stub', async ({ request }) => {
  const res = await request.get('/api/tts/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ voice: 'ready', engine: 'stub' });
});
