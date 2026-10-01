import { test, expect } from './crashGuard';
import { frenchSpacing } from '../src/lib/text/french';
import { createFreshHeroApi, createProfileApi, expectCamp, expectLineOf, expectScene, heroNamer, nextLine, tap } from './helpers';

// UI5 (spec §8, Ruling E13): each place's first visit is its tour.
test.use({ tours: true });
const heroName = heroNamer('Visite');

async function walkTour(page: import('@playwright/test').Page): Promise<string[]> {
  const tour = page.getByTestId('tour');
  const targets: string[] = [];
  for (let i = 0; i < 30 && (await tour.count()) > 0; i++) {
    const step = await tour.getAttribute('data-step');
    targets.push((await tour.getAttribute('data-target')) ?? '');
    await nextLine(page);
    await expect.poll(async () => ((await tour.count()) === 0 ? 'gone' : await tour.getAttribute('data-step'))).not.toBe(step);
  }
  return targets;
}

test("a new hero's camp begins with the egg's tour, once (the Muses' cards are gone)", async ({ page, request }, testInfo) => {
  const id = await createFreshHeroApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'camp');
  await expect(page.getByTestId('onboarding')).toHaveCount(0);
  await expect(page.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'dragon');
  await expect(page.getByTestId('dialogue-box')).toContainText("L'œuf");
  // A modal: the camp is inert under it, its labels stay readable.
  await expect(page.getByTestId('scene-camp')).toHaveAttribute('inert', '');
  await expect(page.getByTestId('scene-camp')).not.toHaveClass(/has-overlay/);
  // UI5 playability #7: two lines of lore before the first place lights up.
  expect(await walkTour(page)).toEqual(['', '', '', 'parchemins', 'oracle', 'dossier', 'dragon', 'cabin', 'stall', 'stall', 'boss', '']);
  await expect(tour).toHaveCount(0);
  // The seen flag is saved after the tour closes: poll the server rather than race the PATCH.
  await expect
    .poll(async () => (await (await request.get(`/api/profiles/${id}`)).json()).settings)
    .toMatchObject({ tours: ['camp', 'camp:2'], onboarded: true });
  const hero = await (await request.get(`/api/profiles/${id}`)).json();
  await page.reload();
  await expectCamp(page);
  await expect(tour).toHaveCount(0);
  await expectLineOf(page.getByTestId('dialogue-box'), 'camp.enter', { hero: hero.name });
});

test("the ring circles each step's hotspot; « Passer la visite » ends it and it is seen", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins`);
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'library');
  await expect(tour).toHaveAttribute('data-target', 'shelves');
  // Measured once the stage has zoomed in (the ring, outside the stage, never zooms).
  await expectScene(page, 'library');
  const ring = await page.getByTestId('tour-ring').boundingBox();
  const shelves = await page.getByTestId('library-shelves').boundingBox();
  expect(ring!.x).toBeLessThanOrEqual(shelves!.x + 2);
  expect(ring!.x + ring!.width).toBeGreaterThanOrEqual(shelves!.x + shelves!.width - 2);
  await expect(page.getByTestId('dialogue-skip')).toHaveText('Passer la visite');
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/api/profiles/${id}`));
  await tap(page.getByTestId('dialogue-skip'), testInfo);
  await expect(tour).toHaveCount(0);
  await saved;
  await page.reload();
  await expectScene(page, 'library');
  await expect(tour).toHaveCount(0);
  await expectLineOf(page.getByTestId('dialogue-box'), 'library.enter');
});

test('a tap anywhere on the place moves the tour on: it never walls the place off', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane`);
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'cabin');
  await expect(tour).toHaveAttribute('data-target', 'trophies');
  await expectScene(page, 'cabin');
  // A tap on the ringed shelf: the first tap shows the whole line, the next moves on.
  const shelf = await page.getByTestId('tour-ring').boundingBox();
  const at = { x: shelf!.x + shelf!.width / 2, y: shelf!.y + shelf!.height / 2 };
  const touch = async () => (testInfo.project.name === 'ipad' ? page.touchscreen.tap(at.x, at.y) : page.mouse.click(at.x, at.y));
  await expect.poll(async () => {
    await touch();
    return tour.getAttribute('data-target');
  }).toBe('journal');
  await expect(page).toHaveURL(/\/cabane$/);
});

test('Tab stays in the tour, and focus comes back after it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane`);
  await expect(page.getByTestId('tour')).toHaveAttribute('data-tour', 'cabin');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="tour"]')), `Tab ${i + 1}`).toBe(true);
  }
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('tour')).toHaveCount(0);
  await expect(page.getByTestId('scene-cabin')).not.toHaveAttribute('inert', '');
  // Focus lands on the hotspot the tour last ringed (never <body>).
  await expect(page.getByTestId('cabin-trophies')).toBeFocused();
});

