import { test, expect, type Page } from '@playwright/test';
import {
  createProfileApi,
  createText,
  expectCamp,
  expectInSafeZone,
  makeResult,
  measureBoxes,
  onlyOwnProphecy,
  postSession,
  redScan,
  tap,
  uniqueName,
  waitForSceneSettled,
} from './helpers';

// UI1 (scenes spec §9, §10): the camp as a hub scene, in both WebKit projects (desktop 1280x720
// and iPad landscape 1180x820). Every place is a real button that routes to its (unchanged)
// screen, Back returns to the hub, the hero panel has its own route, portrait shows the rotate
// screen, reduced motion removes parallax, bob and particles.

const PLACES: { id: string; path: RegExp; name: RegExp }[] = [
  { id: 'dragon', path: /\/dragon$/, name: /Le nid du dragon/ },
  { id: 'oracle', path: /\/temple$/, name: /Le chemin de Delphes/ },
  { id: 'quests', path: /\/quetes$/, name: /Le tableau des quêtes/ },
  { id: 'parchemins', path: /\/tente-parchemins$/, name: /La tente des parchemins/ },
  { id: 'dossier', path: /\/dossier$/, name: /La tente de guerre/ },
  { id: 'bestiary', path: /\/bestiaire$/, name: /Le bestiaire/ },
  { id: 'cabin', path: /\/cabane$/, name: /Ta cabane/ },
];

const BODY = 'Les héros reviennent au camp. Ils racontent leurs voyages et les Muses les écoutent.';

// Fix round 1 #6: `Date.now() % 1e6` alone collided across workers under `--repeat-each` (see
// uniqueName's own comment in helpers.ts).
const heroName = (project: string) => uniqueName(`Hub-${project}`);

async function openCamp(page: Page, profileId: number) {
  await page.goto(`/#/p/${profileId}/camp`);
  await expectCamp(page);
  await expect(page.getByTestId('hud-xp')).toBeVisible(); // /camp has loaded
  await waitForSceneSettled(page, 'camp');
}

// Neutralise two lieutenants over three days (SP3 decision 3) -> boss tier 1 (decision 8).
async function readyTheBattle(request: Parameters<typeof createText>[0], profileId: number, project: string) {
  const text = await createText(request, { title: `Veillée ${project} ${Date.now()}`, body: BODY, level: '10H' });
  for (const day of ['2026-08-03', '2026-08-04', '2026-08-05']) {
    for (const category of ['agreement:verb', 'homophone']) {
      await postSession(request, { profileId, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category }) });
    }
  }
}

test('every place routes to its screen and Back returns to the hub', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  for (const place of PLACES) {
    const spot = page.getByTestId(`camp-${place.id}`);
    await expect(spot).toBeVisible();
    await expect(spot).toHaveAccessibleName(place.name);
    // Final review M9: a finger on the iPad, a mouse on the desktop.
    await tap(spot, testInfo);
    await expect(page).toHaveURL(place.path);
    await page.goBack();
    await expectCamp(page);
    await waitForSceneSettled(page, 'camp');
  }
  // No boss quest has been unlocked for this fresh profile (no lieutenant neutralised yet): the
  // boss path stays absent from the hub rather than showing an empty/placeholder hotspot.
  await expect(page.getByTestId('camp-boss')).toHaveCount(0);
});

test('two places tapped at once lead to the first one only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  // Final review M3: both taps land inside the first one's 160 ms flash.
  await page.evaluate(() => {
    (document.querySelector('[data-testid="camp-parchemins"]') as HTMLElement).click();
    (document.querySelector('[data-testid="camp-oracle"]') as HTMLElement).click();
  });
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await page.waitForTimeout(600);
  await expect(page).toHaveURL(/\/tente-parchemins$/);

  // Fix wave 2: the guard holds after the flash too, through the fade to night (the navigation
  // itself only happens ~180 ms later) - e.g. a Tab+Enter on another place in that window.
  await openCamp(page, id);
  await page.evaluate(() => {
    (document.querySelector('[data-testid="camp-parchemins"]') as HTMLElement).click();
    setTimeout(() => (document.querySelector('[data-testid="camp-oracle"]') as HTMLElement | null)?.click(), 250);
  });
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await page.waitForTimeout(600);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});

