import { test, expect, type Page } from '@playwright/test';
import { createProfileApi, expectFocusRingInsideBody, expectOverlayClearsScene, expectScene, tap, uniqueName } from './helpers';

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
  await expect(page.getByTestId('overlay-tablets')).toHaveAttribute('data-variant', 'table');
  await expectOverlayClearsScene(page, 'overlay-tablets', 'delphi', true);
});
