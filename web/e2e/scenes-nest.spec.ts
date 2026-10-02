import { test, expect } from './crashGuard';
import {
  closeOverlay,
  createProfileApi,
  expectCamp,
  expectInSafeZone,
  expectInWorldOverlay,
  expectLineOf,
  expectScene,
  measureBoxes,
  redScan,
  tap,
  heroNamer,
} from './helpers';

// UI3b Task 4 (scenes spec §3 Dragon's nest, §10). desktop + ipad.

const heroName = heroNamer('Nid');

test('the nest: the egg in the straw, its growth, its greeting; the exit leads back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon`);
  await expectScene(page, 'nest');
  await expect(page.locator('[data-testid="scene-nest"] .stage-plaque')).toHaveText('Le nid du dragon');
  // UI5 Ruling E12: one of the egg's nest.enter lines.
  await expectLineOf(page.getByTestId('dialogue-box'), 'nest.enter');
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('nest-dragon-layer').locator('img.dragon-base')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');
  await expect(page.getByTestId('dragon-stage')).toHaveText('Œuf');
  // UI3b playability #5 (XP since sub-project 3): the next stage and the XP toward it, a sentence for
  // its mood, a pinned sheet.
  await expect(page.getByTestId('nest-growth')).toContainText('Prochaine étape\u202f: Dragonnet');
  await expect(page.getByTestId('nest-growth')).toContainText('0 sur 100 XP');
  await expect(page.getByTestId('nest-growth')).toContainText('Il frémit dans sa coquille.');
  await expect(page.getByTestId('nest-growth')).toHaveClass(/kit-sheet/);
  await expect(page.getByTestId('nest-dragon')).toContainText('Un œuf de dragon');
  const b = await measureBoxes(page, { growth: '[data-testid="nest-growth"]', dragon: '[data-testid="nest-dragon"]' });
  expect(b.growth!.x + b.growth!.width, 'growth parchment left of the dragon').toBeLessThanOrEqual(b.dragon!.x);
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

test('the dragon opens its care and speaks; locked tints say how to win them', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon?debug`); // ?debug: no greeting in the way
  await expectScene(page, 'nest');
  await tap(page.getByTestId('nest-dragon'), testInfo);
  await expect(page).toHaveURL(/\/dragon\?panel=soin$/);
  const care = page.getByTestId('overlay-care');
  await expect(care.getByRole('heading', { name: 'Ton dragon', level: 2 })).toBeVisible();
  await expect(care.getByTestId('overlay-voice')).toContainText('Je frémis dans la paille. Encore quelques textes défendus, et je sors de ma coquille.');
  await expect(care).toContainText('Tu lui donneras un nom quand il éclora.');
  await expect(care.getByRole('heading', { name: 'Son nom' })).toHaveCount(0);
  await expect(care.getByTestId('dragon-tint-bronze')).toBeVisible();
  await expect(care.getByTestId('dragon-tint-ecume')).toBeDisabled();
  // UI3b playability #4: the locked rule is said once, under the row.
  await expect(care.getByTestId('dragon-tint-how')).toHaveText("Les autres teintes se gagnent dans les quêtes de l'Oracle.");
  await expect(care.getByTestId('dragon-tint-ecume')).toHaveAccessibleName(/Écume.*quêtes de l'Oracle/);
  await expect(care.getByTestId('dragon-tint-ecume').locator('img[src="/art/icons/lock.webp"]')).toBeVisible();
  // Fix round 1: the tint filters the egg picture only. Nothing around it is filtered, so the ring
  // keeps its own colour (a filtered ring turned violet, Éris's colour) and the lock stays readable;
  // a locked egg is grey, never tinted.
  const token = (name: string) =>
    page.evaluate((n) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${n})`;
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    }, name);
  const filtersAbove = (t: string) =>
    care.getByTestId(`dragon-tint-${t}`).locator('.swatch-egg').evaluate((img) => {
      const out: string[] = [];
      for (let el = img.parentElement; el && el.dataset.testid !== 'overlay-care'; el = el.parentElement) {
        const f = getComputedStyle(el).filter;
        if (f !== 'none') out.push(f);
      }
      return out;
    });
  for (const t of ['bronze', 'ecume', 'argent']) expect(await filtersAbove(t), t).toEqual([]);
  await expect(care.getByTestId('dragon-tint-bronze').locator('.swatch-circle')).toHaveCSS('border-top-color', await token('--olive'));
  await expect(care.getByTestId('dragon-tint-ecume').locator('.swatch-circle')).toHaveCSS('border-top-color', await token('--ink-soft'));
  await expect(care.getByTestId('dragon-tint-ecume').locator('.lock')).toHaveCSS('filter', 'none');
  await expect(care.getByTestId('dragon-tint-ecume').locator('.swatch-egg')).toHaveCSS('filter', /grayscale\(1\)/);
  await expect(care.getByTestId('dragon-tint-bronze').locator('.swatch-egg')).toHaveCSS('filter', 'none');
  await closeOverlay(page);
  await expect(page.getByTestId('nest-dragon')).toBeFocused();
});

