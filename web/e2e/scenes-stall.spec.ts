// Spec 2026-09-29 drachmes §2 (R10-R13): Hermès's stall on the camp. desktop + ipad.
import { test, expect } from './crashGuard';
import type { Page, TestInfo } from '@playwright/test';
import {
  createProfileApi, createText, expectCamp, expectInWorldOverlay, expectLineOf, expectOverlayTapTargets,
  heroNamer, labelOverlaps, makeResult, postSession, redScan, swissDay, tap, uniqueName,
} from './helpers';

const heroName = heroNamer('Étal');

async function openStall(page: Page, id: number, testInfo: TestInfo) {
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page.getByTestId('camp-stall'), testInfo);
  await expect(page.getByTestId('overlay-stall')).toBeVisible();
  await expect(page).toHaveURL(/\/camp\?panel=etal$/);
}

test('the stall: its name on the painted stall, three shelves, everything shown ahead', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect(page.getByTestId('camp-stall')).toContainText("L'étal d'Hermès");
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    expect(await labelOverlaps(page, 'camp'), `${size.width}x${size.height}`).toEqual([]);
  }
  await openStall(page, id, testInfo);
  const stall = page.getByTestId('overlay-stall');
  await expectInWorldOverlay(page, 'overlay-stall', 'camp', true, 'table', 'hermes');
  await expectLineOf(stall.getByTestId('overlay-voice'), 'stall.enter');
  await expect(stall.getByTestId('stall-purse')).toHaveText('Ta bourse\u202f: 0 drachme');
  await expect(stall.getByRole('heading', { level: 3 })).toHaveText(['Parures du dragon', 'La maison', 'Décor']);
  const collar = stall.getByTestId('stall-item-accessory:hydre-cou');
  await expect(collar).toHaveAttribute('data-state', 'locked');
  await expect(collar).toContainText("Collier d'écailles vertes");
  await expect(collar).toContainText("Au sceau de bronze de l'Hydre");
  await expect(stall.getByTestId('stall-item-accessory:lethe-tete')).toContainText("Au sceau d'orichalque de Léthé");
  await expect(stall.getByTestId('stall-item-house:villa')).toContainText('Quand ton dragon sera adulte.');
  await expect(stall.getByTestId('stall-item-decor:amphore')).toHaveAttribute('data-state', 'short');
  await expect(stall.getByTestId('stall-item-decor:amphore')).toContainText('Encore 50 drachmes à gagner.');
  await expect(stall).not.toContainText(/niveau|promo|dernière chance|remise/i);
  await expectOverlayTapTargets(page, 'overlay-stall');
  expect(await redScan(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('overlay-stall')).toHaveCount(0);
  await expect(page.getByTestId('camp-stall')).toBeFocused();
});

test("Protée's set appears from 8H", async ({ page, request }, testInfo) => {
  const young = await createProfileApi(request, heroName(testInfo.project.name), '7H');
  await openStall(page, young, testInfo);
  await expect(page.getByTestId('stall-group-hydre')).toBeVisible();
  await expect(page.getByTestId('stall-group-protee')).toHaveCount(0);
  const older = await createProfileApi(request, heroName(testInfo.project.name), '8H');
  await openStall(page, older, testInfo);
  await expect(page.getByTestId('stall-group-protee')).toHaveText('Protée');
});

