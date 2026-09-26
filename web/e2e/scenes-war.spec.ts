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

// UI3b (scenes spec §3 War tent, §10): the lieutenants' portrait sheets, the first locked places
// (carry #16/M9), Éris's file and the bestiary codex. desktop + ipad.

const SHEETS = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'];
const PLACES = [...SHEETS.map((k) => `war-${k}`), 'war-dossier', 'war-bestiary'];
const heroName = (project: string) => uniqueName(`Guerre-${project}`);

async function openTent(page: Page, id: number) {
  await page.goto(`/#/p/${id}/tente-de-guerre`);
  await expectScene(page, 'war');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

test('the war tent: six sheets with their painted lieutenants, the file, the codex, the exit', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await expect(page.locator('[data-testid="scene-war"] .stage-plaque')).toHaveText('La tente de guerre');
  for (const k of SHEETS) {
    await expect(page.getByTestId(`war-${k}`)).toBeVisible();
    await expect(page.getByTestId(`war-sheet-${k}`).locator('img')).toHaveAttribute('src', `/art/lieutenants/${k}_cut.webp`);
  }
  await expect(page.getByTestId('war-hydre')).toHaveAccessibleName(/L'Hydre/);
  await expect(page.getByTestId('war-dossier')).toHaveAccessibleName(/Le dossier d'Éris/);
  await expect(page.getByTestId('war-bestiary')).toHaveAccessibleName(/Le bestiaire/);
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

test('a sheet opens its lieutenant: Éris speaks, a quest, the seal and Back close it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('war-hydre'), testInfo);
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
  const sheet = page.getByTestId('overlay-portrait');
  await expect(sheet.getByRole('heading', { name: "L'Hydre", level: 2 })).toBeVisible();
  await expect(sheet.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', 'eris');
  await expect(sheet.getByTestId('lieutenant-gauge-days')).toContainText('0/3');
  await sheet.getByTestId('lieutenant-quest').click();
  await expect(sheet.getByRole('status')).toHaveText('Quête affichée au mur.');
  await expect(sheet.getByTestId('lieutenant-quest')).toContainText('Quête en cours');
  await expect(sheet.locator('[data-testid^="lieutenant-text-"]').first()).toBeVisible();
  await expect(sheet.locator('[data-testid^="lieutenant-text-"]').first()).not.toContainText(/\b\d{1,2}H\b/);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
  await expect(page.getByTestId('war-hydre')).toBeFocused();
  await expect(page.getByTestId('war-hydre')).toContainText('Quête en cours');
  await tap(page.getByTestId('war-echo'), testInfo);
  await expect(page.getByTestId('overlay-portrait')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('overlay-portrait')).toHaveCount(0);
  await page.goto(`/#/p/${id}/monstres/lethe`);
  await expect(page.getByTestId('overlay-portrait').getByRole('heading', { name: 'Léthé', level: 2 })).toBeVisible();
});

test("a lieutenant asleep at the hero's class is a locked place: the dragon says why", async ({ page, request }, testInfo) => {
  // Protée wakes at 8H (catalog.py min_level): a 7H hero finds him asleep.
  const id = await createProfileApi(request, heroName(testInfo.project.name), '7H');
  await openTent(page, id);
  const protee = page.getByTestId('war-protee');
  await expect(protee).toHaveAttribute('aria-disabled', 'true');
  await expect(protee).toContainText('Dort encore');
  await expect(protee.locator('img.hotspot-lock')).toHaveAttribute('src', '/art/icons/lock.webp');
  // aria-disabled makes Playwright's actionability wait forever for "enabled"; the locked plaque
  // still takes a real tap (it explains itself), so force past that one check.
  if (testInfo.project.name === 'ipad') await protee.tap({ force: true });
  else await protee.click({ force: true });
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
  await expect(page.getByTestId('dialogue-text')).toHaveText('Protée dort encore. Ses ruses viendront dans une classe plus grande.');
  await page.getByTestId('dialogue-skip').click();
  // The other places still open: the locked tap never took the stage's one-tap guard.
  await tap(page.getByTestId('war-hydre'), testInfo);
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openTent(page, id);
    await expectInSafeZone(page, 'war', PLACES);
    expect(await labelOverlaps(page, 'war'), `${size.width}x${size.height}`).toEqual([]);
  }
});

test('overlay-portrait: an in-world scroll, clear of the HUD, 48 px targets, kit classes only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/monstres/hydre`);
  await expectInWorldOverlay(page, 'overlay-portrait', 'war', true, 'scroll', 'eris');
});

test('war tent: ?debug outlines eight places; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-de-guerre?debug`);
  await expectScene(page, 'war');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(8);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});

test("the map table opens Éris's file; a sheet opens its lieutenant; the seals step back", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('war-dossier'), testInfo);
  await expect(page).toHaveURL(/\/dossier$/);
  const file = page.getByTestId('overlay-dossier');
  await expect(file.getByRole('heading', { name: "Le dossier d'Éris", level: 2 })).toBeVisible();
  await expect(file.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', 'eris');
  await expect(file.getByRole('heading', { name: 'Ses points faibles' })).toBeVisible();
  await expect(file.getByTestId('dossier-line-hydre')).toBeVisible();
  await expect(file.getByTestId('dossier-row-hydre').locator('img[src="/art/icons/lt-hydre.webp"]')).toBeVisible();
  await expect(file.getByTestId('dossier-small-tricks').getByRole('link', { name: 'Lire ton journal' })).toBeVisible();
  await file.getByTestId('dossier-row-hydre').click();
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
  await expect(page.getByTestId('overlay-portrait')).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/dossier$/);
  await expect(file.getByTestId('dossier-row-hydre')).toBeFocused();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
});

