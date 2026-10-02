// web/e2e/living-dragon.spec.ts
// Spec 2026-10-02 living dragon, "Tests" (e2e) and the plan's Review Focus: the nest and the camp draw a
// hatched dragon on a canvas and the egg as the still picture; reduced motion and no WebGL2 keep the
// still picture; the worn pieces are listed; two frames differ over time and the feet do not; the tint
// matches the still picture's (both OKLCH, Ruling L9) and never touches the pieces; a lost context or a failing
// shader fall back; the loop stops when hidden or off-screen; twenty visits never exhaust contexts.
// chromium-gl only (SwiftShader WebGL2).
import type { Page } from '@playwright/test';
import { test, expect } from './crashGuard';
import { createProfileApi, expectCamp, expectScene, heroNamer } from './helpers';
import { compareShots, dragonTint, dragonWorn, isolateDragon, settledDragon } from './dragon';
import { TINT_SPECS } from '../src/lib/world/dragon';
import MANIFEST from '../src/lib/world/accessories.json' with { type: 'json' };
import hatchling from '../src/lib/living/rig/dragon_hatchling.json' with { type: 'json' };
import young from '../src/lib/living/rig/dragon_young.json' with { type: 'json' };
import adult from '../src/lib/living/rig/dragon_adult.json' with { type: 'json' };
import illustre from '../src/lib/living/rig/dragon_illustre.json' with { type: 'json' };
import ancestral from '../src/lib/living/rig/dragon_ancestral.json' with { type: 'json' };

const heroName = heroNamer('Viv');
const RIGS = { hatchling, young, adult, illustre, ancestral };
const nest = (page: Page) => page.getByTestId('nest-dragon-layer');
const figure = (page: Page) => nest(page).locator('.dragon-figure');
// The living dragon's own files: its component chunk (a build's `LivingDragon-<hash>.js`, the dev
// server's `LivingDragon.svelte`) and the baked rigs (`dragon_<stage>-<hash>.js` or `.json`).
const LIVING_FILES = /\/(LivingDragon[^/]*\.(js|svelte)|dragon_(hatchling|young|adult|illustre|ancestral)[^/]*\.(js|json))(\?|$)/;
const frames = (page: Page) => nest(page).locator('canvas').evaluate((c) => Number((c as HTMLCanvasElement).dataset.frames ?? 0));

/** This hero's camp says: the dragon as `dragon()` returns it now (stage, tint, worn...). */
async function mockDragon(page: Page, id: number, dragon: () => Record<string, unknown>) {
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, name: 'Braise', ...dragon() };
    await route.fulfill({ response: res, json: camp });
  });
}

async function openNest(page: Page, id: number) {
  await page.goto(`/#/p/${id}/dragon`);
  await page.reload();
  await expectScene(page, 'nest');
}

test('the hatched dragon lives on a canvas in the nest and the camp; the egg stays the still picture', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let stage = 'adult';
  await mockDragon(page, id, () => ({ stage }));
  await openNest(page, id);
  expect(await settledDragon(nest(page))).toBe('living');
  await expect(nest(page).locator('canvas')).toHaveCount(1);
  await expect(nest(page).locator('img.dragon-base')).toHaveCount(0);
  await expect(nest(page).getByRole('img', { name: 'Braise', exact: true })).toBeVisible();
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  const camp = page.getByTestId('camp-dragon-layer');
  expect(await settledDragon(camp)).toBe('living');
  stage = 'egg';
  await page.reload();
  await expectCamp(page);
  expect(await settledDragon(camp)).toBe('still');
  await expect(camp.locator('img.dragon-base')).toHaveAttribute('data-src', '/art/dragon/dragon_egg_cut.webp');
  await expect(camp.locator('canvas')).toHaveCount(0);
});