// A real purse: a 3 000-word session is worth about 910 XP, so about 91 drachmes (a 1 000-word one
// pays about 32, under one piece of decor).
test('buying asks once, Hermès thanks, the piece is owned and the purse goes down', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Étal ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  const res = await postSession(request, { profileId: id, textId: text.id, day: swissDay(0), result: makeResult({ words: 3000, draft: 4, caught: 4 }) });
  const before: number = res.progression.drachmes.balance;
  expect(before).toBeGreaterThanOrEqual(50);
  await openStall(page, id, testInfo);
  const stall = page.getByTestId('overlay-stall');
  const amphora = stall.getByTestId('stall-item-decor:amphore');
  // SP4 final review M4: the button's name says which piece, and at what price.
  await expect(amphora.getByTestId('stall-buy-decor:amphore')).toHaveAccessibleName("Acheter l'amphore peinte pour 50 drachmes");
  await tap(amphora.getByTestId('stall-buy-decor:amphore'), testInfo);
  await expect(amphora).toContainText("Acheter l'amphore peinte pour 50 drachmes\u202f?");
  await tap(amphora.getByTestId('stall-cancel'), testInfo);
  await expect(amphora).toHaveAttribute('data-state', 'on_sale');
  await expect(amphora.getByTestId('stall-buy-decor:amphore')).toBeFocused();
  await tap(amphora.getByTestId('stall-buy-decor:amphore'), testInfo);
  await tap(amphora.getByTestId('stall-confirm'), testInfo);
  await expect(amphora).toHaveAttribute('data-state', 'owned');
  await expect(amphora).toContainText('À toi');
  await expect(amphora).toBeFocused();
  await expectLineOf(stall.getByTestId('overlay-voice'), 'stall.bought.decor');
  await expect(stall.getByTestId('stall-purse')).toHaveText(`Ta bourse\u202f: ${before - 50} drachmes`);
  await expect(page.getByTestId('hud-drachmes')).toHaveText(String(before - 50));
  // The shelf in the cabin knows it: « Exposer » is there.
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  await expect(page.getByTestId('cabin-reward-decor:amphore')).toHaveAttribute('data-owned', 'true');
});

// Review focus 1: a purse spent elsewhere (another tablet) since the page was drawn.
test('a purchase refused by the server says why and the purse refreshes', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Étal ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  const res = await postSession(request, { profileId: id, textId: text.id, day: swissDay(0), result: makeResult({ words: 3000, draft: 4, caught: 4 }) });
  await openStall(page, id, testInfo);
  const stall = page.getByTestId('overlay-stall');
  await tap(stall.getByTestId('stall-buy-decor:chouette'), testInfo);
  // Meanwhile, elsewhere: the purse is spent down below 50.
  let left: number = res.progression.drachmes.balance;
  const spent: string[] = [];
  for (const item of ['decor:amphore', 'decor:mosaique', 'decor:bouclier']) {
    if (left < 50) break;
    expect((await request.post(`/api/profiles/${id}/purchases`, { data: { item } })).status()).toBe(201);
    spent.push(item);
    left -= 50;
  }
  expect(left).toBeLessThan(50);
  await tap(stall.getByTestId('stall-confirm'), testInfo);
  await expect(stall.getByTestId('stall-error')).toHaveText("Ta bourse n'est pas encore assez pleine pour cet objet.");
  await expect(stall.getByTestId('stall-purse')).toContainText(`${left} drachme`);
  const owl = stall.getByTestId('stall-item-decor:chouette');
  await expect(owl).toHaveAttribute('data-state', 'short');
  // Fix round 1 I2: the focus waits for the refresh, then stays on the piece (no « Acheter » left: its cubby).
  await expect(owl).toBeFocused();
  // What the other tablet bought is owned here too, once the refusal has refreshed the stall.
  for (const item of spent) await expect(stall.getByTestId(`stall-item-${item}`)).toHaveAttribute('data-state', 'owned');
});

// SP4 Task 5 review: what the hero owns could not be read the first time. The shelves wait (never a
// guess: an empty list would offer « Acheter » on a piece already owned), the error says so, and
// « Réessayer » asks again: the real list arrives, the piece already owned says « À toi », and the
// focus stays in the stall (not on the page, the button it was on being gone).
test('the stall could not read what is owned: it says so, and « Réessayer » brings the shelves', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Étal ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  await postSession(request, { profileId: id, textId: text.id, day: swissDay(0), result: makeResult({ words: 3000, draft: 4, caught: 4 }) });
  expect((await request.post(`/api/profiles/${id}/purchases`, { data: { item: 'decor:amphore' } })).status()).toBe(201);
  let calls = 0;
  await page.route(`**/api/profiles/${id}/rewards`, async (route) => {
    calls += 1;
    if (calls === 1) await route.abort('failed');
    else await route.continue();
  });
  await openStall(page, id, testInfo);
  const stall = page.getByTestId('overlay-stall');
  await expect(stall.getByTestId('stall-error')).toHaveText('Une erreur est survenue.');
  await expect(stall.getByTestId('stall-accessories')).toHaveCount(0);
  await expect(stall.getByTestId('stall-item-decor:amphore')).toHaveCount(0);
  await tap(stall.getByTestId('stall-retry'), testInfo);
  const amphora = stall.getByTestId('stall-item-decor:amphore');
  await expect(amphora).toHaveAttribute('data-state', 'owned');
  await expect(amphora).toContainText('À toi');
  await expect(stall.getByTestId('stall-error')).toHaveCount(0);
  await expect(stall.getByTestId('stall-retry')).toHaveCount(0);
  expect(calls).toBe(2);
  await expect(stall.getByTestId('stall-panel')).toBeFocused();
});