test('a deep link to the hero panel waits for the onboarding card: one modal at a time', async ({ page, request }, testInfo) => {
  // Fix wave 3: onboarding takes precedence; the panel opens only once the Muses' card has closed,
  // so there is never more than one focus trap.
  const res = await request.post('/api/profiles', { data: { name: heroName(testInfo.project.name), avatar: 'chouette', level: '10H' } });
  expect(res.ok()).toBeTruthy();
  const id = (await res.json()).id as number;
  await page.goto(`/#/p/${id}/camp?panel=heros`);
  await expectCamp(page);
  const card = page.getByTestId('onboarding');
  const panel = page.getByTestId('overlay-heros');
  await expect(card).toBeVisible();
  await expect(panel).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="onboarding"]')), `card Tab ${i + 1}`).toBe(true);
  }
  await page.getByTestId('onboarding-skip').click();
  await expect(card).toHaveCount(0);
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('scene-camp')).toHaveAttribute('inert', '');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="overlay-heros"]')), `panel Tab ${i + 1}`).toBe(true);
  }
  await page.getByTestId('overlay-close').click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId('scene-camp')).not.toHaveAttribute('inert', '');
});

test('Back during the fade out of the camp is not overridden by the pending navigation', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/parchemins`);
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  await openCamp(page, id);
  // Tap the war tent, then Back after its flash (160 ms) but before the fade hands over (~340 ms).
  await page.evaluate(() => {
    (document.querySelector('[data-testid="camp-dossier"]') as HTMLElement).click();
    setTimeout(() => history.back(), 250);
  });
  await expect(page).toHaveURL(/\/parchemins$/);
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(/\/parchemins$/);
});

test('the onboarding card is a real modal: the camp is inert, Tab stays on the card', async ({ page, request }, testInfo) => {
  // Fix wave 2: same `modal` action as the hero panel. A hero straight from the API, not onboarded.
  const res = await request.post('/api/profiles', { data: { name: heroName(testInfo.project.name), avatar: 'chouette', level: '10H' } });
  expect(res.ok()).toBeTruthy();
  const id = (await res.json()).id as number;
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  const card = page.getByTestId('onboarding');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('scene-camp')).toHaveAttribute('inert', '');
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="onboarding"]')), `Tab ${i + 1}`).toBe(true);
  }
  await page.getByTestId('onboarding-skip').click();
  await expect(card).toHaveCount(0);
  await expect(page.getByTestId('scene-camp')).not.toHaveAttribute('inert', '');
});

test('places and their labels sit inside the visible safe zone and work from the keyboard', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  // The real art safe zone (mirrors web/src/lib/scene/geometry.ts's SAFE_ZONE x 12.5-87.5% and
  // HUD_BAND y >= 14%), not just "somewhere inside the viewport": the art box is cropped by the
  // viewport on iPad (stageBox() can size it wider/taller than the screen), so a hotspot could
  // pass a viewport-bounds check while still sitting outside the zone the spec actually guarantees
  // is visible. `expectInSafeZone` also checks each label vertically now (Task 9 review round 1):
  // below the HUD band and clear of the dialogue dock - this fresh hero has captions on (oracle,
  // parchemins), so their taller labels are exercised too. Runs on both projects (1280x720 and
  // 1180x820, the two sizes the review asked for).
  await expectInSafeZone(page, 'camp', PLACES.map((p) => `camp-${p.id}`));
  // The stage and its art box clip rather than scroll: nothing (focus, a click scrolling a target
  // into view, a script) can pan the cropped painting sideways under the HUD.
  const scrolled = await page.evaluate(() =>
    ['.scene-stage', '.scene-stage .art'].map((s) => {
      const el = document.querySelector(s) as HTMLElement;
      el.scrollLeft = 200;
      return el.scrollLeft;
    }),
  );
  expect(scrolled).toEqual([0, 0]);
  await page.getByTestId('camp-parchemins').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});

test('HUD: laurel, dragon, sound toggle that survives leaving the camp', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  await expect(page.getByTestId('hud-xp')).toContainText('Recrue du camp');
  await expect(page.getByTestId('hud-hero').locator('img[src="/art/icons/avatar-chouette.webp"]')).toBeVisible();

  const mute = page.getByTestId('hud-mute');
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  // Final review I3: leave the camp and come back - the camp remounts and re-seeds the sound
  // store from the in-session profile, which must know about the toggle.
  await page.getByTestId('camp-parchemins').click();
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await page.goBack();
  await expectCamp(page);
  await expect(page.getByTestId('hud-xp')).toBeVisible();
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', 'false');

  // Round 1 review #3: a `title` tooltip never shows on iPad (the target device has no mouse
  // hover), so the dragon's ambient status is a short, visible part of the camp-dragon caption.
  await expect(page.getByTestId('camp-dragon')).toContainText('Un œuf de dragon · Frémit');

  await page.getByTestId('hud-dragon').click();
  await expect(page).toHaveURL(/\/dragon$/);
  await page.goBack();
  await expectCamp(page);
});

test('the camp loads its data once per visit', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const campCalls: string[] = [];
  page.on('request', (r) => {
    if (/\/api\/profiles\/\d+\/camp$/.test(r.url())) campCalls.push(r.url());
  });
  const catalog = page.waitForResponse((r) => r.url().endsWith('/api/world'));
  await openCamp(page, id);
  await catalog;
  await page.waitForTimeout(500);
  // Final review I2: the catalog arriving must not re-run the camp's load effect.
  expect(campCalls).toHaveLength(1);
});

test('the hero panel: its own route, medallions, focus kept inside, closing never leaves a Back trap', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // Fix wave 2: opening/closing the panel once re-ran its register effect in a loop (hundreds of
  // focus() calls, Svelte's effect-depth error): no console error or page error allowed.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  let focusCalls = 0;
  await page.exposeFunction('__countFocus', () => {
    focusCalls += 1;
  });
  await page.addInitScript(() => {
    const f = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (o?: FocusOptions) {
      if (this.getAttribute('data-testid') === 'hud-hero') (window as any).__countFocus();
      return f.call(this, o);
    };
  });
  await page.goto(`/#/p/${id}/parchemins`);
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  await openCamp(page, id);
  const stage = page.getByTestId('scene-camp');
  const panel = page.getByTestId('overlay-heros');

  await page.getByTestId('hud-hero').click();
  await expect(page).toHaveURL(/\/camp\?panel=heros$/);
  await expect(panel).toBeVisible();
  for (const name of ['Réglages', 'Ton journal', 'Changer de héros']) {
    await expect(panel.getByRole('link', { name })).toBeVisible();
  }
  // Final review I5: the scene behind is inert, Tab stays in the panel, particles pause (M4).
  await expect(stage).toHaveAttribute('inert', '');
  await expect(page.getByTestId('fx-canvas')).toHaveAttribute('data-paused', 'true');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="overlay-heros"]')), `Tab ${i + 1}`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/camp$/);
  await expect(stage).not.toHaveAttribute('inert', '');
  await expect(page.getByTestId('hud-hero')).toBeFocused();
  await expect(page.getByTestId('fx-canvas')).toHaveAttribute('data-paused', 'false');
  await page.waitForTimeout(300);
  expect(focusCalls, 'focus handed back to the hero chip once').toBe(1);
  expect(errors).toEqual([]);

  // Back from the panel closes it.
  await page.getByTestId('hud-hero').click();
  await expect(panel).toBeVisible();
  await page.goBack();
  await expect(panel).toHaveCount(0);

  // Final review I1: closing steps back instead of pushing, so Back from the camp then leaves the
  // camp (here: to the library we came from) rather than reopening the panel.
  await page.getByTestId('hud-hero').click();
  await expect(panel).toBeVisible();
  // Scoped to `panel`, not a page-wide `overlay-close` (UI3a Task 9): this test opens/closes several
  // overlays in a row, so a bare page-wide selector is ambiguous the moment two of them are ever in
  // the DOM together, whatever the reason.
  await panel.getByTestId('overlay-close').click();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/camp$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/parchemins$/);

  // A deep link closes by replacing its own entry: Back never lands on ?panel=heros again.
  // UI3a Task 9 fix / Task 11 review fix round 1 #1: straight from `/parchemins` (the line above),
  // this hash change to `camp?panel=heros` used to land while the shelves overlay was still mid its
  // 160ms `out:leave|global` (preflight.md D3) - a page-wide `overlay-close` would then match two
  // wax seals, the one still leaving and this panel's own. Overlay's OUT transition is now local:
  // leaving the library place for the camp (an ancestor unmount) drops the shelves overlay at once,
  // so the plain page-wide selector is unambiguous again.
  await page.goto(`/#/p/${id}/camp?panel=heros`);
  await expect(panel).toBeVisible();
  await page.getByTestId('overlay-close').click();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/camp$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/panel=heros/);

  await page.goto(`/#/p/${id}/camp?panel=heros`);
  await expect(panel).toBeVisible();
  await panel.getByRole('link', { name: 'Réglages' }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test('the dragon greets once per visit; a tap advances, « Tout passer » closes', async ({ page, request }, testInfo) => {
  const name = heroName(testInfo.project.name);
  const id = await createProfileApi(request, name);
  await openCamp(page, id);
  const text = page.getByTestId('dialogue-text');
  await expect(text).toHaveText(`Bienvenue au camp, ${name}.`);
  // Final review M6: the live region starts empty and is filled after insertion.
  await expect(page.getByTestId('dialogue-live')).toHaveText(`Bienvenue au camp, ${name}.`);
  await page.getByTestId('dialogue-advance').click();
  await expect(text).toHaveText("L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.");
  // Playability #2: the last line points at where the texts are defended.
  await page.getByTestId('dialogue-advance').click();
  await expect(text).toHaveText("Les parchemins t'attendent, sous la tente.");
  await expect(page.getByTestId('camp-parchemins')).toContainText('Choisis un texte à défendre');
  await expect(page.getByTestId('camp-parchemins')).toHaveClass(/is-new/);
  await expect(page.getByTestId('dialogue-skip')).toHaveText('Tout passer');
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);

  await page.getByTestId('camp-parchemins').click();
  await expect(page).toHaveURL(/\/tente-parchemins$/);
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
  // Final review M4: nobody sees the particles behind the rotate screen - they stop.
  await expect(page.getByTestId('fx-canvas')).toHaveAttribute('data-paused', 'true');
  await page.setViewportSize(landscape);
  await expect(page.getByTestId('rotate-screen')).toBeHidden();
  await expect(page.getByTestId('camp-parchemins')).toBeVisible();
  await expect(page.getByTestId('fx-canvas')).toHaveAttribute('data-paused', 'false');
  // Fix wave 2: the rotation paused and resumed the particle loop; it never rebuilt it.
  await expect(page.getByTestId('fx-canvas')).toHaveAttribute('data-starts', '1');

  // The spec's rule is "portrait AND aspect < 1" - `orientation: portrait` alone also matches an
  // exactly square viewport (aspect ratio 1), which must NOT show the rotate screen
  // (RotateScreen.svelte and SceneStage.svelte both add `(aspect-ratio < 1)`). Probe a couple more
  // sizes around that boundary (round 1 review #6): a 1001-tall square-ish viewport is the
  // narrowest real "portrait" case right next to it, and must still show the rotate screen.
  for (const size of [
    { width: 1180, height: 820, expectRotate: false },
    { width: 1366, height: 1024, expectRotate: false },
    { width: 900, height: 900, expectRotate: false },
    { width: 1000, height: 1001, expectRotate: true },
  ]) {
    await page.setViewportSize(size);
    await expect(page.getByTestId('rotate-screen'), `${size.width}x${size.height}`).toBeVisible({ visible: size.expectRotate });
    await expect(page.getByTestId('camp-parchemins'), `${size.width}x${size.height}`).toBeVisible({
      visible: !size.expectRotate,
    });
  }
  await page.setViewportSize(landscape);
});

