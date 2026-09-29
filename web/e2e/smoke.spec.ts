import { test, expect } from './crashGuard';
test('serves the SPA and the API', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('La Discorde');
});

// The browser keeps nothing the game serves (server/app/static.py), so a new build shows at the next load.
test('the page and its files are never stored by the browser; the API keeps its own headers', async ({ page, request }) => {
  const res = await page.goto('/');
  expect(res!.headers()['cache-control']).toBe('no-store');
  const bundle = await page.locator('script[type="module"][src^="/assets/"]').first().getAttribute('src');
  for (const path of [bundle!, '/manifest.json', '/art/scenes/hub_camp.webp', '/some/deep/route']) {
    expect((await request.get(path)).headers()['cache-control'], path).toBe('no-store');
  }
  expect((await request.get('/api/health')).headers()['cache-control']).toBeUndefined();
});

// Kokoro plan Task 5: the e2e stack runs the voice's stub (TTS_STUB=1), reached through the game server.
// Both images carry the same build stamp (scripts/lib.sh), and the voice's passes through its proxy.
test('the voice is reached through the game server, as its stub', async ({ request }) => {
  const res = await request.get('/api/tts/health');
  expect(res.status()).toBe(200);
  const { build } = await (await request.get('/api/health')).json();
  expect(await res.json()).toEqual({ voice: 'ready', engine: 'stub', build });
});
