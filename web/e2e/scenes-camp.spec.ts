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
  const vp = page.viewportSize()!;
  for (const place of PLACES) {
    const b = (await page.getByTestId(`camp-${place.id}`).boundingBox())!;
    expect(b.x, place.id).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, place.id).toBeLessThanOrEqual(vp.width);
    expect(b.y, place.id).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height, place.id).toBeLessThanOrEqual(vp.height);
    expect(Math.min(b.width, b.height), place.id).toBeGreaterThanOrEqual(48);
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
