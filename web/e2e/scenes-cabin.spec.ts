import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import {
  closeOverlay,
  createProfileApi,
  expectCamp,
  expectInSafeZone,
  expectInWorldOverlay,
  expectScene,
  labelOverlaps,
  redScan,
  tap,
  uniqueName,
} from './helpers';

// UI3b Tasks 5-6 (scenes spec §3 Cabin, §10). desktop + ipad.

const PLACES = ['cabin-trophies', 'cabin-journal', 'cabin-lyre'];
const heroName = (project: string) => uniqueName(`Cabane-${project}`);

async function openCabin(page: Page, id: number) {
  await page.goto(`/#/p/${id}/cabane`);
  await expectScene(page, 'cabin');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

test('the cabin: its own room, three places, the exit', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await expect(page.locator('[data-testid="scene-cabin"] .stage-plaque')).toHaveText('Ta cabane');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/cabin.webp');
  for (const p of PLACES) await expect(page.getByTestId(p)).toBeVisible();
  await expect(page.getByTestId('cabin-trophies')).toContainText('Aucun trésor encore');
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

test('the trophy shelf shows every reward, each known in advance', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await tap(page.getByTestId('cabin-trophies'), testInfo);
  await expect(page).toHaveURL(/\/cabane\?panel=tresors$/);
  const shelf = page.getByTestId('overlay-trophies');
  await expect(shelf.getByRole('heading', { name: 'Tes trésors', level: 2 })).toBeVisible();
  for (const section of ['Reliques', 'Armes et armures divines', 'Objets de la cabane', 'Teintes']) {
    await expect(shelf.getByRole('heading', { name: section, level: 3 })).toBeVisible();
  }
  const sandals = shelf.getByTestId('cabin-reward-sandales_hermes');
  await expect(sandals).toHaveAttribute('data-owned', 'false');
  await expect(sandals).toContainText("Comment l'obtenir");
  await expect(sandals.locator('.medallion')).toHaveAttribute('aria-label', 'Récompense à découvrir');
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/cabane$/);
  await expect(page.getByTestId('cabin-trophies')).toBeFocused();
});

test('overlay-trophies: an in-world table, clear of the HUD, 48 px targets, kit classes only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  await expectInWorldOverlay(page, 'overlay-trophies', 'cabin', true, 'table', null);
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openCabin(page, id);
    await expectInSafeZone(page, 'cabin', PLACES);
    expect(await labelOverlaps(page, 'cabin'), `${size.width}x${size.height}`).toEqual([]);
  }
});

test('cabin: ?debug outlines three places; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(3);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});
