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
  heroNamer,
} from './helpers';

// UI3b (scenes spec §3 War tent, §10): the lieutenants' portrait sheets, the first locked places
// (carry #16/M9), Éris's file and the bestiary codex. desktop + ipad.

const SHEETS = ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe'];
const PLACES = [...SHEETS.map((k) => `war-${k}`), 'war-dossier', 'war-bestiary'];
const heroName = heroNamer('Guerre');

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
    await expect(page.getByTestId(`war-sheet-${k}`).locator('img.war-portrait')).toHaveAttribute('src', `/art/lieutenants/${k}_cut.webp`);
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
  await expect(sheet.getByTestId('lieutenant-gauge-days')).toContainText('0 sur 3');
  await expect(sheet.getByTestId('lieutenant-seal')).toContainText('Pas encore de sceau');
  await expect(sheet.getByTestId('lieutenant-next')).toHaveText('Pas encore croisée.');
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
  // Ruling B-a: it still answers, so it is not aria-disabled; its name says it sleeps.
  await expect(protee).not.toHaveAttribute('aria-disabled');
  await expect(protee).toHaveAccessibleName(/Protée.*Dort encore.*fermé pour l'instant/);
  await expect(protee.locator('img.hotspot-lock')).toHaveAttribute('src', '/art/icons/lock.webp');
  // UI3b playability #20: when it wakes, in years from the hero's class (7H: one year to 8H).
  const line = 'Protée dort encore. Il se réveillera dans un an.';
  await tap(protee, testInfo);
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
  await expect(page.getByTestId('dialogue-text')).toHaveText(line);
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-text')).toHaveCount(0);
  // Focus comes back to the sheet that asked, not to <body> (UI3b Task 7 review).
  await expect(protee).toBeFocused();
  // The keyboard reaches the same word: Enter on the focused sheet.
  await protee.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('dialogue-text')).toHaveText(line);
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
  await page.getByTestId('dialogue-skip').click();
  // The other places still open: the locked tap never took the stage's one-tap guard.
  await tap(page.getByTestId('war-hydre'), testInfo);
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
});

test("a sleeping lieutenant's portrait, however it is reached, has no quest: the dragon says why", async ({ page, request }, testInfo) => {
  // Final review I1: the sheet was locked, but the codex page and a deep link reached a portrait
  // with « Lancer une quête », and the server started the quest.
  const id = await createProfileApi(request, heroName(testInfo.project.name), '7H');
  const line = 'Protée dort encore. Il se réveillera dans un an.';
  const sheet = page.getByTestId('overlay-portrait');
  const expectAsleep = async (how: string) => {
    await expect(sheet, how).toBeVisible();
    await expect(sheet.getByTestId('overlay-voice'), how).toHaveAttribute('data-speaker', 'dragon');
    await expect(sheet.getByTestId('overlay-voice'), how).toContainText(line);
    await expect(sheet.getByTestId('lieutenant-portrait'), how).toHaveClass(/asleep/);
    await expect(sheet.getByTestId('lieutenant-quest'), how).toHaveCount(0);
    await expect(sheet.getByTestId('lieutenant-gauge-days'), how).toHaveCount(0);
    expect(await redScan(page), how).toEqual([]);
  };
  await page.goto(`/#/p/${id}/monstres/protee`);
  await expectAsleep('deep link');
  // The codex page keeps its button: it leads to the same sleeping portrait.
  await page.goto(`/#/p/${id}/bestiaire/protee`);
  await page.getByTestId('overlay-codex-page').getByTestId('codex-page-lieutenant').click();
  await expect(page).toHaveURL(/\/monstres\/protee$/);
  await expectAsleep('codex page');
  // A stale client is refused by the server with the same words.
  const r = await request.post(`/api/profiles/${id}/quests`, { data: { target: 'protee' } });
  expect(r.status()).toBe(409);
  expect((await r.json()).detail).toBe(line);
});

