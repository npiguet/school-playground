import { test, expect } from '@playwright/test';
import { createProfileApi, expectOverlayClearsScene, expectScene, tap, uniqueName } from './helpers';

// Immersion wave Task 2 (scenes spec §2.2, §4; playability #1, #12, #21): the overlays are objects
// (scroll, table, codex), they sit below the HUD, and the scene's words fade out behind them.
// Task 13 extends this file into the sweep of every overlay.

const hero = (project: string) => uniqueName(`Objet-${project}`);

test('the shelves lie on a wood table below the HUD; the owl speaks; the tent labels fade', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await page.getByTestId('dialogue-skip').click();
  await tap(page.getByTestId('library-shelves'), testInfo);
  const shelves = page.getByTestId('overlay-shelves');
  await expect(shelves).toHaveAttribute('data-variant', 'table');
  await expect(shelves.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', 'owl');
  await expect(shelves.getByTestId('overlay-voice')).toContainText("dés-accords d'Éris");
  await expectOverlayClearsScene(page, 'overlay-shelves', 'library');
  // The labels come back once it closes.
  await shelves.getByTestId('overlay-close').click();
  await expect(shelves).toHaveCount(0);
  await expect
    .poll(() => page.getByTestId('library-shelves').locator('.hotspot-label').evaluate((e) => getComputedStyle(e).opacity))
    .toBe('1');
});

test('the desk is a scroll: two rods, torn sides, below the HUD', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/texts/new`);
  const desk = page.getByTestId('overlay-desk');
  await expect(desk).toHaveAttribute('data-variant', 'scroll');
  await expect(desk.locator('.scroll-rod')).toHaveCount(2);
  const mask = await desk
    .locator('.surface-sheet')
    .evaluate((e) => getComputedStyle(e).getPropertyValue('-webkit-mask-image') || getComputedStyle(e).getPropertyValue('mask-image'));
  expect(mask).toContain('data:image/svg+xml');
  await expectOverlayClearsScene(page, 'overlay-desk', 'library');
});

test('the quest tablets hang on a wood table; the temple plaque and labels fade', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/quetes`);
  await expect(page.getByTestId('overlay-tablets')).toHaveAttribute('data-variant', 'table');
  await expectOverlayClearsScene(page, 'overlay-tablets', 'delphi');
});
