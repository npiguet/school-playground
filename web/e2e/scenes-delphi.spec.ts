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
  measureBoxes,
  onlyOwnProphecy,
  redScan,
  tap,
  uniqueName,
} from './helpers';

// UI3a Task 12 (scenes spec §3 Delphi, §10): the Pythia and the votive tablets. desktop + ipad.

const PLACES = ['delphi-pythia', 'delphi-tablets'];
const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const heroName = (project: string) => uniqueName(`Delphes-${project}`);

async function openTemple(page: Page, id: number) {
  await page.goto(`/#/p/${id}/temple`);
  await expectScene(page, 'delphi');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

test('the hub path leads to the temple; the Pythia greets; the exit sign leads back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page.getByTestId('camp-oracle'), testInfo);
  await expect(page).toHaveURL(/\/temple$/);
  await expectScene(page, 'delphi');
  await expect(page.locator('.stage-plaque')).toHaveText('Le temple de Delphes');
  await expect(page.getByTestId('dialogue-text')).toHaveText("Approche. Trois rouleaux scellés t'attendent cette semaine.");
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('delphi-pythia')).toHaveClass(/is-new/);
  await expect(page.getByTestId('delphi-pythia')).toContainText('Trois rouleaux à ouvrir');
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

test('the Pythia opens the three scrolls; « Ce que prépare ta classe »; seal, Escape and Back close', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTemple(page, id);
  await page.getByTestId('dialogue-skip').click();
  await tap(page.getByTestId('delphi-pythia'), testInfo);
  await expect(page).toHaveURL(/\/delphes$/);
  const oracle = page.getByTestId('overlay-pythia');
  await expect(oracle.getByRole('heading', { name: 'La Pythie' })).toBeVisible();
  await expect(oracle.getByTestId('scroll-open')).toHaveCount(3);
  await expect(oracle.getByTestId('scroll-ecole')).toContainText('Ce que prépare ta classe');
  await expect(oracle.getByTestId('scroll-ecole')).not.toContainText("Ce qui arrive à l'école");
  await expect(oracle.getByTestId('oracle-reward')).toContainText('150 XP');
  // Parity: the school scroll's monster picker opens and cancels without consulting.
  await oracle.getByTestId('scroll-ecole').getByTestId('scroll-open').click();
  await expect(oracle.getByTestId('oracle-monster-hydre')).toBeVisible();
  await oracle.getByTestId('oracle-cancel').click();
  await expect(oracle.getByTestId('scroll-open')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(oracle).toHaveCount(0);
  await expect(page).toHaveURL(/\/temple$/);
  await tap(page.getByTestId('delphi-pythia'), testInfo);
  // Ruling U5: openPanel fires ~160ms after the tap, so wait for the overlay before Back, or Back
  // would leave the temple instead of stepping back from the (not-yet-pushed) overlay entry.
  await expect(oracle).toBeVisible();
  await page.goBack();
  await expect(oracle).toHaveCount(0);
  await page.goto(`/#/p/${id}/delphes`);
  await expect(oracle).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/temple$/);
});

test('the tablets open the quest board; a launched quest shows on the tablets badge', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTemple(page, id);
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('delphi-tablets-badge')).toHaveCount(0);
  await tap(page.getByTestId('delphi-tablets'), testInfo);
  await expect(page).toHaveURL(/\/quetes$/);
  const board = page.getByTestId('overlay-tablets');
  await expect(board.getByRole('heading', { name: 'Le mur des quêtes' })).toBeVisible();
  await expect(board.getByTestId('board-boss')).toBeVisible();
  await board.getByTestId('board-challenge-echo').getByRole('button', { name: 'Lancer une quête' }).click();
  await expect(board.getByTestId('board-challenge-echo')).toContainText('Quête en cours');
  await closeOverlay(page);
  await expect(page.getByTestId('delphi-tablets-badge')).toHaveText('1');
});

