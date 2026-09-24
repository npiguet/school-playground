import { test, expect, type Page } from '@playwright/test';
import { createProfileApi, createText, expectCamp, makeResult, postSession } from './helpers';

// UI1 (scenes spec §9, §10): the camp as a hub scene, in both WebKit projects (desktop 1280x720
// and iPad landscape 1180x820). Every place is a real button that routes to its (unchanged)
// screen, Back returns to the hub, the hero panel has its own route, portrait shows the rotate
// screen, reduced motion removes parallax, bob and particles.

const PLACES: { id: string; path: RegExp; name: RegExp }[] = [
  { id: 'dragon', path: /\/dragon$/, name: /Le nid du dragon/ },
  { id: 'oracle', path: /\/delphes$/, name: /Le chemin de Delphes/ },
  { id: 'quests', path: /\/quetes$/, name: /Le tableau des quêtes/ },
  { id: 'parchemins', path: /\/parchemins$/, name: /La tente des parchemins/ },
  { id: 'dossier', path: /\/dossier$/, name: /La tente de guerre/ },
  { id: 'bestiary', path: /\/bestiaire$/, name: /Le bestiaire/ },
  { id: 'cabin', path: /\/cabane$/, name: /Ta cabane/ },
];

const heroName = (project: string) => `Hub-${project}-${Date.now() % 1e6}`;

async function openCamp(page: Page, profileId: number) {
  await page.goto(`/#/p/${profileId}/camp`);
  await expectCamp(page);
  await expect(page.getByTestId('hud-xp')).toBeVisible(); // /camp has loaded
}

test('every place routes to its screen and Back returns to the hub', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  for (const place of PLACES) {
    const spot = page.getByTestId(`camp-${place.id}`);
    await expect(spot).toBeVisible();
    await expect(spot).toHaveAccessibleName(place.name);
    await spot.click();
    await expect(page).toHaveURL(place.path);
    await page.goBack();
    await expectCamp(page);
  }
  // No boss quest has been unlocked for this fresh profile (no lieutenant neutralised yet): the
  // boss path stays absent from the hub rather than showing an empty/placeholder hotspot.
  await expect(page.getByTestId('camp-boss')).toHaveCount(0);
});

test('places sit inside the visible safe zone and work from the keyboard', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  // The real art safe zone (mirrors web/src/lib/scene/geometry.ts's SAFE_ZONE x 12.5-87.5% and
  // HUD_BAND y >= 14%), not just "somewhere inside the viewport": the art box is cropped by the
  // viewport on iPad (stageBox() can size it wider/taller than the screen), so a hotspot could
  // pass a viewport-bounds check while still sitting outside the zone the spec actually guarantees
  // is visible.
  const art = await page.getByTestId('scene-camp').locator('.art').boundingBox();
  if (!art) throw new Error('scene-camp .art box has no bounding box: the art box did not render');
  const zone = {
    left: art.x + art.width * 0.125,
    right: art.x + art.width * 0.875,
    top: art.y + art.height * 0.14,
    bottom: art.y + art.height,
  };
  // Sub-pixel rendering slack: `cabin` (camp.shapes.ts) is authored flush against the safe
  // zone's right edge (cx 81.5 + rx 6 = 87.5, exactly SAFE_ZONE's own edge), so its rendered box
  // can legitimately land a fraction of a px past the zone through ordinary browser rounding.
  const EPS = 0.5;
  for (const place of PLACES) {
    const b = await page.getByTestId(`camp-${place.id}`).boundingBox();
    if (!b) throw new Error(`camp-${place.id} has no bounding box: the hotspot did not render`);
    expect(b.x, `${place.id} left edge inside the safe zone`).toBeGreaterThanOrEqual(zone.left - EPS);
    expect(b.x + b.width, `${place.id} right edge inside the safe zone`).toBeLessThanOrEqual(zone.right + EPS);
    expect(b.y, `${place.id} top edge below the HUD band`).toBeGreaterThanOrEqual(zone.top - EPS);
    expect(b.y + b.height, `${place.id} bottom edge inside the art box`).toBeLessThanOrEqual(zone.bottom + EPS);
    expect(Math.min(b.width, b.height), `${place.id} meets the 48px touch target`).toBeGreaterThanOrEqual(48);
  }
  await page.getByTestId('camp-parchemins').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/parchemins$/);
});