test('legacy screens stay usable in portrait', async ({ page, request }, testInfo) => {
  // Final review M12 / plan Ruling 8: only scene screens show the rotate screen in UI1. UI3a
  // Task 9: /parchemins is now the library scene's shelves overlay, so this proves the point on
  // the dossier instead - still a legacy screen in UI3a (UI3b Task 6 turns it into a place).
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`/#/p/${id}/dossier`);
  await expect(page.getByRole('heading', { name: "Le dossier d'Éris" })).toBeVisible();
  await expect(page.getByTestId('rotate-screen')).toHaveCount(0);
  await expect(page.getByTestId('topbar-camp')).toBeVisible();
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
    // Hover parallax is a pointer-device behaviour.
    await page.mouse.move(10, 10);
  } else {
    // Final review M9: on the iPad the parallax follows a touch drag. Playwright's WebKit has no
    // touch-move API (only tap), so the drag is the touch pointer events the stage listens to.
    await stage.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, clientX: 600, clientY: 400, bubbles: true });
    await stage.dispatchEvent('pointermove', { pointerType: 'touch', isPrimary: true, clientX: 60, clientY: 60, bubbles: true });
  }
  await expect(dragon).not.toHaveAttribute('data-offset', '0,0');
  // Round 1 review #8: data-offset alone only proves the art-% math (parallaxOffset()) ran; the
  // visible transform (off.x/100 * runtime.artW) is checked directly. `.scene-layer`'s transform
  // eases over 0.35s, so poll rather than read it once.
  await expect
    .poll(() => dragon.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe('matrix(1, 0, 0, 1, 0, 0)');
  if (testInfo.project.name === 'ipad') {
    // Lifting the finger eases the layers back to rest.
    await stage.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true, clientX: 60, clientY: 60, bubbles: true });
    await expect(dragon).toHaveAttribute('data-offset', '0,0');
  }
});