test('a name being typed survives a tint tapped (a new camp snapshot) (final review I5)', async ({ page, request }, testInfo) => {
  // A hatched dragon, named, with a second tint to pick: /camp and the tint PATCH are this test's.
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const camp = await (await route.fetch()).json();
    camp.dragon = { ...camp.dragon, stage: 'hatchling', name: 'Braise', unlocked_tints: ['bronze', 'ecume'] };
    await route.fulfill({ json: camp });
  });
  await page.route(`**/api/profiles/${id}/dragon`, async (route) => {
    const tint = (route.request().postDataJSON() as { tint?: string }).tint ?? 'bronze';
    await route.fulfill({ json: { name: 'Braise', tint, stage: 'hatchling' } });
  });
  await page.goto(`/#/p/${id}/dragon?panel=soin&debug`);
  const care = page.getByTestId('overlay-care');
  const input = care.getByTestId('dragon-name-input');
  await expect(input).toHaveValue('Braise');
  await input.fill('Aile');
  await care.getByTestId('dragon-tint-ecume').click();
  await expect(care.getByTestId('dragon-tint-ecume')).toHaveClass(/selected/);
  await expect(input).toHaveValue('Aile');
  expect(await redScan(page)).toEqual([]);
});

test('overlay-care: an in-world scroll, clear of the HUD, 48 px targets, kit classes only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  await expectInWorldOverlay(page, 'overlay-care', 'nest', true, 'scroll', 'dragon');
});

test('the HUD dragon leads to the nest; place and label sit in the safe zone', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page.getByTestId('hud-dragon'), testInfo);
  await expect(page).toHaveURL(/\/dragon$/);
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await expectScene(page, 'nest');
    await expectInSafeZone(page, 'nest', ['nest-dragon']);
  }
});

test('nest: ?debug outlines the dragon; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon?debug`);
  await expectScene(page, 'nest');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(1);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});

// Spec 2026-09-29 dragon growth §3: each of the six stages in the straw bed, with its name and what it
// is up to; the biggest stays clear of its growth sheet and below the HUD. The stage is set by
// intercepting this hero's /camp with an XP total that fits it (the real XP-driven growth is pinned by
// the server tests and world.spec), so no impossible state (« 0 sur 100 XP » at the top) renders.
const XP_AT: Record<string, { total: number; floor: number; next: number | null }> = {
  egg: { total: 0, floor: 0, next: 100 },
  hatchling: { total: 150, floor: 100, next: 1200 },
  young: { total: 3100, floor: 1200, next: 5000 },
  adult: { total: 6000, floor: 5000, next: 15000 },
  illustre: { total: 20000, floor: 15000, next: 40000 },
  ancestral: { total: 41000, floor: 40000, next: null },
};
const STAGES = [
  ['egg', 'Œuf', 'Il frémit dans sa coquille.'],
  ['hatchling', 'Dragonnet', 'Il est curieux.'],
  ['young', 'Jeune dragon', "Il s'entraîne à voler."],
  ['adult', 'Dragon adulte', 'Il monte la garde.'],
  ['illustre', 'Dragon illustre', 'Il veille sur le camp et raconte ses exploits.'],
  ['ancestral', 'Dragon ancestral', 'Il lit les vieux parchemins et veille sur toi.'],
] as const;

