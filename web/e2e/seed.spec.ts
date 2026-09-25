import { test, expect } from './crashGuard';

test('image serves API, SPA assets, PWA files and seed texts', async ({ request }) => {
  expect((await request.get('/api/health')).ok()).toBeTruthy();
  expect((await request.get('/manifest.json')).ok()).toBeTruthy();
  expect((await request.get('/icons/icon-192.png')).ok()).toBeTruthy();
  const texts = await (await request.get('/api/texts')).json();
  expect(texts.length).toBeGreaterThanOrEqual(25);
  const seed = texts.filter((t: { source: string }) => t.source === 'seed');
  expect(seed.length).toBeGreaterThanOrEqual(25);
  expect(seed.some((t: { credits: string }) => /trad\. /.test(t.credits))).toBeTruthy();
  const full = await (await request.get(`/api/texts/${seed[0].id}`)).json();
  expect(full.annotation.tokens.length).toBeGreaterThan(50);
  expect(full.annotation.model).toBe('core_news_lg');

  // Controller verification: the server annotates exactly the stored body served to the
  // client, so every token's [start, end) offsets must slice `full.body` back to its own text.
  for (const tok of full.annotation.tokens) {
    expect(full.body.slice(tok.start, tok.end)).toBe(tok.text);
  }
});
