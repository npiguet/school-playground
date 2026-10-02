import type { Locator, Page } from '@playwright/test';
import { test, expect } from './crashGuard';
import { createProfileApi, heroNamer, tap } from './helpers';

// Spec 2026-09-29 explanations §3, §5 (plan R12).
const heroName = heroNamer('Guide');
const TITLES = ['La gloire et ton dragon', 'Les sceaux', 'Les drachmes', 'Les aides', 'Les combats contre Éris'];

/** Whether `inner` lies inside `outer`'s box (a pixel of slack for sub-pixel layout). */
async function inside(inner: Locator, outer: Locator): Promise<string> {
  const [a, b] = [await inner.boundingBox(), await outer.boundingBox()];
  if (!a || !b) return 'no box';
  const ok = a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1;
  return ok ? 'inside' : `${JSON.stringify(a)} outside ${JSON.stringify(b)}`;
}

/** The guide is an open book that can be read whole: its title and the dragon's plate in view, two
 *  pages, and every section reachable inside the book (fix round 1, C1/I1). */
async function expectReadable(page: Page, guide: Locator) {
  await expect.poll(() => guide.evaluate((e) => e.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(guide.locator('.overlay-title')).toHaveText('Le guide du camp');
  await expect(guide.locator('.overlay-title')).toBeInViewport({ ratio: 1 });
  await expect(guide.getByTestId('overlay-voice')).toBeInViewport({ ratio: 1 });
  expect(await inside(guide.locator('.overlay-title'), guide)).toBe('inside');
  expect(await inside(guide.getByTestId('overlay-voice'), guide)).toBe('inside');
  await expect(guide.locator('.codex-spread')).toHaveCount(1);
  const pages = guide.locator('.codex-page');
  await expect(pages).toHaveCount(2);
  await expect(pages.nth(0).locator('h3')).toHaveText(TITLES.slice(0, 2));
  await expect(pages.nth(1).locator('h3')).toHaveText(TITLES.slice(2));
  for (const id of ['gloire', 'sceaux', 'drachmes', 'aides', 'eris']) {
    // Each page scrolls inside the book: its section's last line comes into view there.
    const last = guide.getByTestId(`guide-${id}`).locator('p, li').last();
    await last.scrollIntoViewIfNeeded();
    await expect(last, id).toBeInViewport({ ratio: 1 });
    expect(await inside(last, guide), id).toBe('inside');
  }
}

for (const [width, height] of [
  [1280, 720],
  [1024, 768],
  [1180, 820],
] as const) {
  test(`at ${width}×${height} the guide opens from the lyre as a book read whole, and its seal steps back to the lyre`, async ({ page, request }, testInfo) => {
    await page.setViewportSize({ width, height });
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    await page.goto(`/#/p/${id}/settings`);
    const lyre = page.getByTestId('overlay-lyre');
    await expect(lyre).toBeVisible();
    await tap(lyre.getByTestId('lyre-guide'), testInfo);
    await expect(page).toHaveURL(/\/cabane\?panel=guide$/);
    const guide = page.getByTestId('overlay-guide');
    await expect(guide).toBeVisible();
    await expect(guide.locator('h3')).toHaveText(TITLES);
    await expect(guide.getByTestId('guide-aides')).toContainText('20\u202f% de gloire');
    await expect(guide.getByTestId('guide-gloire')).toContainText('Dragonnet\u202f: 100 XP');
    await expectReadable(page, guide);
    await tap(guide.getByTestId('overlay-close'), testInfo);
    await expect(page).toHaveURL(/\/settings$/);
    await expect(lyre).toBeVisible();
    // Fix round 1, M1: focus goes back to the button that opened the guide.
    await expect(lyre.getByTestId('lyre-guide')).toBeFocused();
  });
}

// SP5 fix wave (the final review's open check): the guide is all text, nothing in it takes focus, so
// each part of the book that scrolls takes a Tab stop of its own and scrolls from the keyboard
// (WebKit, the iPad's engine, cannot scroll a region it cannot focus). A wide book scrolls each
// page; a narrow one (900 px or less) scrolls the whole book.
for (const [width, height] of [
  [1024, 768],
  [880, 700],
] as const) {
  test(`at ${width}×${height} every part of the guide that scrolls can be scrolled from the keyboard`, async ({ page, request }, testInfo) => {
    await page.setViewportSize({ width, height });
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    await page.goto(`/#/p/${id}/cabane?panel=guide`);
    const guide = page.getByTestId('overlay-guide');
    await expect(guide.locator('h3')).toHaveText(TITLES);
    await expect.poll(() => guide.evaluate((e) => e.getAnimations({ subtree: true }).length)).toBe(0);
    const regions = guide.locator('.overlay-body, .codex-page');
    const scrolling: number[] = [];
    for (let i = 0; i < (await regions.count()); i++) {
      const r = regions.nth(i);
      const scrolls = await r.evaluate((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1);
      // Only a region that scrolls is a Tab stop: one that does not would be a stop with nothing to do.
      if (scrolls) {
        await expect(r).toHaveAttribute('tabindex', '0');
        scrolling.push(i);
      } else await expect(r).not.toHaveAttribute('tabindex');
    }
    expect(scrolling.length, 'the guide is longer than the book').toBeGreaterThan(0);
    // From the seal, Tab reaches each scrolling region in turn; PageDown and End scroll it.
    await guide.getByTestId('overlay-close').focus();
    for (const i of scrolling) {
      const r = regions.nth(i);
      await page.keyboard.press('Tab');
      await expect(r).toBeFocused();
      await page.keyboard.press('PageDown');
      await expect.poll(() => r.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
      await page.keyboard.press('End');
      await expect.poll(() => r.evaluate((e) => Math.ceil(e.scrollTop + e.clientHeight) >= e.scrollHeight - 1)).toBe(true);
      await page.keyboard.press('Home');
      await expect.poll(() => r.evaluate((e) => e.scrollTop)).toBe(0);
      await page.keyboard.press('ArrowDown');
      await expect.poll(() => r.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    }
  });
}

// Review focus 4: the numbers are the server's.
test('the guide reads the rules the server serves', async ({ page, request }, testInfo) => {
  await page.route('**/api/world', async (route) => {
    const world = await (await route.fetch()).json();
    world.rules.aid_bonus = 0.3;
    world.rules.fights[0] = { level: 1, count: 3 };
    await route.fulfill({ json: world });
  });
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?panel=guide`);
  const guide = page.getByTestId('overlay-guide');
  await expect(guide.getByTestId('guide-aides')).toContainText('30\u202f% de gloire');
  await expect(guide.getByTestId('guide-eris')).toContainText('Combat I\u202f: trois lieutenants au sceau de bois');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