test('the nest shows each of the six stages, clear of its growth sheet and of the HUD', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let stage: string = 'egg';
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage, name: stage === 'egg' ? null : 'Braise' };
    camp.xp = { ...camp.xp, ...XP_AT[stage] };
    await route.fulfill({ response: res, json: camp });
  });
  for (const [key, label, activity] of STAGES) {
    stage = key;
    await page.goto(`/#/p/${id}/dragon?debug`);
    await page.reload();
    await expectScene(page, 'nest');
    await expect(page.getByTestId('nest-dragon-layer').locator('img.dragon-base')).toHaveAttribute('src', `/art/dragon/dragon_${key}_cut.webp`);
    await expect(page.getByTestId('dragon-stage')).toHaveText(label);
    await expect(page.getByTestId('nest-growth')).toContainText(activity);
    const b = await measureBoxes(page, { growth: '[data-testid="nest-growth"]', layer: '[data-testid="nest-dragon-layer"] img.dragon-base', hud: 'header.hud' });
    // Spec 2026-10-02 nest by stage: beside the dragon on the left up to the young, at the right side
    // of the frame from the adult (Task 5 widens this test to the paintings and the hotspot).
    if (['adult', 'illustre', 'ancestral'].includes(key)) {
      await expect(page.getByTestId('nest-growth')).toHaveAttribute('data-side', 'right');
      expect(b.growth!.x, `${key}: the growth sheet right of the dragon`).toBeGreaterThanOrEqual(b.layer!.x + b.layer!.width - 2);
    } else {
      await expect(page.getByTestId('nest-growth')).toHaveAttribute('data-side', 'left');
      expect(b.growth!.x + b.growth!.width, `${key}: the growth sheet left of the dragon`).toBeLessThanOrEqual(b.layer!.x + 2);
    }
    expect(b.layer!.y, `${key}: the dragon's picture below the HUD`).toBeGreaterThanOrEqual(b.hud!.y + b.hud!.height - 2);
  }
});

test('the growth sheet: the next stage and the XP toward it; « Il a fini de grandir. » at the top', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let fake: { stage: string; xp: { total: number; floor: number; next: number | null } } = { stage: 'young', xp: { total: 3100, floor: 1200, next: 5000 } };
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage: fake.stage, name: 'Braise' };
    camp.xp = fake.xp;
    await route.fulfill({ response: res, json: camp });
  });
  await page.goto(`/#/p/${id}/dragon?debug`);
  await expectScene(page, 'nest');
  const sheet = page.getByTestId('nest-growth');
  await expect(sheet).toContainText('Prochaine étape\u202f: Dragon adulte');
  await expect(sheet).toContainText('1\u202f900 sur 3\u202f800 XP');
  // Final review I2: a screen reader hears the count with its unit, not a bare 1900.
  await expect(sheet.locator('[role="progressbar"]')).toHaveAttribute('aria-valuetext', '1\u202f900 sur 3\u202f800 XP');
  fake = { stage: 'ancestral', xp: { total: 41000, floor: 40000, next: null } };
  await page.reload();
  await expectScene(page, 'nest');
  await expect(sheet).toContainText('Il a fini de grandir.');
  await expect(sheet.locator('.growth-count')).toHaveCount(0);
  await expect(sheet.locator('[role="progressbar"]')).toHaveAttribute('data-state', 'ok');
  await expect(sheet.locator('[role="progressbar"]')).toHaveAttribute('aria-valuetext', 'Il a fini de grandir.');
});
