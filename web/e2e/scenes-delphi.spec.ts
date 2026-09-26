import { test, expect } from './crashGuard';
import type { Locator, Page } from '@playwright/test';
import {
  closeOverlay,
  createProfileApi,
  createText,
  expectCamp,
  expectExitClearOfDialogueDock,
  expectInSafeZone,
  expectOverlayTapTargets,
  expectScene,
  labelOverlaps,
  measureBoxes,
  onlyOwnOracleProphecy,
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
  await expect(oracle.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', 'pythia');
  await expect(oracle.getByTestId('scroll-open')).toHaveCount(3);
  // Playability #8: the reward is said once, in the header, in dark bronze - not on each scroll.
  await expect(oracle.getByText(/Récompense de la semaine/)).toHaveCount(0);
  await expect(oracle.getByTestId('oracle-reward')).toContainText('150 XP');
  await expect(oracle.getByTestId('oracle-reward')).toHaveCSS('color', 'rgb(138, 90, 28)');
  await expect(oracle.getByTestId('scroll-ecole')).toContainText('Ce que prépare ta classe');
  await expect(oracle.getByTestId('scroll-ecole')).not.toContainText("Ce qui arrive à l'école");
  // Playability #9: the school scroll unrolls across the whole panel; every monster and « Annuler » in view.
  await oracle.getByTestId('scroll-ecole').getByTestId('scroll-open').click();
  const sheet = oracle.getByTestId('scroll-ecole');
  await expect(oracle.getByTestId('scroll-faible')).toHaveCount(0);
  // Measured once the scroll has finished unrolling (and the panel its fly-in): mid-animation a
  // size check reads a fraction short (Task S, the same class as the portal's 47.99998 px).
  await expect.poll(() => oracle.evaluate((e) => e.getAnimations({ subtree: true }).length)).toBe(0);
  const [sheetBox, bodyBox] = await Promise.all([sheet.boundingBox(), oracle.locator('.overlay-body').boundingBox()]);
  expect(sheetBox!.width, 'the unrolled scroll spans the panel').toBeGreaterThan(bodyBox!.width * 0.85);
  for (const key of ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe']) {
    const m = oracle.getByTestId(`oracle-monster-${key}`);
    await expect(m).toBeInViewport();
    const box = (await m.boundingBox())!;
    expect(Math.min(box.width, box.height), `${key} medallion button`).toBeGreaterThanOrEqual(56);
  }
  await expect(oracle.getByTestId('oracle-cancel')).toBeInViewport();
  // Re-review N12: medallions straight on the parchment (no card boxes); the confirm is the same
  // bronze as every primary, only fainter until a monster is chosen.
  await expect(oracle.getByTestId('oracle-monster-hydre')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(oracle.getByTestId('oracle-confirm')).toHaveCSS('opacity', '0.55');
  await oracle.locator('[data-testid^="oracle-monster-"]:not([disabled])').first().click();
  await expect(oracle.getByTestId('oracle-confirm')).toHaveCSS('opacity', '1');
  await expectOverlayTapTargets(page, 'overlay-pythia');
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

test('the Pythia speaks of a prophecy by its day, not its date; « Te préparer » opens the dictation', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('La dictée du jeudi'), body: BODY, level: '10H', due_date: '2099-01-01' });
  await onlyOwnOracleProphecy(page, text.id);
  await page.goto(`/#/p/${id}/delphes`);
  const row = page.getByTestId(`oracle-prophecy-${text.id}`);
  await expect(row).toContainText('jeudi 1er janvier 2099');
  await expect(row).not.toContainText('01.01.2099');
  const oracle = page.getByTestId('overlay-pythia');
  await expect(oracle).not.toContainText('multipliée');
  // Re-review N6: no « Prophéties » heading nor rule paragraph; the bonus is a tag on the strip
  // (the day is a year off, so « son jour » rather than an ambiguous weekday).
  await expect(oracle.getByText('une fois et demie')).toHaveCount(0);
  await expect(oracle.locator('h3.kit-section', { hasText: 'Prophéties' })).toHaveCount(0);
  await expect(row.getByTestId('oracle-prophecy-bonus')).toHaveText("Défendue avant son jour : +50 % d'XP");
  // Ruling W-f: a sealed week leads with the scrolls; once the week is chosen, the prophecies lead
  // (the scrolls are done until Monday).
  await expect.poll(() => sectionOrder(oracle)).toEqual(['oracle-scrolls', 'oracle-prophecies']);
  await oracle.getByTestId('scroll-faible').getByTestId('scroll-open').click();
  await expect(oracle.getByTestId('oracle-quest')).toBeVisible();
  await expect.poll(() => sectionOrder(oracle)).toEqual(['oracle-prophecies', 'oracle-scrolls', 'oracle-quest']);
  // Once chosen, the Pythia no longer asks her to choose.
  await expect(oracle.getByTestId('overlay-voice')).toContainText('Le rouleau de la semaine est ouvert');
  const btn = row.getByRole('button', { name: 'Te préparer' });
  await expect(btn).toHaveCSS('text-decoration-line', 'none');
  await btn.click();
  await expect(page).toHaveURL(new RegExp(`/play/${text.id}$`));
});

