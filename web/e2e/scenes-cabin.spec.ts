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

test('the journal opens as a codex: the Muses\' help, the tricks, the words, the defences', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await tap(page.getByTestId('cabin-journal'), testInfo);
  await expect(page).toHaveURL(/\/stats$/);
  const journal = page.getByTestId('overlay-journal');
  await expect(journal.getByRole('heading', { name: 'Ton journal', level: 2 })).toBeVisible();
  await expect(journal.getByRole('heading', { name: "L'aide des Muses" })).toBeVisible();
  await expect(journal.getByTestId('journal-help').locator('[aria-current="step"]')).toHaveCount(1);
  for (const h of ['Ses ruses, une à une', 'Mots-pièges', 'Tes dernières défenses', 'Depuis le début']) {
    await expect(journal.getByRole('heading', { name: h })).toBeVisible();
  }
  await expect(journal.getByTestId('journal-totals')).toHaveText('0 texte défendu · 0 point · 0 piège déjoué');
  await expect(journal).not.toContainText(/niveau|partie/i);
  await closeOverlay(page);
  await expect(page.getByTestId('cabin-journal')).toBeFocused();
});

test('the lyre holds the settings, one mute with the HUD, the goal as medallions, the credits', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await tap(page.getByTestId('cabin-lyre'), testInfo);
  await expect(page).toHaveURL(/\/settings$/);
  const lyre = page.getByTestId('overlay-lyre');
  await expect(lyre.getByRole('heading', { name: 'La lyre', level: 2 })).toBeVisible();
  await expect(lyre.getByRole('group', { name: 'Ta classe' })).toBeVisible();
  await expect(lyre.getByLabel('Nouveau code (quatre chiffres)')).toBeVisible();
  // The settings' mute and the HUD's are one switch (UI3a Ruling A17: the sliders are UI5).
  const mute = lyre.getByLabel('Couper les sons du jeu (la dictée reste lue)');
  await expect(mute).not.toBeChecked();
  await mute.check();
  await expect(page.getByTestId('hud-mute')).toHaveAttribute('aria-pressed', 'true');
  await lyre.getByRole('group', { name: 'Textes par semaine' }).getByRole('radio', { name: '4' }).check();
  await lyre.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(lyre.getByRole('status')).toHaveText("C'est noté.");
  await lyre.getByTestId('lyre-credits').locator('summary').click();
  await expect(lyre.getByTestId('lyre-credits')).toContainText('Wikisource');
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/cabane$/);
});

test('the HUD hero chip opens the hero panel in the cabin from any place; its seal steps back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await page.getByTestId('dialogue-skip').click();
  await page.getByTestId('hud-hero').click();
  await expect(page).toHaveURL(/\/cabane\?panel=heros$/);
  const panel = page.getByTestId('overlay-heros');
  await expect(panel.getByRole('heading', { name: 'Ton héros', level: 2 })).toBeVisible();
  for (const name of ['La lyre', 'Ton journal', 'Changer de héros']) await expect(panel.getByRole('link', { name })).toBeVisible();
  await expect(page.getByTestId('scene-cabin')).toHaveAttribute('inert', '');
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await page.getByTestId('hud-hero').click();
  await panel.getByRole('link', { name: 'Ton journal' }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await closeOverlay(page); // steps back to the hero panel it came from
  await expect(panel).toBeVisible();
});

for (const o of [
  { hash: (id: number) => `/p/${id}/stats`, testId: 'overlay-journal', variant: 'codex' },
  { hash: (id: number) => `/p/${id}/settings`, testId: 'overlay-lyre', variant: 'scroll' },
  { hash: (id: number) => `/p/${id}/cabane?panel=heros`, testId: 'overlay-heros', variant: 'scroll' },
] as const) {
  test(`${o.testId}: an in-world ${o.variant}, clear of the HUD, 48 px targets, kit classes only`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    await page.goto(`/#${o.hash(id)}`);
    await expectInWorldOverlay(page, o.testId, 'cabin', true, o.variant, null);
  });
}