test('reduced motion and a browser without WebGL2 keep the still picture, its tint and its pieces', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult', tint: 'braise', worn: ['hydre-cou'] }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openNest(page, id);
  expect(await settledDragon(nest(page))).toBe('still');
  await expect(nest(page).locator('canvas')).toHaveCount(0);
  await expect(nest(page).locator('img.dragon-base')).toHaveAttribute('data-src', '/art/dragon/dragon_adult_cut.webp');
  await expect(nest(page).locator('img.dragon-base')).toHaveAttribute('data-tint', 'braise');
  await expect(nest(page).locator('img.dragon-overlay[data-item="hydre-cou"]')).toHaveCSS('filter', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type === 'webgl2' ? null : (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
    };
  });
  // Living-dragon final review: the one-time WebGL2 probe sends it to the still picture at once, never
  // fetching the living dragon's chunk or its rig only to fail.
  const living: string[] = [];
  page.on('request', (r) => {
    if (LIVING_FILES.test(r.url())) living.push(r.url());
  });
  await openNest(page, id);
  expect(await settledDragon(nest(page))).toBe('still');
  await expect(nest(page).locator('canvas')).toHaveCount(0);
  await expect(nest(page).locator('img.dragon-overlay[data-item="hydre-cou"]')).toHaveCount(1);
  await expect.poll(() => dragonTint(nest(page))).toBe('braise');
  expect(living).toEqual([]);
});

test('a living chunk that fails to load leaves the still picture, settled, in the nest and the camp', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult', tint: 'braise' }));
  const asked: string[] = [];
  await page.route(LIVING_FILES, (route) => {
    asked.push(route.request().url());
    return route.abort();
  });
  await openNest(page, id);
  expect(await settledDragon(nest(page))).toBe('still');
  expect(asked.length, 'the chunk was asked for').toBeGreaterThan(0);
  await expect(nest(page).locator('canvas')).toHaveCount(0);
  await expect.poll(() => dragonTint(nest(page))).toBe('braise');
  // A fresh figure tries again (the failed load is forgotten; the browser may answer from its own
  // record of the failure) and settles still too, never `pending` over the still picture.
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  expect(await settledDragon(page.getByTestId('camp-dragon-layer'))).toBe('still');
});

test('the worn pieces are listed on the canvas, back to front', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult', worn: ['echo-tete', 'hydre-cou', 'lethe-queue', 'sirenes-dos'] }));
  await openNest(page, id);
  expect(await settledDragon(nest(page))).toBe('living');
  expect(await dragonWorn(nest(page))).toEqual(['lethe-queue', 'sirenes-dos', 'hydre-cou', 'echo-tete']);
  await expect(nest(page).locator('img.dragon-overlay')).toHaveCount(0);
});

test('each stage moves over time, and its feet never do', async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let stage = 'hatchling';
  await mockDragon(page, id, () => ({ stage }));
  for (const [key, rig] of Object.entries(RIGS)) {
    stage = key;
    await openNest(page, id);
    expect(await settledDragon(nest(page)), key).toBe('living');
    await isolateDragon(page, 'nest', 'nest-dragon-layer');
    const box = nest(page).locator('.dragon-base');
    const first = await box.screenshot();
    // Measured 2026-10-02 (chromium-gl, SwiftShader): the largest channel change reached 38 (young),
    // 53 (adult), 62 (illustre), 63 (hatchling) and 79 (ancestral); 24 sits well above the noise (the
    // feet's 0) and well under the smallest stage's motion.
    await expect
      .poll(async () => (await compareShots(page, first, await box.screenshot())).maxDiff, { message: `${key} moves`, timeout: 15_000 })
      .toBeGreaterThan(24);
    const later = await box.screenshot();
    const [x0, y0, x1] = rig.feet;
    const feet = await compareShots(page, first, later, { x0: x0 / 1024, y0: (y0 + 16) / 1024, x1: x1 / 1024, y1: 1008 / 1024 });
    // Measured 2026-10-02: 0 on every stage (the feet box has weight 0 for every bone); 2 leaves room
    // for the rasteriser's rounding only.
    expect(feet.maxDiff, `${key}: the feet stay put`).toBeLessThanOrEqual(2);
  }
});

