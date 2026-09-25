import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import {
  createProfileApi,
  expectFocusRingInsideBody,
  expectOverlayClearsScene,
  expectOverlayTapTargets,
  expectScene,
  redScan,
  tap,
  uniqueName,
} from './helpers';

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
  // Task 8: the texts are rolled scrolls in cubbies, not legacy cards, pills or buttons.
  await expect(shelves.locator('.kit-cubby').first()).toBeVisible();
  await expect(shelves.locator('.card, .btn, .chip')).toHaveCount(0);
  await expectOverlayClearsScene(page, 'overlay-shelves', 'library', true);
  // The labels come back once it closes.
  await shelves.getByTestId('overlay-close').click();
  await expect(shelves).toHaveCount(0);
  await expect
    .poll(() => page.getByTestId('library-shelves').locator('.hotspot-label').evaluate((e) => getComputedStyle(e).opacity))
    .toBe('1');
});

test('the desk is a scroll: two rods, torn sides, below the HUD; the owl waits behind it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/texts/new`);
  const desk = page.getByTestId('overlay-desk');
  await expect(desk).toHaveAttribute('data-variant', 'scroll');
  await expect(desk.locator('.scroll-rod')).toHaveCount(2);
  const mask = await desk
    .locator('.surface-sheet')
    .evaluate((e) => getComputedStyle(e).getPropertyValue('-webkit-mask-image') || getComputedStyle(e).getPropertyValue('mask-image'));
  expect(mask).toContain('data:image/svg+xml');
  // Ruling W-b: the owl's greeting (a deep link greets too) is only faded under the desk, not
  // closed; the overlay helper's poll proves it is at opacity 0 while the desk is open.
  const dialogue = page.getByTestId('scene-library').getByTestId('dialogue-box');
  await expect(dialogue).toHaveCount(1);
  await expectOverlayClearsScene(page, 'overlay-desk', 'library', true);
  // Review fix round 1 #1: the full-width textarea's focus ring is never clipped by the body.
  await expectFocusRingInsideBody(page, 'overlay-desk', desk.locator('textarea'));
  await desk.getByTestId('overlay-close').click();
  await expect(desk).toHaveCount(0);
  await expect.poll(() => dialogue.evaluate((e) => getComputedStyle(e).opacity)).toBe('1');
  await expect(page.getByTestId('scene-library').getByTestId('dialogue-text')).toContainText('Hou !');
});

// Review fix round 1 #2: on the narrowest landscape iPads the scroll's knobs stay on screen, and a
// full-width lens button keeps its whole focus ring (#1).
async function knobsOnScreen(page: Page, overlayTestId: string) {
  const { rods, vw } = await page.evaluate((id) => {
    const out = Array.from(document.querySelectorAll(`[data-testid="${id}"] .scroll-rod`)).map((r) => {
      const box = r.getBoundingClientRect();
      const before = getComputedStyle(r, '::before');
      const after = getComputedStyle(r, '::after');
      return {
        left: box.left + parseFloat(before.left),
        right: box.right - parseFloat(after.right),
      };
    });
    return { rods: out, vw: innerWidth };
  }, overlayTestId);
  expect(rods).toHaveLength(2);
  for (const r of rods) {
    expect(r.left, `${overlayTestId}: left knob on screen`).toBeGreaterThanOrEqual(0);
    expect(r.right, `${overlayTestId}: right knob on screen`).toBeLessThanOrEqual(vw);
  }
}

for (const size of [
  { width: 1024, height: 768 },
  { width: 1080, height: 810 },
]) {
  test(`the lens scroll fits a ${size.width}x${size.height} screen, knobs and focus rings included`, async ({ page, request }, testInfo) => {
    await page.setViewportSize(size);
    const id = await createProfileApi(request, hero(testInfo.project.name));
    await page.goto(`/#/p/${id}/texts/scan`);
    const lens = page.getByTestId('overlay-lens');
    await expect(lens).toHaveAttribute('data-variant', 'scroll');
    await expectOverlayClearsScene(page, 'overlay-lens', 'library', true);
    await knobsOnScreen(page, 'overlay-lens');
    await lens.getByTestId('scan-input').first().setInputFiles('/work/server/tests/fixtures/scan/handout.png');
    const read = lens.getByTestId('btn-scan-read');
    await expect(read).toBeEnabled();
    await expectFocusRingInsideBody(page, 'overlay-lens', read);
  });
}

// Found by the batch B3 full run (flaky « the portal opens the works… »): an overlay that comes back
// while it is still fading out (its route left and returned within the 160 ms fade - Back then a
// quick tap on the same work) is the same {#if} branch resumed by Svelte, not a new one. Its leave
// had already stopped it catching taps and Escape; the resumed intro must hand both back.
test('an overlay brought back during its fade-out still takes taps and Escape', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/parchemins`);
  const shelves = page.getByTestId('overlay-shelves');
  await expect(shelves).toBeVisible();
  // Leave and come back two frames later, well inside the 160 ms fade.
  await page.evaluate(async (pid) => {
    location.hash = `#/p/${pid}/tente-parchemins`;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    location.hash = `#/p/${pid}/parchemins`;
  }, id);
  await expect(page).toHaveURL(/\/parchemins$/);
  await expect(shelves).toHaveCount(1);
  await expect.poll(() => shelves.evaluate((e) => getComputedStyle(e).pointerEvents)).not.toBe('none');
  await page.keyboard.press('Escape');
  await expect(shelves).toHaveCount(0);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await page.evaluate(async (pid) => {
    location.hash = `#/p/${pid}/parchemins`;
  }, id);
  await expect(shelves).toBeVisible();
  await page.evaluate(async (pid) => {
    location.hash = `#/p/${pid}/tente-parchemins`;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    location.hash = `#/p/${pid}/parchemins`;
  }, id);
  await shelves.getByTestId('overlay-close').click({ timeout: 5_000 });
  await expect(shelves).toHaveCount(0);
});