// SP4 final review M6: the refusal's reason stays on show even when the re-read after it fails.
test("a refused purchase keeps the server's reason when what is owned cannot be read again", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Étal ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  await postSession(request, { profileId: id, textId: text.id, day: swissDay(0), result: makeResult({ words: 3000, draft: 4, caught: 4 }) });
  let rewardsDown = false;
  await page.route(`**/api/profiles/${id}/rewards`, (route) => (rewardsDown ? route.abort('failed') : route.continue()));
  await openStall(page, id, testInfo);
  const stall = page.getByTestId('overlay-stall');
  await tap(stall.getByTestId('stall-buy-decor:chouette'), testInfo);
  // Elsewhere, the same piece is bought: this purchase is refused, and the re-read after it fails.
  expect((await request.post(`/api/profiles/${id}/purchases`, { data: { item: 'decor:chouette' } })).status()).toBe(201);
  rewardsDown = true;
  await tap(stall.getByTestId('stall-confirm'), testInfo);
  await expect(stall.getByTestId('stall-confirm')).toHaveCount(0);
  await expect(stall.getByTestId('stall-error')).toHaveText("Tu l'as déjà.");
});

// SP4 final review M2: without its catalogue, the stall says so and offers « Réessayer », never an
// endless « Hermès déballe ses marchandises… »; once the catalogue answers, the shelves come.
test('the stall could not read its catalogue: it says so, and « Réessayer » brings the shelves', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let worldDown = true;
  await page.route('**/api/world', (route) => (worldDown ? route.abort('failed') : route.continue()));
  await openStall(page, id, testInfo);
  const stall = page.getByTestId('overlay-stall');
  await expect(stall.getByTestId('stall-error')).toHaveText("Hermès ne peut pas déballer ses marchandises pour l'instant.");
  await expect(stall).not.toContainText('Hermès déballe ses marchandises');
  worldDown = false;
  await tap(stall.getByTestId('stall-retry'), testInfo);
  await expect(stall.getByTestId('stall-accessories')).toBeVisible();
  await expect(stall.getByTestId('stall-error')).toHaveCount(0);
  await expect(stall.getByTestId('stall-retry')).toHaveCount(0);
  await expect(stall.getByTestId('stall-panel')).toBeFocused();
});

// SP4 final review M2: the same for a camp that could not be reached (the stall opened from its link).
test('the stall without the camp: it says so, and « Réessayer » brings the purse and the shelves', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let campDown = true;
  await page.route(`**/api/profiles/${id}/camp`, (route) => (campDown ? route.abort('failed') : route.continue()));
  await page.goto(`/#/p/${id}/camp?panel=etal`);
  const stall = page.getByTestId('overlay-stall');
  await expect(stall.getByTestId('stall-error')).toHaveText("Hermès ne peut pas déballer ses marchandises pour l'instant.");
  campDown = false;
  await tap(stall.getByTestId('stall-retry'), testInfo);
  await expect(stall.getByTestId('stall-purse')).toHaveText('Ta bourse\u202f: 0 drachme');
  await expect(stall.getByTestId('stall-decor')).toBeVisible();
  await expect(stall.getByTestId('stall-retry')).toHaveCount(0);
});