test('the path to battle appears once Éris can be fought; badges sit on their plaque', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await readyTheBattle(request, id, testInfo.project.name);
  expect((await request.post(`/api/profiles/${id}/quests`, { data: { target: 'chimere' } })).ok()).toBeTruthy();
  await openCamp(page, id);
  const boss = page.getByTestId('camp-boss');
  await expect(boss).toBeVisible();
  // Controller ruling P8c: assert the actual reward name (tier 1 -> BOSS_REWARDS[1] ==
  // "sandales_hermes" -> "Sandales d'Hermès" per server/app/world/catalog.py), not just the
  // tier number.
  await expect(boss).toContainText("Combat 1 : Sandales d'Hermès");
  await expect(page.getByTestId('camp-dragon')).not.toContainText('Un œuf de dragon');

  // Playability #5: the quest count is pinned to the top-right corner of « Le tableau des
  // quêtes », not floating on the colonnade between two places.
  const badge = page.getByTestId('camp-quests-badge');
  await expect(badge).toHaveText('1');
  const b = await measureBoxes(page, {
    badge: '[data-testid="camp-quests-badge"]',
    label: '[data-testid="camp-quests"] .hotspot-label',
  });
  if (!b.badge || !b.label) throw new Error('quests badge or label did not render');
  const cx = b.badge.x + b.badge.width / 2;
  const cy = b.badge.y + b.badge.height / 2;
  expect(Math.abs(cx - (b.label.x + b.label.width)), 'badge centre on the plaque right edge').toBeLessThanOrEqual(16);
  expect(Math.abs(cy - b.label.y), 'badge centre on the plaque top edge').toBeLessThanOrEqual(16);

  await boss.click();
  await expect(page).toHaveURL(/\/eris$/);
});