test("a hero switch then a deep link never shows the previous hero's lieutenant (final review I2)", async ({ page, request }, testInfo) => {
  // The camp store is shared across heroes; until the new hero's /camp answers, the portrait must
  // wait for it rather than show the previous hero's quest.
  const before = await createProfileApi(request, heroName(testInfo.project.name));
  const afterName = heroName(testInfo.project.name);
  const after = await createProfileApi(request, afterName);
  expect((await request.post(`/api/profiles/${before}/quests`, { data: { target: 'hydre' } })).ok()).toBeTruthy();
  await page.goto(`/#/p/${before}/monstres/hydre`);
  const sheet = page.getByTestId('overlay-portrait');
  await expect(sheet.getByTestId('lieutenant-quest')).toHaveText('Quête en cours');
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**/api/profiles/${after}/camp`, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(`/#/p/${after}/monstres/hydre`);
  await expect(page.getByTestId('hud-hero')).toHaveAccessibleName(`Ton héros\u202f: ${afterName}`);
  await expect(sheet).toContainText('Les Muses cherchent ce lieutenant');
  await expect(sheet.getByTestId('lieutenant-quest')).toHaveCount(0);
  await expect(sheet.getByTestId('overlay-voice')).toContainText('Éris feuillette son dossier');
  release();
  await expect(sheet.getByTestId('lieutenant-quest')).toHaveText('Lancer une quête');
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
  // A short button name, the sheet's words as its description. UI3b playability #3: Éris's sentence
  // and one gauge, no counts (the journal keeps those).
  await expect(file.getByTestId('dossier-row-hydre')).toHaveAccessibleName("L'Hydre\u202f: voir la ruse et la quête");
  await expect(file.getByTestId('dossier-progress-hydre')).toHaveText('Pas encore croisée.');
  await expect(file.getByTestId('dossier-row-hydre')).toHaveAccessibleDescription(/Pas encore croisée\./);
  await expect(file.getByTestId('dossier-window-hydre')).toBeAttached();
  await expect(file.getByTestId('dossier-window-hydre').locator('.kit-gauge-label')).toHaveCount(0);
  await expect(file.locator('.papers')).not.toContainText(/Pièges tendus|%|\/3|\/10/);
  await expect(file.getByRole('heading', { level: 4 })).toHaveCount(0);
  // The sheets of a row are the same height, so their rods line up.
  const heights = await file.locator('[data-testid^="dossier-row-"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(heights.slice(0, 3)).size, heights.join(',')).toBe(1);
  await file.getByTestId('dossier-row-hydre').click();
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
  await expect(page.getByTestId('overlay-portrait')).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/dossier$/);
  await expect(file.getByTestId('dossier-row-hydre')).toBeFocused();
  // The journal is the cabin's overlay: opened as a tagged push (final review M13), its seal steps
  // back to this file, not into the bare cabin.
  await file.getByTestId('dossier-journal').click();
  await expect(page).toHaveURL(/\/stats$/);
  await expect(page.getByTestId('overlay-journal')).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/dossier$/);
  await expect(page.getByTestId('overlay-dossier')).toBeVisible();
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
  // UI3b playability #21: Delphi is a sacred place, not a friend.
  await expect(codex.getByRole('heading', { name: 'Les lieux sacrés' })).toBeVisible();
  await expect(codex.locator('.page-right ol').last().getByTestId('bestiary-card-delphes')).toBeVisible();
  await expect(codex.locator('.page-right ol').first().getByTestId('bestiary-card-delphes')).toHaveCount(0);
  await expect(codex.getByTestId('bestiary-card-hydre').getByTestId('bestiary-locked')).toBeVisible();
  await codex.getByTestId('bestiary-card-argus').click();
  await expect(page).toHaveURL(/\/bestiaire\/argus$/);
  const leaf = page.getByTestId('overlay-codex-page');
  await expect(leaf.getByRole('heading', { name: 'Argus aux cent yeux', level: 2 })).toBeVisible();
  await expect(leaf.getByRole('heading', { name: 'Le mythe' })).toBeVisible();
  await expect(leaf.getByRole('heading', { name: 'Au camp' })).toBeVisible();
  // UI3b playability #11: the myth in paragraphs, the sources a line at the foot of the camp's page,
  // no « Fiction du jeu » stamp.
  await expect(leaf.getByTestId('codex-myth').locator('p').first()).toBeVisible();
  await expect(leaf.locator('ul')).toHaveCount(0);
  await expect(leaf).not.toContainText('Fiction du jeu');
  await expect(leaf.getByRole('heading', { name: 'Sources' })).toHaveCount(0);
  await expect(leaf.locator('.page-right').getByTestId('codex-sources')).toContainText(/^D'après\u202f: /);
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

test('codex → page → portrait: each seal steps back one panel and focus follows', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('war-bestiary'), testInfo);
  const codex = page.getByTestId('overlay-codex');
  await codex.getByTestId('bestiary-card-hydre').click();
  const leaf = page.getByTestId('overlay-codex-page');
  await leaf.getByTestId('codex-page-lieutenant').click();
  await expect(page).toHaveURL(/\/monstres\/hydre$/);
  await expect(page.getByTestId('overlay-portrait')).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/bestiaire\/hydre$/);
  await expect(leaf.getByTestId('codex-page-lieutenant')).toBeFocused();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/bestiaire$/);
  await expect(codex.getByTestId('bestiary-card-hydre')).toBeFocused();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-de-guerre$/);
  await expect(page.getByTestId('war-bestiary')).toBeFocused();
});