test('the tint on the canvas matches the still picture under the same tint, and never touches the pieces', async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let tint = 'bronze';
  await mockDragon(page, id, () => ({ stage: 'adult', tint, worn: ['sirenes-dos'] }));
  const e = MANIFEST['sirenes-dos'].adult;
  // The saddle's box, its inner 60 %: the piece's own pixels on both pictures.
  const saddle = { x0: e.x + 0.2 * e.w, y0: e.y + 0.2 * e.h, x1: e.x + 0.8 * e.w, y1: e.y + 0.8 * e.h };
  let before: { tint: string; still: Buffer } | null = null;
  const controls: string[] = [];
  for (const t of Object.keys(TINT_SPECS)) {
    tint = t;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openNest(page, id);
    await isolateDragon(page, 'nest', 'nest-dragon-layer');
    await expect(figure(page)).toHaveAttribute('data-motion', 'still');
    // The still picture's tinted copy is made on a canvas: wait for it (Ruling L9).
    await expect(nest(page).locator('img.dragon-base')).toHaveAttribute('data-tint', t);
    const still = await nest(page).locator('.dragon-base').screenshot();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(figure(page)).toHaveAttribute('data-motion', 'living');
    await expect(nest(page).locator('.dragon-base')).toHaveAttribute('data-tint', t);
    const living = await nest(page).locator('.dragon-base').screenshot();
    const whole = await compareShots(page, still, living);
    const piece = await compareShots(page, still, living, saddle);
    // Measured 2026-10-02 (mean channel gap, still against living): over the dragon 0.45 to 0.71 for
    // every tint but argent, whose channels reach 0.79, 0.85 and 1.05; over the saddle 0.43 to 0.63. The gap is the idle pose
    // (the living frame is never the rest pose), not the tint: a tinted saddle, or a tint off by a
    // preset, moves these means by tens.
    for (let k = 0; k < 3; k++) expect(Math.abs(whole.meanA[k] - whole.meanB[k]), `${t}: channel ${k} over the dragon`).toBeLessThan(2.5);
    for (let k = 0; k < 3; k++) expect(Math.abs(piece.meanA[k] - piece.meanB[k]), `${t}: channel ${k} over the saddle`).toBeLessThan(4);
    // The negative control: the living dragon under this tint against the still picture under the
    // previous one. Measured 2026-10-03 (chromium-gl, SwiftShader; largest mean channel gap): bronze /
    // écume 27.59, écume / olivier 23.08, olivier / braise 16.21, braise / jade 29.07, jade / argent
    // 35.18. The closest pair sits six times above the 2.5 above, so that threshold tells tints apart.
    if (before) {
      const off = await compareShots(page, before.still, living);
      const gap = Math.max(...[0, 1, 2].map((k) => Math.abs(off.meanA[k] - off.meanB[k])));
      controls.push(`${before.tint} still / ${t} living: ${gap.toFixed(2)}`);
      expect(gap, `${before.tint} still against ${t} living: the threshold tells two tints apart`).toBeGreaterThan(2.5);
    }
    before = { tint: t, still };
  }
  testInfo.annotations.push({ type: 'tint controls', description: controls.join('; ') });
});

test('a lost context brings the still picture back, never a blank box', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await openNest(page, id);
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await nest(page).locator('canvas').evaluate((c) => (c as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
  await expect(figure(page)).toHaveAttribute('data-motion', 'still');
  await expect(nest(page).locator('img.dragon-base')).toBeVisible();
  await expect(nest(page).locator('canvas')).toHaveCount(0);
});

// Ruling L2 (plan R4): a failure is final for that mount only; reduced motion lifted mounts a fresh
// try, on a new canvas.
test('after a lost context, reduced motion switched on and off tries again on a fresh canvas', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await openNest(page, id);
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await nest(page).locator('canvas').evaluate((c) => {
    (c as HTMLCanvasElement).dataset.mark = 'first';
    (c as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
  });
  await expect(figure(page)).toHaveAttribute('data-motion', 'still');
  await expect(nest(page).locator('canvas')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // The figure is still already, so nothing shows that reduced motion got through: two frames let
  // the page take it in before it is lifted (both changes in one flush would leave the stage as it was).
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await expect(figure(page)).toHaveAttribute('data-motion', 'still');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await expect(nest(page).locator('canvas')).toHaveCount(1);
  await expect(nest(page).locator('canvas')).not.toHaveAttribute('data-mark', 'first');
  await expect.poll(() => frames(page)).toBeGreaterThan(0);
});

test('a shader that fails to compile leaves the still picture', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await page.addInitScript(() => {
    const get = WebGL2RenderingContext.prototype.getShaderParameter;
    WebGL2RenderingContext.prototype.getShaderParameter = function (this: WebGL2RenderingContext, s: WebGLShader, p: number) {
      return p === this.COMPILE_STATUS ? false : get.call(this, s, p);
    };
  });
  await openNest(page, id);
  expect(await settledDragon(nest(page))).toBe('still');
  await expect(nest(page).locator('img.dragon-base')).toBeVisible();
  await expect(nest(page).locator('canvas')).toHaveCount(0);
});

test('the loop stops when the page is hidden or the dragon off-screen, and never draws past 30 fps', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await openNest(page, id);
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  const n0 = await frames(page);
  await page.waitForTimeout(2000);
  const n1 = await frames(page);
  // Measured 2026-10-02: 60 frames in 2 s (the 30 fps gate exactly); 64 allows one late tick either
  // side of the window, 10 a stalled host.
  expect(n1 - n0, 'frames in 2 s').toBeLessThanOrEqual(64);
  expect(n1 - n0, 'frames in 2 s').toBeGreaterThanOrEqual(10);
  const setHidden = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  const hidden = await frames(page);
  await page.waitForTimeout(1000);
  expect(await frames(page), 'no frame while hidden').toBe(hidden);
  await setHidden(false);
  await expect.poll(() => frames(page)).toBeGreaterThan(hidden);
  await nest(page).evaluate((el) => ((el as HTMLElement).style.transform = 'translate(-5000px, 0)'));
  await page.waitForTimeout(300);
  const away = await frames(page);
  await page.waitForTimeout(1000);
  expect(await frames(page), 'no frame while off-screen').toBe(away);
  await nest(page).evaluate((el) => ((el as HTMLElement).style.transform = ''));
  await expect.poll(() => frames(page)).toBeGreaterThan(away);
});