// Re-review N1, ruling W-f (replaces B4's « a prophecy due within a week leads the panel »): while
// the week is sealed, the three scrolls lead even with a prophecy due in 3 days - choosing one is
// what she came for, and the altar card already shows the prophecy - and all three are fully in
// view, below the voice plate and above the bottom rod, at both desktop sizes the app targets.
test('while the week is sealed, the three scrolls lead and are fully in view, even with a prophecy due soon', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // A real text due in 3 days would be every parallel hero's next step (the camp's greeting reads
  // all prophecies): keep the text far off and bring it near in this page's /oracle answer only.
  const text = await createText(request, { title: uniqueName('Une prophétie proche'), body: BODY, level: '10H', due_date: '2099-01-01' });
  await page.route('**/api/profiles/*/oracle', async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.prophecies = json.prophecies
      .filter((p: { text_id: number }) => p.text_id === text.id)
      .map((p: { days_left: number }) => ({ ...p, days_left: 3 }));
    await route.fulfill({ response: res, json });
  });
  const oracle = page.getByTestId('overlay-pythia');
  for (const size of [{ width: 1180, height: 820 }, { width: 1280, height: 720 }]) {
    const at = `${size.width}x${size.height}`;
    await page.setViewportSize(size);
    await page.goto(`/#/p/${id}/delphes`);
    await expect(oracle.getByTestId('scroll-open')).toHaveCount(3);
    await expect(oracle.getByTestId(`oracle-prophecy-${text.id}`)).toBeVisible();
    // The day is 3 days off: the tag names it (2099-01-01 is a Thursday).
    await expect(oracle.getByTestId('oracle-prophecy-bonus')).toHaveText("Défendue avant jeudi : +50 % d'XP");
    await expect.poll(() => sectionOrder(oracle)).toEqual(['oracle-scrolls', 'oracle-prophecies']);
    await expect.poll(() => oracle.evaluate((e) => e.getAnimations({ subtree: true }).length)).toBe(0);
    const body = (await oracle.locator('.overlay-body').boundingBox())!;
    const rod = (await oracle.locator('.scroll-rod.rod-bottom').boundingBox())!;
    for (const key of ['faible', 'ecole', 'destin']) {
      const s = (await oracle.getByTestId(`scroll-${key}`).boundingBox())!;
      expect(s.y, `scroll-${key} top inside the body at ${at}`).toBeGreaterThanOrEqual(body.y);
      expect(s.y + s.height, `scroll-${key} bottom inside the body at ${at}`).toBeLessThanOrEqual(body.y + body.height);
      expect(s.y + s.height, `scroll-${key} clear of the bottom rod at ${at}`).toBeLessThanOrEqual(rod.y);
    }
  }
});

/** The Pythia panel's sections, in the order they are drawn (their test ids). */
function sectionOrder(oracle: Locator): Promise<string[]> {
  return oracle.locator('[data-testid="oracle-scrolls"], [data-testid="oracle-prophecies"], [data-testid="oracle-quest"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
}

test('the tablets open the quest board; a launched quest shows on the tablets badge', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTemple(page, id);
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('delphi-tablets-badge')).toHaveCount(0);
  await tap(page.getByTestId('delphi-tablets'), testInfo);
  await expect(page).toHaveURL(/\/quetes$/);
  const board = page.getByTestId('overlay-tablets');
  await expect(board.getByRole('heading', { name: 'Le mur des quêtes' })).toBeVisible();
  // Playability #10: the reward and the treasure line are said once, never on each tablet.
  await expect(board.getByTestId('board-reward')).toHaveCount(1);
  await expect(board.getByText(/Récompense : \d+ XP/)).toHaveCount(0);
  await expect(board.getByTestId('board-decor')).toHaveCount(1);
  await expect(board.getByTestId('board-decor')).toContainText(/Encore \d+ quêtes?, et ta cabane gagne un trésor/);
  // Re-review N13: the Pythia says the rule and the treasure; no empty « En cours » over the wall.
  await expect(board.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', 'pythia');
  await expect(board.getByTestId('overlay-voice').getByTestId('board-reward')).toContainText('Chaque monstre défié rapporte');
  await expect(board.getByTestId('board-active')).toHaveCount(0);
  await expect(board.getByText('Aucune quête en cours')).toHaveCount(0);
  await expect(board.locator('.kit-tablet')).toHaveCount(6);
  await expect(board.getByText(/\((s|x)\)/)).toHaveCount(0);
  await expect(board.getByTestId('board-boss')).toBeVisible();
  // The whole tablet is the target: a tap on its clay, away from the pressed word, challenges.
  const echo = board.getByTestId('board-challenge-echo');
  await expect(echo.getByRole('button', { name: /^Défier / })).toHaveText('Défier');
  await expect.poll(() => board.evaluate((e) => e.getAnimations({ subtree: true }).length)).toBe(0);
  await echo.scrollIntoViewIfNeeded();
  const clay = (await echo.locator('.tablet-technique').boundingBox())!;
  await page.mouse.click(clay.x + clay.width / 2, clay.y + clay.height / 2);
  await expect(board.getByTestId('board-challenge-echo')).toContainText('Quête en cours');
  await expect(board.getByTestId('board-active')).toBeVisible();
  await expect(board.getByTestId('board-challenge-echo').getByRole('button', { name: /^Défier / })).toHaveCount(0);
  await expectOverlayTapTargets(page, 'overlay-tablets');
  await closeOverlay(page);
  await expect(page.getByTestId('delphi-tablets-badge')).toHaveText('1');
});

test('the nearest prophecy sits on the altar, clear of the places, the dialogue dock and the safe zone; « Te préparer » opens the dictation', async ({ page, request }, testInfo) => {
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
    // Playability #17: a card that can be read from the sofa, not small print.
    expect(b.card.width, `altar card width at ${at}`).toBeGreaterThanOrEqual(Math.min(380, b.art.width * 0.26) - 1);
  }
  await page.getByTestId('delphi-prophecy').getByRole('button', { name: 'Te préparer' }).click();
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