// Spec 2026-09-29 lieutenant levels §5: an intercepted /camp (the seals themselves are pinned by the
// server tests): the Hydra at the bronze seal on its way to silver, Écho at the fifth.
test('a sealed lieutenant: its trophy on the sheet and the portrait, the seal in the file and the codex, the next seal in words', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.lieutenants = json.lieutenants.map((l: { key: string }) =>
      l.key === 'hydre'
        ? { ...l, level: 2, level_reached_at: '2026-09-20T10:00:00+00:00', bestiary_unlocked: true,
            all_time: { traps: 12, caught: 11, missed: 1, rate: 11 / 12 },
            next: { level: 3, days: 2, chances: 20, correct: 0.9, complete: false, need: { days: 6, chances: 45, correct: 0.91 } } }
        : l.key === 'echo'
          ? { ...l, level: 5, level_reached_at: '2026-09-25T10:00:00+00:00', bestiary_unlocked: true, next: null }
          : l,
    );
    await route.fulfill({ response: res, json });
  });
  await openTent(page, id);
  await expect(page.getByTestId('war-hydre')).toContainText('Sceau de bronze');
  // UI3b playability #8: the names and captions inked on the sheets are read at arm's length.
  for (const sel of ['.hotspot-name', '.hotspot-caption']) {
    const px = await page.getByTestId('war-hydre').locator(sel).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(px, sel).toBeGreaterThanOrEqual(14);
  }
  await expect(page.getByTestId('war-sheet-hydre').locator('img.war-seal')).toHaveAttribute('src', '/art/trophies/trophy-hydre-2.webp');
  await expect(page.getByTestId('war-sheet-chimere').locator('.war-seal.is-outline')).toBeAttached();
  await tap(page.getByTestId('war-hydre'), testInfo);
  const sheet = page.getByTestId('overlay-portrait');
  await expect(sheet.getByTestId('lieutenant-seal')).toContainText('Sceau de bronze');
  await expect(sheet.getByTestId('lieutenant-seal').locator('img')).toHaveAttribute('src', '/art/trophies/trophy-hydre-2.webp');
  await expect(sheet.getByTestId('overlay-voice')).toContainText('Mon Hydre porte un sceau');
  await expect(sheet.getByTestId('lieutenant-gauge-days')).toContainText('Jours de garde\u202f: 2 sur 6');
  await expect(sheet.getByTestId('lieutenant-gauge-traps')).toContainText('Pièges croisés\u202f: 20 sur 45');
  await expect(sheet.getByTestId('lieutenant-rate')).toContainText('Pièges déjoués\u202f: 90\u202f%, il en faut 91\u202f%');
  await expect(sheet.getByTestId('lieutenant-next')).toHaveText("Encore 4 jours de garde et 25 pièges avant le sceau d'argent.");
  await closeOverlay(page);
  await tap(page.getByTestId('war-echo'), testInfo);
  await expect(sheet.getByTestId('lieutenant-next')).toHaveText("Sceau d'orichalque. Il ne reste rien à conquérir ici.");
  await expect(sheet.getByTestId('lieutenant-gauges')).toHaveCount(0);
  await expect(sheet.getByTestId('overlay-voice')).toContainText('Cinq sceaux sur Écho');
  await closeOverlay(page);
  await tap(page.getByTestId('war-dossier'), testInfo);
  await expect(page.getByTestId('dossier-seal-hydre')).toHaveText('Sceau de bronze');
  await expect(page.getByTestId('dossier-progress-hydre')).toHaveText("Encore 4 jours de garde et 25 pièges avant le sceau d'argent.");
  await expect(page.getByTestId('dossier-window-hydre')).toBeAttached();
  await expect(page.getByTestId('dossier-seal-echo')).toHaveText("Sceau d'orichalque");
  await expect(page.getByTestId('dossier-window-echo')).toHaveCount(0);
  await closeOverlay(page);
  await tap(page.getByTestId('war-bestiary'), testInfo);
  const card = page.getByTestId('overlay-codex').getByTestId('bestiary-card-hydre');
  await expect(card.locator('.kit-stamp')).toHaveText('Sceau de bronze');
  await expect(card.getByTestId('bestiary-locked')).toHaveCount(0);
  expect(await redScan(page)).toEqual([]);
});
