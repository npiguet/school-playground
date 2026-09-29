import { test, expect } from './crashGuard';
import { createProfileApi, expectCamp, expectScene, heroNamer, tap } from './helpers';

// The server tells the browser to store nothing (server/app/static.py, `no-store`), so the camp's
// warm-up of the next places (SceneStage's preload, spec §4 performance) only helps if the page itself
// keeps what it fetched: entering the tent must not fetch its painting a second time.
const heroName = heroNamer('Avance');

test('a place the camp warmed up opens without fetching its painting again', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const fetched: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/art/scenes/library_tent.webp')) fetched.push(r.url());
  });
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect.poll(() => fetched.length).toBe(1);
  await tap(page.getByTestId('camp-parchemins'), testInfo);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expectScene(page, 'library');
  await expect(page.locator('img.art-bg[src="/art/scenes/library_tent.webp"]')).toHaveJSProperty('complete', true);
  expect(fetched).toHaveLength(1);
});