test('the nearest prophecy sits on the altar, clear of the places, the dialogue dock and the safe zone; « Réviser » opens the dictation', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // A long title - clamped to 2 lines by ProphecyCard's own `-webkit-line-clamp: 2` - is the card's
  // tallest shape: the worst case for the dock/safe-zone checks below (Task 12 review fix round 1).
  const title = uniqueName('Une prophétie si longue qu elle doit remplir deux lignes entières sur la carte');
  const text = await createText(request, { title, body: BODY, level: '10H', due_date: '2099-01-01' });
  await onlyOwnProphecy(page, text.id);
  // The short viewport (900x900): stageBox() becomes width-constrained there (art height =
  // vw * 0.75 = 675px), the shortest art box this suite exercises - the worst case for a card
  // pinned at a fixed `top: 66%` whose own height depends on its (clamped) content.
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 900, height: 900 }]) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${id}/temple?debug`); // ?debug: no greeting in the way
    await expectScene(page, 'delphi');
    const card = page.getByTestId('delphi-prophecy');
    await expect(card).toContainText(title);
    const b = await measureBoxes(page, {
      art: '[data-testid="scene-delphi"] .art',
      card: '[data-testid="delphi-prophecy"]',
      pythia: '[data-testid="delphi-pythia"]',
      pythiaLabel: '[data-testid="delphi-pythia"] .hotspot-label',
      tablets: '[data-testid="delphi-tablets"]',
      tabletsLabel: '[data-testid="delphi-tablets"] .hotspot-label',
    });
    if (!b.art || !b.card) throw new Error('scene-delphi .art or delphi-prophecy did not render');
    const at = `${size.width}x${size.height}`;
    const hit = (a: typeof b.card, c: typeof b.card) => !!a && !!c && a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height;
    for (const k of ['pythia', 'pythiaLabel', 'tablets', 'tabletsLabel'] as const) {
      expect(hit(b.card, b[k]), `prophecy vs ${k} at ${at}`).toBe(false);
    }
    // The card's height depends on its content, not just its authored `top: 66%` - prove it clears
    // the dialogue dock (bottom at or above 80% of the art box) rather than assume there is room.
    expect(b.card.y + b.card.height, `altar card bottom clear of the dialogue dock at ${at}`).toBeLessThanOrEqual(
      b.art.y + b.art.height * 0.8 + 0.5,
    );
    const zoneLeft = b.art.x + b.art.width * 0.125;
    const zoneRight = b.art.x + b.art.width * 0.875;
    expect(b.card.x, `altar card left inside the safe zone at ${at}`).toBeGreaterThanOrEqual(zoneLeft - 0.5);
    expect(b.card.x + b.card.width, `altar card right inside the safe zone at ${at}`).toBeLessThanOrEqual(zoneRight + 0.5);
  }
  await page.getByTestId('delphi-prophecy').getByRole('button', { name: 'Réviser' }).click();
  await expect(page).toHaveURL(new RegExp(`/play/${text.id}$`));
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openTemple(page, id);
    await expectInSafeZone(page, 'delphi', PLACES);
    expect(await labelOverlaps(page, 'delphi'), `${size.width}x${size.height}`).toEqual([]);
    // Playability #16: the tablets' plaque hangs on the wall above them, never on the altar below
    // (expectInSafeZone keeps it below the HUD band).
    const t = await measureBoxes(page, { wall: '[data-testid="delphi-tablets"]', label: '[data-testid="delphi-tablets"] .hotspot-label' });
    expect(t.label!.y + t.label!.height, `tablets plaque above the wall at ${size.width}x${size.height}`).toBeLessThanOrEqual(t.wall!.y + 0.5);
  }
});

test('the exit sign never overlaps the dialogue dock', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size);
    await openTemple(page, id);
    await expectExitClearOfDialogueDock(page, 'delphi');
  }
});

test('opening and closing a panel never remounts the temple: no replayed entry zoom', async ({ page, request }, testInfo) => {
  // Controller ruling 5, mirroring scenes-library.spec.ts's own proof for the tent: Delphi must
  // stay the same mounted instance across `delphi` <-> `oracle`/`quests` (App.svelte's
  // `view?.place === 'delphi'` branch, not one branch per route.name), so an overlay never replays
  // SceneTransition's entry zoom.
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTemple(page, id);
  const stage = page.locator('[data-testid="scene-delphi"] .scene-transition');
  await expect(stage).toHaveAttribute('data-settled', 'true');
  const before = await stage.elementHandle();
  await tap(page.getByTestId('delphi-pythia'), testInfo);
  await expect(page).toHaveURL(/\/delphes$/);
  await expect(stage).toHaveAttribute('data-settled', 'true');
  const afterOpen = await stage.elementHandle();
  expect(await page.evaluate(([a, b]) => a === b, [before, afterOpen])).toBe(true);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/temple$/);
  await expect(stage).toHaveAttribute('data-settled', 'true');
  const afterClose = await stage.elementHandle();
  expect(await page.evaluate(([a, b]) => a === b, [before, afterClose])).toBe(true);
});

test('Delphi: ?debug outlines both places; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/temple?debug`);
  await expectScene(page, 'delphi');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(2);
  expect(await redScan(page)).toEqual([]);
  await page.goto(`/#/p/${id}/delphes`);
  await expect(page.getByTestId('overlay-pythia')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});

// Final review M4: a place whose /camp cannot be reached says so and offers « Réessayer » (it used
// to be the camp alone; the temple silently lost its greeting, its altar prophecy and its badges).
// The camp is built on the same PlaceScene now, so both are checked.
for (const place of [
  { path: 'temple', scene: 'delphi' },
  { path: 'camp', scene: 'camp' },
]) {
  test(`${place.scene}: an unreachable camp shows « Réessayer », which brings the place back`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    let fail = true;
    await page.route('**/api/profiles/*/camp', async (route) => {
      if (fail) await route.fulfill({ status: 503, json: { detail: 'Les Muses se reposent.' } });
      else await route.fallback();
    });
    await page.goto(`/#/p/${id}/${place.path}`);
    await expectScene(page, place.scene);
    const status = page.getByTestId('place-status');
    await expect(status).toContainText('Impossible de rejoindre le camp : Les Muses se reposent.');
    expect(await redScan(page)).toEqual([]);
    fail = false;
    await page.getByTestId('place-retry').click();
    await expect(status).toHaveCount(0);
    await expect(page.getByTestId('hud-xp')).toBeVisible();
  });
}