test('Escape skips the tour, and it is seen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/dragon`);
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'nest');
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/api/profiles/${id}`));
  await page.keyboard.press('Escape');
  await expect(tour).toHaveCount(0);
  await expect(page.getByTestId('nest-dragon')).toBeFocused();
  await saved;
  await page.reload();
  await expectScene(page, 'nest');
  await expectLineOf(page.getByTestId('dialogue-box'), 'nest.enter');
  await expect(tour).toHaveCount(0);
});

// UI5 playability #10 and #8: the war tour rings the whole wall of portraits when it names the
// lieutenants, and its last step offers « C'est parti ! », not « Passer la visite ».
test("the war tour rings the portrait wall, and the last step's button starts her off", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-de-guerre`);
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'war');
  await expectScene(page, 'war');
  await expect(tour).toHaveAttribute('data-target', 'dossier');
  await nextLine(page);
  await expect(tour).toHaveAttribute('data-target', 'portraits');
  const ring = (await page.getByTestId('tour-ring').boundingBox())!;
  for (const k of ['hydre', 'echo', 'chimere', 'protee', 'sirenes', 'lethe']) {
    const sheet = (await page.getByTestId(`war-${k}`).boundingBox())!;
    expect(sheet.x, k).toBeGreaterThanOrEqual(ring.x - 2);
    expect(sheet.y, k).toBeGreaterThanOrEqual(ring.y - 2);
    expect(sheet.x + sheet.width, k).toBeLessThanOrEqual(ring.x + ring.width + 2);
    expect(sheet.y + sheet.height, k).toBeLessThanOrEqual(ring.y + ring.height + 2);
  }
  await expect(page.getByTestId('dialogue-skip')).toHaveText('Passer la visite');
  await nextLine(page);
  // Spec 2026-09-29 explanations §2 (R10): the gauges on each sheet, then Éris on her fights.
  await expect(tour).toHaveAttribute('data-target', 'portraits');
  await expect(tour).toHaveAttribute('data-step', '2');
  await nextLine(page);
  await expect(tour).toHaveAttribute('data-target', 'bestiary');
  await nextLine(page);
  await expect(tour).toHaveAttribute('data-step', '4');
  await expect(page.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'eris');
  await nextLine(page);
  await expect(tour).toHaveAttribute('data-step', '5');
  await expect(page.getByTestId('dialogue-skip')).toHaveText("C'est parti\u202f!");
  await tap(page.getByTestId('dialogue-skip'), testInfo);
  await expect(tour).toHaveCount(0);
  // Focus goes back to the last hotspot the tour ringed (the wall is no hotspot).
  await expect(page.getByTestId('war-bestiary')).toBeFocused();
});