// Task 10: Alexandria is an open book - two pages either side of the gutter, and nothing crosses it.
test('the portal is a codex: two pages, and nothing crosses the gutter', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/alexandria`);
  const portal = page.getByTestId('overlay-portal');
  await expect(portal).toHaveAttribute('data-variant', 'codex');
  await expect(portal.getByTestId('work-card').first()).toBeVisible();
  await expectOverlayClearsScene(page, 'overlay-portal', 'library', true);
  await expect(portal.locator('.codex-spread')).toHaveCount(1);
  const pages = portal.locator('.codex-page');
  await expect(pages).toHaveCount(2);
  if ((page.viewportSize()?.width ?? 0) > 900) {
    const spread = (await portal.locator('.codex-spread').boundingBox())!;
    const gutter = spread.x + spread.width / 2;
    const [left, right] = [(await pages.nth(0).boundingBox())!, (await pages.nth(1).boundingBox())!];
    expect(left.x + left.width, 'left page ends before the gutter').toBeLessThanOrEqual(gutter);
    expect(right.x, 'right page starts after the gutter').toBeGreaterThanOrEqual(gutter);
  }
});

// Review fix round 1 #7: the title has no HUD, so its overlays centre in the whole screen.
test('the title has no HUD band: the naming ritual centres in the whole screen', async ({ page }) => {
  await page.goto('/#/profiles/new');
  await expectScene(page, 'title');
  const ritual = page.getByTestId('overlay-hero-new');
  await expectOverlayClearsScene(page, 'overlay-hero-new', 'title', false);
  const box = (await ritual.boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(Math.abs(box.y + box.height / 2 - vh / 2), 'centred in the viewport').toBeLessThanOrEqual(1);
});

test('the quest tablets hang on a wood table; the temple plaque and labels fade', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/quetes`);
  const board = page.getByTestId('overlay-tablets');
  await expect(board).toHaveAttribute('data-variant', 'table');
  // Task 12: terracotta tablets on cords and pinned sheets, not legacy cards, pills or buttons.
  await expect(board.locator('.kit-tablet')).toHaveCount(6);
  await expect(board.locator('.card, .btn, .chip, .parchment')).toHaveCount(0);
  await expectOverlayClearsScene(page, 'overlay-tablets', 'delphi', true);
});

// Task 13 (playability #1, #12, #21, #25; Rulings W1, W2, W4): the sweep of every overlay, each
// opened by its deep link on a fresh hero - its variant, clear of the HUD with the scene's words
// faded, 48 px targets, kit classes only, and the character who speaks in it. The work overlay needs
// a real work id (its own test below); « Tous les héros » needs more than five heroes to matter and
// stays with scenes-title.spec.ts; the camp's hero panel is a legacy screen until UI3b.
const OVERLAYS = [
  { hash: () => '/profiles/new', testId: 'overlay-hero-new', scene: 'title', hud: false, variant: 'scroll', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/parchemins`, testId: 'overlay-shelves', scene: 'library', hud: true, variant: 'table', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/texts/new`, testId: 'overlay-desk', scene: 'library', hud: true, variant: 'scroll', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/texts/scan`, testId: 'overlay-lens', scene: 'library', hud: true, variant: 'scroll', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/alexandria`, testId: 'overlay-portal', scene: 'library', hud: true, variant: 'codex', voice: 'owl' },
  { hash: (id: number) => `/p/${id}/delphes`, testId: 'overlay-pythia', scene: 'delphi', hud: true, variant: 'scroll', voice: 'pythia' },
  { hash: (id: number) => `/p/${id}/quetes`, testId: 'overlay-tablets', scene: 'delphi', hud: true, variant: 'table', voice: null },
] as const;

const LEGACY = '.btn, .btn-primary, .btn-ghost, .card, .chip, .chip-active, .parchment';

async function expectInWorldOverlay(page: Page, testId: string, scene: string, hud: boolean, variant: string, voice: string | null) {
  const panel = page.getByTestId(testId);
  await expect(panel).toHaveAttribute('data-variant', variant);
  await expectOverlayClearsScene(page, testId, scene, hud);
  await expectOverlayTapTargets(page, testId);
  await expect(panel.locator(LEGACY)).toHaveCount(0);
  if (voice) await expect(panel.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', voice);
  else await expect(panel.getByTestId('overlay-voice')).toHaveCount(0);
  expect(await redScan(page)).toEqual([]);
}

for (const o of OVERLAYS) {
  test(`${o.testId}: an in-world ${o.variant}, clear of the HUD, 48 px targets, kit classes only`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, hero(testInfo.project.name));
    await page.goto(`/#${o.hash(id)}`);
    await expectInWorldOverlay(page, o.testId, o.scene, o.hud, o.variant, o.voice);
  });
}

test('overlay-portal-work: an in-world codex, clear of the HUD, 48 px targets, kit classes only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/alexandria`);
  const portal = page.getByTestId('overlay-portal');
  await expect(portal.getByTestId('work-card').first()).toBeVisible();
  await portal.getByTestId('work-card').first().click();
  await expect(page.getByTestId('overlay-portal-work').getByTestId('btn-refresh-work')).toBeVisible();
  await expectInWorldOverlay(page, 'overlay-portal-work', 'library', true, 'codex', null);
});