test('HUD: laurel, dragon, sound toggle, and the hero panel on its own route', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  await expect(page.getByTestId('hud-xp')).toContainText('Recrue du camp');

  const mute = page.getByTestId('hud-mute');
  const before = await mute.getAttribute('aria-pressed');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', before ?? 'false');

  // Task 10b #11: the dragon's stage line (what it's up to) used to always show on the old camp
  // card; the greeting dialogue now only shows it once, so it's restored as ambient info on the
  // HUD dragon button (a fresh profile's dragon is still an egg).
  await expect(page.getByTestId('hud-dragon')).toHaveAttribute(
    'title',
    "L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.",
  );

  await page.getByTestId('hud-dragon').click();
  await expect(page).toHaveURL(/\/dragon$/);
  await page.goBack();
  await expectCamp(page);

  const panel = page.getByTestId('overlay-heros');
  await page.getByTestId('hud-hero').click();
  await expect(page).toHaveURL(/\/camp\?panel=heros$/);
  await expect(panel).toBeVisible();
  for (const name of ['Réglages', 'Progrès', 'Changer de héros']) {
    await expect(panel.getByRole('link', { name })).toBeVisible();
  }
  await page.goBack();
  await expect(panel).toHaveCount(0);

  await page.getByTestId('hud-hero').click();
  await page.getByTestId('overlay-close').click();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/camp$/);

  await page.goto(`/#/p/${id}/camp?panel=heros`);
  await expect(panel).toBeVisible();
  await panel.getByRole('link', { name: 'Réglages' }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test('the dragon greets once per visit; a tap advances, « Passer » closes', async ({ page, request }, testInfo) => {
  const name = heroName(testInfo.project.name);
  const id = await createProfileApi(request, name);
  await openCamp(page, id);
  const text = page.getByTestId('dialogue-text');
  await expect(text).toHaveText(`Bienvenue au camp, ${name}.`);
  await page.getByTestId('dialogue-advance').click();
  await expect(text).toHaveText("L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.");
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);

  await page.getByTestId('camp-parchemins').click();
  await expect(page).toHaveURL(/\/parchemins$/);
  await page.goBack();
  await expectCamp(page);
  await expect(page.getByTestId('hud-xp')).toBeVisible();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
});

test('portrait shows the rotate screen instead of the scene', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  const landscape = page.viewportSize()!;
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
  await expect(page.getByTestId('rotate-screen')).toContainText('Tourne ton iPad');
  await expect(page.getByTestId('camp-parchemins')).toBeHidden();
  await page.setViewportSize(landscape);
  await expect(page.getByTestId('rotate-screen')).toBeHidden();
  await expect(page.getByTestId('camp-parchemins')).toBeVisible();

  // Task 10b #5: the spec's rule is "portrait AND aspect < 1" - `orientation: portrait` alone
  // also matches an exactly square viewport (aspect ratio 1), which must NOT show the rotate
  // screen (RotateScreen.svelte and SceneStage.svelte both add `max-aspect-ratio: 999/1000`).
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.getByTestId('rotate-screen')).toBeHidden();
  await expect(page.getByTestId('camp-parchemins')).toBeVisible();
  await page.setViewportSize(landscape);
});