test('/camp out of reach: the tour gives up, the place greets, the hero panel link still opens', async ({ page, request }, testInfo) => {
  await page.route('**/api/profiles/*/camp', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Le camp dort' }) }),
  );
  const id = await createFreshHeroApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await expect(page.getByTestId('place-status')).toContainText('Le camp dort');
  // The owl needs no camp data to greet; the tour, which does, has given up.
  await expectLineOf(page.getByTestId('dialogue-box'), 'library.enter');
  await expect(page.getByTestId('tour')).toHaveCount(0);
  await page.goto(`/#/p/${id}/camp?panel=heros`);
  await expect(page).toHaveURL(/\/cabane\?panel=heros$/);
  await expect(page.getByTestId('overlay-heros')).toBeVisible();
  await expect(page.getByTestId('tour')).toHaveCount(0);
  // Given up, not seen: nothing was saved.
  const hero = await (await request.get(`/api/profiles/${id}`)).json();
  expect(hero.settings.tours ?? []).toEqual([]);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('a deep link to the hero panel waits for the camp tour: one modal at a time', async ({ page, request }, testInfo) => {
  // Fix wave 3's rule, kept: the panel opens only once the tour has closed, so there is never more
  // than one focus trap.
  const id = await createFreshHeroApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp?panel=heros`);
  await expect(page.getByTestId('tour')).toBeVisible();
  await expect(page.getByTestId('overlay-heros')).toHaveCount(0);
  await page.getByTestId('dialogue-skip').click();
  // UI3 Ruling B2: once the tour is over, the camp hands the route over to the cabin's panel.
  const panel = page.getByTestId('overlay-heros');
  await expect(page).toHaveURL(/\/cabane\?panel=heros$/);
  await expect(panel).toBeVisible();
  // Still one modal at a time: the cabin's own tour waits for the panel to close.
  await expect(page.getByTestId('scene-cabin')).toHaveAttribute('inert', '');
  await expect(page.getByTestId('tour')).toHaveCount(0);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="overlay-heros"]')), `panel Tab ${i + 1}`).toBe(true);
  }
  await panel.getByTestId('overlay-close').click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('tour')).toHaveAttribute('data-tour', 'cabin');
});

// The HUD's sound plate is a popover, not a modal: a tour that opens while it is open (the camp data
// came late) closes it, so the plate's tap-outside and the tour's tap-anywhere never share a tap.
test('a tour that opens closes the sound plate, and the HUD stays shut under the tour', async ({ page, request }, testInfo) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/profiles/*/camp', async (route) => {
    await held;
    await route.fallback();
  });
  const id = await createFreshHeroApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  const opener = page.getByTestId('hud-mute');
  await tap(opener, testInfo);
  await expect(page.getByTestId('hud-sound')).toBeVisible();
  // iPad Safari never focuses a tapped button: focus is on <body>, so the tour taking focus is no
  // focus-out from the plate (the test browser may have focused the lyre button).
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(page.getByTestId('hud-sound')).toBeVisible();
  release();
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'camp');
  await expect(page.getByTestId('hud-sound')).toHaveCount(0);
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  // A tap where the lyre button shows lands on the tour (the HUD is inert under it): the tour moves
  // on, the plate stays shut.
  const at = (await opener.boundingBox())!;
  const x = at.x + at.width / 2;
  const y = at.y + at.height / 2;
  await expect
    .poll(async () => {
      await (testInfo.project.name === 'ipad' ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
      return tour.getAttribute('data-step');
    })
    .not.toBe('0');
  await expect(page.getByTestId('hud-sound')).toHaveCount(0);
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
});

test('« Refaire les visites du camp » brings every tour back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const every = ['camp', 'camp:2', 'library', 'delphi', 'war', 'war:2', 'nest', 'nest:2', 'cabin', 'cabin:2'];
  await request.patch(`/api/profiles/${id}`, { data: { settings: { tours: every } } });
  await page.goto(`/#/p/${id}/settings`);
  await page.getByTestId('lyre-tours').click();
  await expect(page.getByTestId('overlay-lyre').getByRole('status')).toHaveText('Les visites reprendront à ton prochain passage dans chaque lieu.');
  await page.goto(`/#/p/${id}/temple`);
  await expect(page.getByTestId('tour')).toHaveAttribute('data-tour', 'delphi');
  await expect(page.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'pythia');
});

// Spec 2026-09-29 explanations §2, §5 (R8, R9; review focus 2).
test('a tour seen before its new steps comes back once, with the new steps only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await request.patch(`/api/profiles/${id}`, { data: { settings: { tours: ['camp', 'library', 'delphi', 'war', 'nest', 'cabin'] } } });
  await page.goto(`/#/p/${id}/cabane`);
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'cabin');
  await expectScene(page, 'cabin');
  await expect(page.getByTestId('dialogue-text')).toHaveText(
    frenchSpacing("Chaque sceau que tu gagnes y pose un trophée, du bois à l'orichalque. Un socle vide te dit comment gagner le premier."),
  );
  expect(await walkTour(page)).toEqual(['trophies', 'lyre', '']);
  await expect.poll(async () => (await (await request.get(`/api/profiles/${id}`)).json()).settings.tours).toContain('cabin:2');
  await page.reload();
  await expectScene(page, 'cabin');
  await expect(tour).toHaveCount(0);
  await expectLineOf(page.getByTestId('dialogue-box'), 'cabin.enter');
  // A place without new steps stays quiet.
  await page.goto(`/#/p/${id}/temple`);
  await expectScene(page, 'delphi');
  await expect(tour).toHaveCount(0);
});

test('a hero onboarded before the stall hears Hermès at the camp, then nothing more', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  const tour = page.getByTestId('tour');
  await expect(tour).toHaveAttribute('data-tour', 'camp');
  await expect(tour).toHaveAttribute('data-target', 'stall');
  await expect(page.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'hermes');
  expect(await walkTour(page)).toEqual(['stall', 'stall']);
  await expect.poll(async () => (await (await request.get(`/api/profiles/${id}`)).json()).settings.tours).toContain('camp:2');
  await page.reload();
  await expectCamp(page);
  await expect(tour).toHaveCount(0);
});

test('reduced motion: the ring holds still and every line shows at once', async ({ page, request }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-de-guerre`);
  await expect(page.getByTestId('tour')).toHaveAttribute('data-tour', 'war');
  await expect(page.getByTestId('dialogue-advance')).toHaveAttribute('aria-label', 'Suite');
  expect(await page.getByTestId('tour-ring').evaluate((el) => el.getAnimations().length)).toBe(0);
});