test("the lectern opens the bestiary codex; a page keeps the myth apart from the camp's fiction", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('war-bestiary'), testInfo);
  await expect(page).toHaveURL(/\/bestiaire$/);
  const codex = page.getByTestId('overlay-codex');
  await expect(codex.getByRole('heading', { name: 'Le bestiaire', level: 2 })).toBeVisible();
  await expect(codex.getByRole('heading', { name: "Les ruses d'Éris" })).toBeVisible();
  await expect(codex.getByRole('heading', { name: 'Les amis du camp' })).toBeVisible();
  await expect(codex.getByTestId('bestiary-card-hydre').getByTestId('bestiary-locked')).toBeVisible();
  await codex.getByTestId('bestiary-card-argus').click();
  await expect(page).toHaveURL(/\/bestiaire\/argus$/);
  const leaf = page.getByTestId('overlay-codex-page');
  await expect(leaf.getByRole('heading', { name: 'Argus aux cent yeux', level: 2 })).toBeVisible();
  await expect(leaf.getByRole('heading', { name: 'Le mythe' })).toBeVisible();
  await expect(leaf.getByRole('heading', { name: 'Au camp' })).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/bestiaire$/);
  await codex.getByTestId('bestiary-card-hydre').click();
  await leaf.getByTestId('codex-page-lieutenant').click();
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
  expect(await redScan(page)).toEqual([]);
});

for (const o of [
  { hash: (id: number) => `/p/${id}/dossier`, testId: 'overlay-dossier', variant: 'table', voice: 'eris' },
  { hash: (id: number) => `/p/${id}/bestiaire`, testId: 'overlay-codex', variant: 'codex', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/bestiaire/hydre`, testId: 'overlay-codex-page', variant: 'codex', voice: null },
] as const) {
  test(`${o.testId}: an in-world ${o.variant}, clear of the HUD, 48 px targets, kit classes only`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    await page.goto(`/#${o.hash(id)}`);
    await expectInWorldOverlay(page, o.testId, 'war', true, o.variant, o.voice);
  });
}