test('twenty visits between the camp and the nest never run out of WebGL contexts', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  const warnings: string[] = [];
  // The browser's own lines when contexts run out or one is lost (Chromium: « WARNING: Too many active
  // WebGL contexts », « CONTEXT_LOST_WEBGL »; any « WebGL: » line), not every message with the word
  // « context » in it.
  page.on('console', (m) => {
    if (/WebGL|too many active|CONTEXT_LOST/i.test(m.text())) warnings.push(m.text());
  });
  for (let i = 0; i < 20; i++) {
    await page.goto(`/#/p/${id}/camp`);
    await expectCamp(page);
    await expect(page.getByTestId('camp-dragon-layer').locator('.dragon-figure')).toHaveAttribute('data-motion', 'living');
    await page.goto(`/#/p/${id}/dragon`);
    await expectScene(page, 'nest');
    await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  }
  // Measured 2026-10-02: SwiftShader prints no line matching this over the twenty visits, so the rule
  // needs no exception.
  expect(warnings).toEqual([]);
});

test('a tint picked in the care panel recolours the living dragon in place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let tint = 'bronze';
  let dragon: Record<string, unknown> = {};
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage: 'adult', name: 'Braise', tint, unlocked_tints: ['bronze', 'ecume'] };
    dragon = camp.dragon;
    await route.fulfill({ response: res, json: camp });
  });
  await page.route(`**/api/profiles/${id}/dragon`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    tint = 'ecume';
    await route.fulfill({ json: { ...dragon, tint } });
  });
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await nest(page).locator('canvas').evaluate((c) => ((c as HTMLCanvasElement).dataset.mark = 'first'));
  await page.getByTestId('dragon-tint-ecume').click();
  await expect.poll(() => dragonTint(nest(page))).toBe('ecume');
  await expect(nest(page).locator('canvas')).toHaveAttribute('data-mark', 'first');
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
});

test('a piece put on in the care panel rides the living dragon at once', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const piece = (item: string, equipped: boolean) => ({
    id: `accessory:${item}`, kind: 'accessory', name: item, desc: '', source: 'stall', granted_at: '2026-08-03T10:00:00', equipped,
  });
  await mockDragon(page, id, () => ({ stage: 'adult', worn: [] }));
  await page.route(`**/api/profiles/${id}/rewards`, (route) => route.fulfill({ json: [piece('hydre-cou', false)] }));
  await page.route(`**/api/profiles/${id}/rewards/accessory:hydre-cou`, (route) => route.fulfill({ json: piece('hydre-cou', true) }));
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await nest(page).locator('canvas').evaluate((c) => ((c as HTMLCanvasElement).dataset.mark = 'first'));
  await page.getByTestId('overlay-care').getByTestId('parure-hydre-cou').click();
  await expect.poll(() => dragonWorn(nest(page))).toEqual(['hydre-cou']);
  await expect(nest(page).locator('canvas')).toHaveAttribute('data-mark', 'first');
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
});

test('reduced motion switched on and off swaps the canvas and the still picture, one at a time', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await openNest(page, id);
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(figure(page)).toHaveAttribute('data-motion', 'still');
  await expect(nest(page).locator('canvas')).toHaveCount(0);
  await expect(nest(page).locator('.dragon-base')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await expect(nest(page).locator('.dragon-base')).toHaveCount(1);
  await expect(nest(page).locator('canvas')).toHaveCount(1);
});