test('reduced motion: no parallax, no idle bob, no particles', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCamp(page, id);
  const stage = page.getByTestId('scene-camp');
  const label = page.getByTestId('camp-parchemins').locator('.hotspot-label');
  const dragon = page.getByTestId('camp-dragon-layer');
  await expect(stage).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.getByTestId('fx-canvas')).toHaveCount(0);
  expect(await label.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect(dragon).toBeVisible();
  await page.mouse.move(20, 20);
  await page.mouse.move(60, 40);
  await expect(dragon).toHaveAttribute('data-offset', '0,0');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(stage).toHaveAttribute('data-reduced-motion', 'false');
  await expect(page.getByTestId('fx-canvas')).toHaveCount(1);
  expect(await label.evaluate((el) => getComputedStyle(el).animationName)).not.toBe('none');
  if (testInfo.project.name === 'desktop') {
    // Hover parallax is a pointer-device behaviour; on the iPad it follows a touch drag.
    await page.mouse.move(10, 10);
    await expect(dragon).not.toHaveAttribute('data-offset', '0,0');
  }
});

test('the path to battle appears once Éris can be fought', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, {
    title: `Veillée ${testInfo.project.name} ${Date.now()}`,
    body: 'Les héros reviennent au camp. Ils racontent leurs voyages et les Muses les écoutent.',
    level: '10H',
  });
  // Neutralise two lieutenants over three days (SP3 decision 3) -> boss tier 1 (decision 8).
  for (const day of ['2026-08-03', '2026-08-04', '2026-08-05']) {
    for (const category of ['agreement:verb', 'homophone']) {
      await postSession(request, { profileId: id, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category }) });
    }
  }
  await openCamp(page, id);
  const boss = page.getByTestId('camp-boss');
  await expect(boss).toBeVisible();
  // Controller ruling P8c: assert the actual reward name (tier 1 -> BOSS_REWARDS[1] ==
  // "sandales_hermes" -> "Sandales d'Hermès" per server/app/world/catalog.py), not just the
  // tier number - a caption that only proved "Combat 1" appeared would pass even if the reward
  // lookup were broken or empty.
  await expect(boss).toContainText("Combat 1 : Sandales d'Hermès");
  await expect(page.getByTestId('camp-dragon')).not.toContainText('Un œuf de dragon');
  await boss.click();
  await expect(page).toHaveURL(/\/eris$/);
});

function boxesIntersect(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test('the weekly goal / prophecy column never overlaps a hotspot or its label', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // A prophecy makes .camp-column at its tallest (weekly banner + the prophecy parchment), the
  // worst case for overlapping a hotspot below it.
  await createText(request, {
    title: `Prophétie ${testInfo.project.name} ${Date.now()}`,
    body: 'Les héros reviennent au camp. Ils racontent leurs voyages et les Muses les écoutent.',
    level: '10H',
    due_date: '2099-01-01',
  });
  for (const size of [
    { width: 1180, height: 820 }, // scenes spec §10: the ipad project's default iPad landscape
    { width: 1366, height: 1024 }, // 13" iPad landscape
  ]) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${id}/camp?debug`);
    await expectCamp(page);
    const column = page.getByTestId('camp-column');
    await expect(page.getByTestId('camp-prophecy')).toBeVisible();
    const columnBox = await column.boundingBox();
    if (!columnBox) throw new Error('camp-column has no bounding box: it did not render');
    const hotspots = page.locator('button.hotspot[data-testid^="camp-"]');
    for (let i = 0; i < (await hotspots.count()); i++) {
      const hotspot = hotspots.nth(i);
      const testId = await hotspot.getAttribute('data-testid');
      for (const el of [hotspot, hotspot.locator('.hotspot-label')]) {
        const box = await el.boundingBox();
        if (!box) throw new Error(`${testId} (or its label) has no bounding box: it did not render`);
        expect(boxesIntersect(columnBox, box), `camp-column vs ${testId} at ${size.width}x${size.height}`).toBe(false);
      }
    }
    await page.screenshot({ path: `test-results/scenes-camp-column-${size.width}x${size.height}.png` });
  }
});
