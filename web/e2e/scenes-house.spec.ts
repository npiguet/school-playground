// Spec 2026-09-29 drachmes §3, §6: buy the villa, hang a sixth piece of decor in it; the palais's room.
// desktop + ipad.
import { test, expect } from './crashGuard';
import type { APIRequestContext, Page } from '@playwright/test';
import { createProfileApi, createText, expectScene, heroNamer, labelOverlaps, makeResult, postSession, redScan, swissDay, tap, uniqueName } from './helpers';

const heroName = heroNamer('Maison');
const QUEST_DECOR = ['decor:lanterne', 'decor:tapis'];
const SHOP_DECOR = ['decor:amphore', 'decor:chouette', 'decor:mosaique', 'decor:bouclier'];

/** Twelve 3 000-word sessions through four board quests against the Hydra: an adult dragon (about
 *  11 000 XP), the lantern and the carpet (two and four quests), about 1 100 drachmes. */
async function wealthyHero(request: APIRequestContext, name: string): Promise<number> {
  const id = await createProfileApi(request, name);
  const text = await createText(request, { title: uniqueName(`Maison ${name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  for (let q = 0; q < 4; q++) {
    expect((await request.post(`/api/profiles/${id}/quests`, { data: { target: 'hydre' } })).status()).toBe(201);
    for (let s = 0; s < 3; s++) {
      await postSession(request, { profileId: id, textId: text.id, day: swissDay(0), result: makeResult({ words: 3000, draft: 4, caught: 4, category: 'agreement:verb' }) });
    }
  }
  return id;
}

/** The room at rest (no entrance or tour zoom: the art fills the 1280-wide frame), photographed for
 *  a look at the debug outlines and the hung pieces. */
async function restedShot(page: Page, path: string) {
  await expect.poll(() => page.locator('[data-testid="scene-cabin"] .art-bg').evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(1280);
  await page.screenshot({ path });
}

test('buy the villa at the stall, hang a sixth piece in it', async ({ page, request }, testInfo) => {
  const id = await wealthyHero(request, heroName(testInfo.project.name));
  const camp = await (await request.get(`/api/profiles/${id}/camp`)).json();
  expect(camp.dragon.stage).toBe('adult');
  // Four pieces from Hermès; the cabin's four walls full first (the lantern, the carpet, two of his).
  for (const item of SHOP_DECOR) expect((await request.post(`/api/profiles/${id}/purchases`, { data: { item } })).status()).toBe(201);
  for (const item of [...QUEST_DECOR, ...SHOP_DECOR.slice(0, 2)]) {
    expect((await request.patch(`/api/profiles/${id}/rewards/${item}`, { data: { equipped: true } })).status()).toBe(200);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/cabin.webp');
  await expect(page.locator('[data-testid^="cabin-decor-"]')).toHaveCount(4);
  // (?debug: no tour, no greeting.)
  await expectMedalsOffPlaques(page, { width: 1280, height: 720 });
  await restedShot(page, testInfo.outputPath('cabin-debug.png'));
  // The villa, bought at the stall.
  await page.goto(`/#/p/${id}/camp?panel=etal`);
  const villa = page.getByTestId('overlay-stall').getByTestId('stall-item-house:villa');
  await tap(villa.getByTestId('stall-buy-house:villa'), testInfo);
  await expect(villa).toContainText('Acheter la villa pour 300 drachmes\u202f?');
  await tap(villa.getByTestId('stall-confirm'), testInfo);
  await expect(villa).toHaveAttribute('data-state', 'owned');
  await expect(page.getByTestId('overlay-stall').getByTestId('stall-item-house:palais')).toContainText('Quand ton dragon sera illustre.');
  // The villa's fifth piece through the API.
  expect((await request.patch(`/api/profiles/${id}/rewards/${SHOP_DECOR[2]}`, { data: { equipped: true } })).status()).toBe(200);
  // The camp's plaque and the room follow the house.
  await page.goto(`/#/p/${id}/camp`);
  await expect(page.getByTestId('camp-cabin')).toContainText('Ta villa');
  await page.goto(`/#/p/${id}/cabane`);
  await expectScene(page, 'cabin');
  await expect(page.locator('[data-testid="scene-cabin"] .stage-plaque')).toHaveText('Ta villa');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/villa.webp');
  // The sixth piece, from the shelf.
  await tap(page.getByTestId('cabin-trophies'), testInfo);
  await tap(page.getByTestId('cabin-equip-decor:bouclier'), testInfo);
  await expect(page.getByTestId('cabin-equip-decor:bouclier')).toHaveText('Ranger');
  await expect(page.getByTestId('cabin-walls-full')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-trophies')).toHaveCount(0);
  await expect(page.locator('[data-testid^="cabin-decor-"]')).toHaveCount(6);
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size);
    expect(await labelOverlaps(page, 'cabin'), `${size.width}x${size.height}`).toEqual([]);
    await expectMedalsOffPlaques(page, size);
  }
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(3);
  await expect(page.locator('[data-testid^="cabin-decor-"]')).toHaveCount(6);
  await restedShot(page, testInfo.outputPath('villa-debug.png'));
});

/** No hung medallion over a place's plaque (the shelf's carries its caption, the tallest) nor under
 *  the room's name. */
async function expectMedalsOffPlaques(page: Page, size: { width: number; height: number }) {
  const plaques = await page.locator('[data-testid="scene-cabin"] :is(.hotspot-label, .stage-plaque)').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  const medals = await page.locator('[data-testid^="cabin-decor-"]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  for (const m of medals) {
    for (const p of plaques) {
      expect(m.right <= p.left || m.left >= p.right || m.bottom <= p.top || m.top >= p.bottom, `${size.width}x${size.height} ${JSON.stringify(m)} on ${JSON.stringify(p)}`).toBe(true);
    }
  }
}

test("the palais's room: its places and nine slots", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // This hero's camp says: the palais, and nine pieces on display (the room is the client's to draw;
  // buying the palais and the walls' limit are pinned by pytest).
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), house: 'palais' } });
  });
  const NINE = ['lanterne', 'tapis', 'bibliotheque', 'trophee', 'fresque', 'amphore', 'chouette', 'mosaique', 'bouclier'];
  await page.route(`**/api/profiles/${id}/rewards`, (route) =>
    route.fulfill({
      json: NINE.map((k) => ({ id: `decor:${k}`, kind: 'decor', name: k, desc: '', source: '', granted_at: '2026-09-30T10:00:00', equipped: true })),
    }),
  );
  await page.goto(`/#/p/${id}/cabane`);
  await expectScene(page, 'cabin');
  await expect(page.locator('[data-testid="scene-cabin"] .stage-plaque')).toHaveText('Ton palais');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/palais.webp');
  await expect(page.locator('[data-testid^="cabin-decor-"]')).toHaveCount(9);
  // The first visit's tour (it zooms in on each place), skipped.
  await tap(page.getByTestId('dialogue-skip'), testInfo);
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size);
    expect(await labelOverlaps(page, 'cabin'), `${size.width}x${size.height}`).toEqual([]);
    await expectMedalsOffPlaques(page, size);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(3);
  await expect(page.locator('[data-testid^="cabin-decor-"]')).toHaveCount(9);
  await restedShot(page, testInfo.outputPath('palais-debug.png'));
});
