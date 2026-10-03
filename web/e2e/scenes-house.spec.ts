// Spec 2026-09-29 drachmes §3, §6 and spec 2026-10-02 house treasures: buy the villa at the stall,
// put a sixth piece on display in it; each house empty, then with every treasure at its place,
// photographed for review. desktop + ipad.
import { test, expect } from './crashGuard';
import type { APIRequestContext, Page } from '@playwright/test';
import { createProfileApi, createText, expectPiecesClear, expectScene, heroNamer, labelOverlaps, makeResult, postSession, redScan, swissDay, tap, uniqueName } from './helpers';

const heroName = heroNamer('Maison');
const QUEST_DECOR = ['decor:lanterne', 'decor:tapis'];
const SHOP_DECOR = ['decor:amphore', 'decor:chouette', 'decor:mosaique', 'decor:bouclier'];
const LTS = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'];
const GEAR = ['sandales_hermes', 'egide', 'foudre_zeus'];
const NINE = ['lanterne', 'tapis', 'bibliotheque', 'trophee', 'fresque', 'amphore', 'chouette', 'mosaique', 'bouclier'].map((k) => `decor:${k}`);
const SIZES = [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }];

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

/** The room at rest (no entrance or tour zoom: the art fills the 1280-wide frame), photographed. */
async function restedShot(page: Page, path: string) {
  await expect.poll(() => page.locator('[data-testid="scene-cabin"] .art-bg').evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(1280);
  await page.screenshot({ path });
}

test('buy the villa at the stall: the room follows the house, a sixth piece from the shelf', async ({ page, request }, testInfo) => {
  const id = await wealthyHero(request, heroName(testInfo.project.name));
  const camp = await (await request.get(`/api/profiles/${id}/camp`)).json();
  expect(camp.dragon.stage).toBe('adult');
  // Four pieces from Hermès; five pieces on display (the lantern, the carpet, three of his).
  for (const item of SHOP_DECOR) expect((await request.post(`/api/profiles/${id}/purchases`, { data: { item } })).status()).toBe(201);
  for (const item of [...QUEST_DECOR, ...SHOP_DECOR.slice(0, 3)]) {
    expect((await request.patch(`/api/profiles/${id}/rewards/${item}`, { data: { equipped: true } })).status()).toBe(200);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/cabin.webp');
  // Five pieces of decor in the cabin, one more than its old four walls held.
  await expect(page.locator('[data-testid^="cabin-piece-decor:"]')).toHaveCount(5);
  await expectPiecesClear(page, { width: 1280, height: 720 });
  // The villa, bought at the stall.
  await page.goto(`/#/p/${id}/camp?panel=etal`);
  const villa = page.getByTestId('overlay-stall').getByTestId('stall-item-house:villa');
  await tap(villa.getByTestId('stall-buy-house:villa'), testInfo);
  await expect(villa).toContainText('Acheter la villa pour 300 drachmes\u202f?');
  await tap(villa.getByTestId('stall-confirm'), testInfo);
  await expect(villa).toHaveAttribute('data-state', 'owned');
  await expect(page.getByTestId('overlay-stall').getByTestId('stall-item-house:palais')).toContainText('Quand ton dragon sera illustre.');
  // The camp's plaque and the room follow the house.
  await page.goto(`/#/p/${id}/camp`);
  await expect(page.getByTestId('camp-cabin')).toContainText('Ta villa');
  for (const size of SIZES.slice(0, 2)) {
    await page.setViewportSize(size);
    await expect.poll(() => labelOverlaps(page, 'camp'), { message: `camp ${size.width}x${size.height}` }).toEqual([]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/p/${id}/cabane`);
  await expectScene(page, 'cabin');
  await expect(page.locator('[data-testid="scene-cabin"] .stage-plaque')).toHaveText('Ta villa');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/villa.webp');
  await expect(page.locator('[data-testid^="cabin-piece-decor:"]')).toHaveCount(5);
  // The sixth piece, from the shelf: it stands in the room as soon as the shelf closes.
  await tap(page.getByTestId('cabin-trophies'), testInfo);
  await expect(page.getByTestId('overlay-trophies').getByRole('heading', { level: 3 })).toContainText(['Objets de la villa']);
  await tap(page.getByTestId('cabin-equip-decor:bouclier'), testInfo);
  await expect(page.getByTestId('cabin-equip-decor:bouclier')).toHaveText('Ranger');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-trophies')).toHaveCount(0);
  await expect(page.locator('[data-testid^="cabin-piece-decor:"]')).toHaveCount(6);
  await expect(page.getByTestId('cabin-piece-decor:bouclier')).toBeVisible();
  for (const size of SIZES.slice(0, 2)) {
    await page.setViewportSize(size);
    await expect.poll(() => labelOverlaps(page, 'cabin'), { message: `${size.width}x${size.height}` }).toEqual([]);
    await expectPiecesClear(page, size);
  }
  expect(await redScan(page)).toEqual([]);
});

// Spec 2026-10-02 house treasures, "e2e: screenshots of each house empty and full for review".
for (const house of ['cabin', 'villa', 'palais'] as const) {
  test(`${house}: the empty fixtures, then every treasure at its place`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    const row = (rid: string, kind: string, equipped: boolean) => ({ id: rid, kind, name: rid, desc: '', source: '', granted_at: '2026-09-30T10:00:00', equipped });
    let rows: object[] = [];
    // The camp names the house, and counts the rewards the room shows (the shelf's caption).
    await page.route(`**/api/profiles/${id}/camp`, async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, json: { ...(await res.json()), house, rewards_count: rows.length } });
    });
    await page.route(`**/api/profiles/${id}/rewards`, (route) => route.fulfill({ json: rows }));
    await page.setViewportSize({ width: 1280, height: 720 });
    // Empty: the painted fixtures only (the first visit's tour skipped).
    await page.goto(`/#/p/${id}/cabane`);
    await expectScene(page, 'cabin');
    await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', `/art/scenes/${house}.webp`);
    await tap(page.getByTestId('dialogue-skip'), testInfo);
    await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
    await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(0);
    await restedShot(page, testInfo.outputPath(`${house}-empty.png`));
    // Full: every lieutenant's trophy (seals 1 to 5 and 1 again), the three gear, the nine decor.
    rows = [
      ...LTS.map((k, i) => row(`trophy:${k}:${(i % 5) + 1}`, 'trophy', false)),
      ...GEAR.map((g) => row(g, 'gear', true)),
      ...NINE.map((d) => row(d, 'decor', true)),
    ];
    await page.reload();
    await expectScene(page, 'cabin');
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    await tap(page.getByTestId('dialogue-skip'), testInfo);
    await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
    await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(18);
    for (const [i, k] of LTS.entries()) {
      const trophy = page.getByTestId(`cabin-piece-${k}`);
      await expect(trophy).toHaveAttribute('data-level', String((i % 5) + 1));
      await expect(trophy.locator('img')).toHaveAttribute('src', `/art/trophies/large/trophy-${k}-${(i % 5) + 1}.webp`);
    }
    for (const size of SIZES) {
      await page.setViewportSize(size);
      await expect.poll(() => labelOverlaps(page, 'cabin'), { message: `${size.width}x${size.height}` }).toEqual([]);
      await expectPiecesClear(page, size);
    }
    expect(await redScan(page)).toEqual([]);
    await page.setViewportSize({ width: 1280, height: 720 });
    await restedShot(page, testInfo.outputPath(`${house}-full.png`));
    await page.goto(`/#/p/${id}/cabane?debug`);
    await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(3);
    await expect(page.locator('[data-testid^="cabin-place-"]')).toHaveCount(18);
    await restedShot(page, testInfo.outputPath(`${house}-debug.png`));
  });
}
