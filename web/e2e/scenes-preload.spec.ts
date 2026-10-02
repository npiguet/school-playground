import { test, expect } from './crashGuard';
import { createProfileApi, expectCamp, expectScene, heroNamer, tap, watchNests } from './helpers';

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

test("the camp warms the nest painting of the dragon's stage, even when /camp arrives after the warm-up timer (spec 2026-10-02 nest by stage)", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage: 'illustre', name: 'Braise' };
    camp.xp = { ...camp.xp, total: 20000, floor: 15000, next: 40000 };
    await new Promise((r) => setTimeout(r, 1500)); // after SceneStage's 800 ms warm-up timer
    await route.fulfill({ response: res, json: camp });
  });
  const nests = watchNests(page);
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  // The stage's nest is warmed; once it has arrived and no nest painting is still on its way, the
  // whole list is that one (no stale nest.webp, no other stage), not a wait for a first match.
  await expect.poll(() => nests.fetched.includes('nest_illustre')).toBe(true);
  await expect.poll(() => nests.pending.size).toBe(0);
  expect(nests.fetched).toEqual(['nest_illustre']);
});
