import { test, expect, type Page } from '@playwright/test';
import {
  closeOverlay,
  createProfileApi,
  createText,
  expectCamp,
  expectExitClearOfDialogueDock,
  expectInSafeZone,
  expectScene,
  labelOverlaps,
  redScan,
  tap,
  uniqueName,
} from './helpers';

// UI3a Task 9 (scenes spec §3 Library, §10): the library tent as a place. desktop + ipad.

const PLACES = ['library-shelves', 'library-desk', 'library-lens', 'library-portal'];
const heroName = (project: string) => uniqueName(`Tente-${project}`);

async function openTent(page: Page, id: number) {
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

test('the hub leads into the tent; its plaque echoes the hub label; the exit sign leads back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page.getByTestId('camp-parchemins'), testInfo);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expectScene(page, 'library');
  await expect(page.locator('.stage-plaque')).toHaveText('La tente des parchemins');
  await expect(page.getByTestId('dialogue-text')).toContainText('Hou !');
  await page.getByTestId('dialogue-skip').click();
  for (const p of PLACES) await expect(page.getByTestId(p)).toBeVisible();
  await expect(page.getByTestId('library-desk')).toContainText('Taper ou coller un texte');
  await expect(page.getByTestId('library-desk').locator('img.hotspot-icon')).toHaveAttribute('src', '/art/icons/add-text.webp');
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
  await page.goBack();
  await expectScene(page, 'library');
  await page.goBack();
  await expectCamp(page);
});

test('the shelves open « Les Parchemins » as an overlay; seal, Escape and Back close it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('library-shelves'), testInfo);
  await expect(page).toHaveURL(/\/parchemins$/);
  const shelves = page.getByTestId('overlay-shelves');
  await expect(shelves.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  await expect(page.getByTestId('scene-library')).toHaveAttribute('inert', '');
  await expect(shelves.locator('[data-testid="text-card"]').first()).toBeVisible();
  // Parity: the level filter and the « Tous » sections.
  await shelves.getByRole('button', { name: '9H', exact: true }).click();
  await shelves.getByRole('button', { name: 'Tous', exact: true }).click();
  await expect(shelves.getByRole('heading', { name: /À ton niveau/ })).toBeVisible();
  await page.getByTestId('overlay-close').click();
  await expect(shelves).toHaveCount(0);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expect(page.getByTestId('library-shelves')).toBeFocused();

  // The one-tap guard was released: the next object still opens (UI3 Ruling A6).
  await tap(page.getByTestId('library-shelves'), testInfo);
  await expect(shelves).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(shelves).toHaveCount(0);
  await tap(page.getByTestId('library-shelves'), testInfo);
  await expect(shelves).toBeVisible();
  await page.goBack();
  await expect(shelves).toHaveCount(0);
  await expect(page).toHaveURL(/\/tente-parchemins$/);

  // A deep link reopens it; its seal replaces the entry with the bare scene.
  await page.goto(`/#/p/${id}/parchemins`);
  await expect(shelves).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});

test('a text card on the shelves starts the dictation; a prophecy wears its chip', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const title = `Prophétie tente ${testInfo.project.name} ${Date.now()}`;
  await createText(request, { title, body: 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.', level: '10H', due_date: '2099-01-01' });
  await page.goto(`/#/p/${id}/parchemins`);
  const card = page.getByTestId('overlay-shelves').locator('[data-testid="text-card"]', { hasText: title });
  await expect(card.getByTestId('chip-prophecy')).toContainText('01.01.2099');
  await card.click();
  await expect(page).toHaveURL(/\/play\/\d+$/);
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openTent(page, id);
    await expectInSafeZone(page, 'library', PLACES);
    expect(await labelOverlaps(page, 'library'), `${size.width}x${size.height}`).toEqual([]);
  }
});

test('the exit sign never overlaps the dialogue dock', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size);
    await openTent(page, id);
    await expectExitClearOfDialogueDock(page, 'library');
  }
});

test('opening and closing a panel never remounts the tent: no replayed entry zoom', async ({ page, request }, testInfo) => {
  // Controller ruling 5: LibraryTent must stay the same mounted instance across `library-tent` <->
  // `library` (App.svelte's `view?.place === 'library'` branch, not one branch per route.name), so
  // an overlay never replays SceneTransition's entry zoom. Proved two ways: the settled element is
  // the exact same DOM node throughout, and it is never seen "unsettled" again after the round trip.
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  const stage = page.locator('[data-testid="scene-library"] .scene-transition');
  await expect(stage).toHaveAttribute('data-settled', 'true');
  const before = await stage.elementHandle();
  await tap(page.getByTestId('library-shelves'), testInfo);
  await expect(page).toHaveURL(/\/parchemins$/);
  // A remount would recreate the node at `data-settled="false"` before its own zoom finished; a
  // node that stayed mounted was never anything but settled.
  await expect(stage).toHaveAttribute('data-settled', 'true');
  const afterOpen = await stage.elementHandle();
  expect(await page.evaluate(([a, b]) => a === b, [before, afterOpen])).toBe(true);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expect(stage).toHaveAttribute('data-settled', 'true');
  const afterClose = await stage.elementHandle();
  expect(await page.evaluate(([a, b]) => a === b, [before, afterClose])).toBe(true);
});

test('library: ?debug outlines the four objects; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins?debug`);
  await expectScene(page, 'library');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(4);
  expect(await redScan(page)).toEqual([]);
  await page.goto(`/#/p/${id}/parchemins`);
  await expect(page.getByTestId('overlay-shelves')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});

// UI3a Task 10: the desk and the lens open the write/paste and scan forms as in-world overlays
// (Ruling A3), instead of the legacy full screens. Ruling A2: saving replaces the tagged
// text-new/text-scan history entry rather than pushing a new one, so Back never reopens the form.
test('the desk writes a new parchment; saving lands on the shelves and Back never reopens the form', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('library-desk'), testInfo);
  await expect(page).toHaveURL(/\/texts\/new$/);
  const desk = page.getByTestId('overlay-desk');
  await expect(desk.getByRole('heading', { name: 'Nouveau parchemin' })).toBeVisible();
  const title = uniqueName(`Pupitre ${testInfo.project.name}`);
  await page.getByLabel('Titre').fill(title);
  await page.getByLabel('Texte').fill('Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.');
  await expect(desk).toContainText('13 mots');
  // A text to defend is set in Literata (Ruling A8); every legacy field is there.
  expect(await page.getByLabel('Texte').evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Literata');
  for (const label of ['Niveau', 'Auteur', 'Œuvre', 'Traducteur']) await expect(desk.getByLabel(label)).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.getByRole('button', { name: 'Sauvegarder dans les Parchemins' }).click();
  await expect(page).toHaveURL(/\/parchemins$/);
  await expect(page.getByTestId('overlay-shelves').locator('[data-testid="text-card"]', { hasText: title })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});

test('the lens opens the three-step scan as a wide overlay', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('library-lens'), testInfo);
  await expect(page).toHaveURL(/\/texts\/scan$/);
  const lens = page.getByTestId('overlay-lens');
  await expect(lens.getByRole('heading', { name: 'Scanner une feuille' })).toBeVisible();
  await expect(page.getByTestId('scan-input')).toBeAttached();
  await expect(page.getByTestId('btn-scan-read')).toBeDisabled();
  await expect(lens.locator('img.capture-icon')).toHaveAttribute('src', '/art/icons/add-scan.webp');
  const box = await lens.boundingBox();
  expect(box!.width, 'wide overlay').toBeGreaterThan(700);
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});