function boxesIntersect(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test('the weekly ribbon and the prophecy never overlap a hotspot or its label', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // A prophecy makes .camp-column at its tallest, the worst case for overlapping a place below it.
  const title = `Prophétie ${testInfo.project.name} ${Date.now()}`;
  const text = await createText(request, { title, body: BODY, level: '10H', due_date: '2099-01-01' });
  await onlyOwnProphecy(page, text.id);
  for (const size of [
    { width: 1280, height: 720 }, // the desktop project's default viewport
    { width: 1180, height: 820 }, // scenes spec §10: the ipad project's default iPad landscape
    { width: 1366, height: 1024 }, // 13" iPad landscape
  ]) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${id}/camp?debug`);
    await expectCamp(page);
    await waitForSceneSettled(page, 'camp');
    await expect(page.getByTestId('camp-prophecy')).toContainText(title);
    await expect(page.getByTestId('camp-weekly')).toBeVisible();
    // One evaluate() for the column, the ribbon and every hotspot + its label (round 1 review #2).
    const { column, weekly, hotspots } = await page.evaluate(() => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const columnEl = document.querySelector('[data-testid="camp-column"]');
      const weeklyEl = document.querySelector('[data-testid="camp-weekly"]');
      const hotspotEls = Array.from(document.querySelectorAll('button.hotspot[data-testid^="camp-"]'));
      return {
        column: columnEl ? rect(columnEl) : null,
        weekly: weeklyEl ? rect(weeklyEl) : null,
        hotspots: hotspotEls.map((el) => {
          const label = el.querySelector('.hotspot-label');
          return { testId: el.getAttribute('data-testid'), box: rect(el), labelBox: label ? rect(label) : null };
        }),
      };
    });
    if (!column || !weekly) throw new Error('camp-column or camp-weekly did not render');
    const at = `${size.width}x${size.height}`;
    expect(boxesIntersect(column, weekly), `camp-column vs camp-weekly at ${at}`).toBe(false);
    for (const h of hotspots) {
      if (!h.labelBox) throw new Error(`${h.testId}'s label has no bounding box: it did not render`);
      for (const [name, box] of [
        ['camp-column', column],
        ['camp-weekly', weekly],
      ] as const) {
        expect(boxesIntersect(box, h.box), `${name} vs ${h.testId} at ${at}`).toBe(false);
        expect(boxesIntersect(box, h.labelBox), `${name} vs ${h.testId}'s label at ${at}`).toBe(false);
      }
    }
  }
});

