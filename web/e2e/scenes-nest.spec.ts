import { test, expect } from './crashGuard';
import {
  closeOverlay,
  createProfileApi,
  expectCamp,
  expectInSafeZone,
  expectInWorldOverlay,
  expectScene,
  measureBoxes,
  redScan,
  tap,
  uniqueName,
} from './helpers';

// UI3b Task 4 (scenes spec §3 Dragon's nest, §10). desktop + ipad.

const heroName = (project: string) => uniqueName(`Nid-${project}`);

test('the nest: the egg in the straw, its growth, its greeting; the exit leads back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon`);
  await expectScene(page, 'nest');
  await expect(page.locator('[data-testid="scene-nest"] .stage-plaque')).toHaveText('Le nid du dragon');
  await expect(page.getByTestId('dialogue-text')).toHaveText("L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.");
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('nest-dragon-layer').locator('img')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');
  await expect(page.getByTestId('dragon-stage')).toHaveText('Œuf');
  await expect(page.getByTestId('nest-growth')).toContainText('Prochaine étape : 1 technique neutralisée');
  await expect(page.getByTestId('nest-growth')).toContainText('Frémit');
  await expect(page.getByTestId('nest-dragon')).toContainText('Un œuf de dragon');
  const b = await measureBoxes(page, { growth: '[data-testid="nest-growth"]', dragon: '[data-testid="nest-dragon"]' });
  expect(b.growth!.x + b.growth!.width, 'growth parchment left of the dragon').toBeLessThanOrEqual(b.dragon!.x);
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

test('the dragon opens its care and speaks; locked tints say how to win them', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon?debug`); // ?debug: no greeting in the way
  await expectScene(page, 'nest');
  await tap(page.getByTestId('nest-dragon'), testInfo);
  await expect(page).toHaveURL(/\/dragon\?panel=soin$/);
  const care = page.getByTestId('overlay-care');
  await expect(care.getByRole('heading', { name: 'Ton dragon', level: 2 })).toBeVisible();
  await expect(care.getByTestId('overlay-voice')).toContainText("Un œuf n'a pas encore de nom.");
  await expect(care).toContainText('Tu lui donneras un nom quand il éclora.');
  await expect(care.getByTestId('dragon-tint-bronze')).toBeVisible();
  await expect(care.getByTestId('dragon-tint-ecume')).toBeDisabled();
  await expect(care.getByTestId('dragon-tint-ecume')).toContainText("À gagner : quête de l'Oracle");
  await expect(care.getByTestId('dragon-tint-ecume').locator('img[src="/art/icons/lock.webp"]')).toBeVisible();
  await closeOverlay(page);
  await expect(page.getByTestId('nest-dragon')).toBeFocused();
});

test('overlay-care: an in-world scroll, clear of the HUD, 48 px targets, kit classes only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  await expectInWorldOverlay(page, 'overlay-care', 'nest', true, 'scroll', 'dragon');
});

test('the HUD dragon leads to the nest; place and label sit in the safe zone', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page.getByTestId('hud-dragon'), testInfo);
  await expect(page).toHaveURL(/\/dragon$/);
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await expectScene(page, 'nest');
    await expectInSafeZone(page, 'nest', ['nest-dragon']);
  }
});

test('nest: ?debug outlines the dragon; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon?debug`);
  await expectScene(page, 'nest');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(1);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});