test('a long prophecy title never pushes « Réviser » out of view', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // Exactly the server's own max title length (server/app/schemas.py: max_length=120) - round 1
  // review #1 found an 80-char title already pushed the button 17px below a scrolling fold.
  const longTitle = `${testInfo.project.name} ${'Prophétie ancienne des mers et des montagnes lointaines '.repeat(3)}`.slice(0, 120);
  expect(longTitle).toHaveLength(120);
  const text = await createText(request, { title: longTitle, body: BODY, level: '10H', due_date: '2099-01-01' });
  await onlyOwnProphecy(page, text.id);
  for (const size of [
    { width: 1280, height: 720 }, // the desktop project's own default viewport
    { width: 1180, height: 820 }, // the ipad project's default iPad landscape
  ]) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${id}/camp`);
    await expectCamp(page);
    await waitForSceneSettled(page, 'camp');
    // Final review I6: the card shows this test's own 120-character title (clamped visually,
    // complete in the DOM), not another spec's prophecy.
    await expect(page.getByTestId('camp-prophecy')).toContainText(longTitle);
    await expect(page.getByTestId('camp-prophecy').getByRole('button', { name: 'Réviser' })).toBeVisible();
    const { column, button } = await page.evaluate(() => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const columnEl = document.querySelector('[data-testid="camp-column"]');
      const buttonEl = document.querySelector('[data-testid="camp-prophecy"] button');
      return { column: columnEl ? rect(columnEl) : null, button: buttonEl ? rect(buttonEl) : null };
    });
    if (!column) throw new Error('camp-column has no bounding box: it did not render');
    if (!button) throw new Error('the Réviser button has no bounding box: it did not render');
    const label = `${size.width}x${size.height}`;
    expect(button.y, `Réviser top inside camp-column at ${label}`).toBeGreaterThanOrEqual(column.y);
    expect(button.y + button.height, `Réviser bottom inside camp-column at ${label}`).toBeLessThanOrEqual(
      column.y + column.height + 0.5,
    );
    expect(button.y, `Réviser top inside the viewport at ${label}`).toBeGreaterThanOrEqual(0);
    expect(button.y + button.height, `Réviser bottom inside the viewport at ${label}`).toBeLessThanOrEqual(size.height);
  }
});

test('ultra-wide: the HUD stays on the painting, the blurred bands only exist where needed', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.setViewportSize({ width: 1180, height: 820 });
  await openCamp(page, id);
  // Final review M4: the art covers the whole iPad screen - no hidden full-screen blur.
  await expect(page.getByTestId('stage-backdrop')).toHaveCount(0);

  await page.setViewportSize({ width: 2560, height: 1080 });
  await expect(page.getByTestId('stage-backdrop')).toHaveCount(1);
  // Final review M13 / playability #14: the art box is 1920 px wide, centred (x 320-2240); the
  // HUD's hero chip and sound toggle sit inside it, not in the window corners over the bands.
  const b = await measureBoxes(page, {
    art: '[data-testid="scene-camp"] .art',
    hero: '[data-testid="hud-hero"]',
    mute: '[data-testid="hud-mute"]',
  });
  if (!b.art || !b.hero || !b.mute) throw new Error('art box or HUD did not render');
  expect(b.hero.x).toBeGreaterThanOrEqual(b.art.x);
  expect(b.mute.x + b.mute.width).toBeLessThanOrEqual(b.art.x + b.art.width);
});

test('no red on the hub, its greeting or the hero panel', async ({ page, request }, testInfo) => {
  // Final review I8: the ethics scan on both projects, once the hub has really rendered.
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.getByTestId('hud-hero').click();
  await expect(page.getByTestId('overlay-heros')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await expect(page.locator('body')).not.toContainText(/manqué|raté|perdu/i);
});
