import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import {
  createProfileApi,
  createText,
  expectCamp,
  expectInSafeZone,
  expectLineOf,
  nextLine,
  labelOverlaps,
  makeResult,
  measureBoxes,
  postSession,
  redScan,
  tap,
  uniqueName,
  waitForSceneSettled,
  heroNamer,
} from './helpers';

// UI1 (scenes spec §9, §10): the camp as a hub scene, in both WebKit projects (desktop 1280x720
// and iPad landscape 1180x820). Every place is a real button that routes to its place, Back
// returns to the hub, the hero panel has its own route, portrait shows the rotate screen, reduced
// motion removes parallax, bob and particles. UI3 Ruling B3: six places on hub_camp.webp, the path
// to battle always shown and locked until Éris can be fought.

const PLACES: { id: string; path: RegExp; name: RegExp }[] = [
  { id: 'dragon', path: /\/dragon$/, name: /Le nid du dragon/ },
  { id: 'oracle', path: /\/temple$/, name: /Le chemin de Delphes/ },
  { id: 'parchemins', path: /\/tente-parchemins$/, name: /La tente des parchemins/ },
  { id: 'dossier', path: /\/tente-de-guerre$/, name: /La tente de guerre/ },
  { id: 'cabin', path: /\/cabane$/, name: /Ta cabane/ },
];
const ALL = [...PLACES.map((p) => `camp-${p.id}`), 'camp-boss'];

const BODY = 'Les héros reviennent au camp. Ils racontent leurs voyages et les Muses les écoutent.';

// Fix round 1 #6: `Date.now() % 1e6` alone collided across workers under `--repeat-each` (see
// uniqueName's own comment in helpers.ts).
const heroName = heroNamer('Hub');

// Two animation frames in the page: every effect and DOM update queued before now has run.
async function afterTwoFrames(page: Page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function openCamp(page: Page, profileId: number) {
  await page.goto(`/#/p/${profileId}/camp`);
  await expectCamp(page);
  await expect(page.getByTestId('hud-xp')).toBeVisible(); // /camp has loaded
  await waitForSceneSettled(page, 'camp');
}

// Neutralise two lieutenants over three days (SP3 decision 3) -> boss tier 1 (decision 8).
async function readyTheBattle(request: Parameters<typeof createText>[0], profileId: number, project: string) {
  const text = await createText(request, { title: uniqueName(`Veillée ${project}`), body: BODY, level: '10H' });
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
  // UI3 Ruling B3: the path to battle is always there, locked until Éris can be fought. Ruling
  // B-a: it still answers a tap (the dragon explains), so it is not aria-disabled; its lock is
  // painted on the plaque and said in its name.
  const boss = page.getByTestId('camp-boss');
  await expect(boss).toBeVisible();
  await expect(boss).not.toHaveAttribute('aria-disabled', 'true');
  await expect(boss).toHaveAccessibleName(/Le sentier de la bataille.*fermé pour l'instant/);
  await expect(boss.locator('img.hotspot-lock')).toHaveAttribute('src', '/art/icons/lock.webp');
});

test('the locked path to battle: the dragon says how many tricks remain', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
  const boss = page.getByTestId('camp-boss');
  const line = 'Éris se cache encore. Neutralise encore 2 ruses et elle sortira.';
  await tap(boss, testInfo);
  await expect(page).toHaveURL(/\/camp$/);
  await expect(page.getByTestId('dialogue-text')).toHaveText(line);
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
  // Dismissing the line hands focus back to the path, not to <body> (UI3b Task 7 review).
  await expect(boss).toBeFocused();
  // The keyboard reaches the same words: Enter, then Space, on the focused path; « Tout passer »
  // pressed from the keyboard hands focus back each time.
  for (const key of ['Enter', 'Space']) {
    await boss.focus();
    await page.keyboard.press(key);
    await expect(page.getByTestId('dialogue-text'), key).toHaveText(line);
    await expect(page, key).toHaveURL(/\/camp$/);
    await page.getByTestId('dialogue-skip').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('dialogue-box'), key).toHaveCount(0);
    await expect(boss, key).toBeFocused();
  }
  await expect(page).toHaveURL(/\/camp$/);
  await tap(page.getByTestId('camp-parchemins'), testInfo); // the one-tap guard was never taken
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});

// Final review M11: "only one navigation" is proved by counting every hash change from before the
// action until the destination has settled - by then the camp (and any navigation it still had
// pending, whose timer dies with it) is gone - instead of waiting a fixed time for a second one.
async function countHashChanges(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __hashes: string[]; __hashWatch?: () => void };
    if (w.__hashWatch) removeEventListener('hashchange', w.__hashWatch);
    w.__hashes = [];
    w.__hashWatch = () => w.__hashes.push(location.hash);
    addEventListener('hashchange', w.__hashWatch);
  });
}
const hashChanges = (page: Page) => page.evaluate(() => (window as unknown as { __hashes: string[] }).__hashes);

// Runs `act` inside the page once the camp's exit veil has appeared: the fade to night has begun
// and its navigation is still pending (~180 ms away). No timing window: a MutationObserver sees the
// veil inserted, and a zero-delay task queued from there runs after Hotspot's own zero-delay
// release of the one-tap guard (queued earlier, in the task that activated the place) - so a tap
// here meets the fade's own guard (`leaving`), not the flash's.
async function onceTheVeilFalls(page: Page, act: 'tap-oracle' | 'back') {
  await page.evaluate((what) => {
    const obs = new MutationObserver(() => {
      if (!document.querySelector('[data-testid="exit-veil"]')) return;
      obs.disconnect();
      setTimeout(() => {
        if (what === 'back') history.back();
        else (document.querySelector('[data-testid="camp-oracle"]') as HTMLElement | null)?.click();
      }, 0);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }, act);
}

test('two places tapped at once lead to the first one only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  // Final review M3: both taps land inside the first one's 160 ms flash.
  await countHashChanges(page);
  await page.evaluate(() => {
    (document.querySelector('[data-testid="camp-parchemins"]') as HTMLElement).click();
    (document.querySelector('[data-testid="camp-oracle"]') as HTMLElement).click();
  });
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await waitForSceneSettled(page, 'library');
  expect(await hashChanges(page)).toEqual([`#/p/${id}/tente-parchemins`]);

  // Fix wave 2: the guard holds after the flash too, through the fade to night (the navigation
  // itself only happens ~180 ms later) - e.g. a Tab+Enter on another place in that window.
  await openCamp(page, id);
  await countHashChanges(page);
  await onceTheVeilFalls(page, 'tap-oracle');
  await page.getByTestId('camp-parchemins').click();
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await waitForSceneSettled(page, 'library');
  expect(await hashChanges(page)).toEqual([`#/p/${id}/tente-parchemins`]);
});

test('Back during the fade out of the camp is not overridden by the pending navigation', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/parchemins`);
  await expect(page.getByRole('heading', { name: 'Tes parchemins' })).toBeVisible();
  await openCamp(page, id);
  // Tap the war tent, then Back once its fade to night has begun, before it hands over.
  await countHashChanges(page);
  await onceTheVeilFalls(page, 'back');
  await page.getByTestId('camp-dossier').click();
  await expect(page).toHaveURL(/\/parchemins$/);
  await expect(page.getByTestId('overlay-shelves')).toBeVisible();
  await waitForSceneSettled(page, 'library');
  // The Back has the last word: no navigation lands after it (the war tent's pending one died with
  // the camp). Only the last entry is pinned: history.back() is asynchronous, so on a starved host
  // the traversal can take longer than the fade and the war tent's hash may flash first - the player
  // still ends on the shelves, which is what this guards.
  const hashes = await hashChanges(page);
  expect(hashes.at(-1)).toBe(`#/p/${id}/parchemins`);
  expect(hashes.filter((h) => h === `#/p/${id}/parchemins`)).toHaveLength(1);
});

test('places and their labels sit inside the visible safe zone, never overlap, and work from the keyboard', async ({ page, request }, testInfo) => {
  // Two heroes, so every plaque is measured at its widest: a fresh one (the locked path's painted
  // lock; captions on the oracle and the tent) and one who can fight Éris with a board quest up
  // (the battle's reward caption, the oracle's quest badge, the war tent's foiled-tricks badge).
  const fresh = await createProfileApi(request, heroName(testInfo.project.name));
  const ready = await createProfileApi(request, heroName(testInfo.project.name));
  await readyTheBattle(request, ready, testInfo.project.name);
  expect((await request.post(`/api/profiles/${ready}/quests`, { data: { target: 'chimere' } })).ok()).toBeTruthy();
  // The real art safe zone (mirrors web/src/lib/scene/geometry.ts's SAFE_ZONE x 12.5-87.5% and
  // HUD_BAND y >= 14%), not just "somewhere inside the viewport": the art box is cropped by the
  // viewport on iPad (stageBox() can size it wider/taller than the screen), so a hotspot could
  // pass a viewport-bounds check while still sitting outside the zone the spec actually guarantees
  // is visible. `expectInSafeZone` also checks each label vertically: below the HUD band and clear
  // of the dialogue dock. The hub has no exit sign (it is where the others lead).
  // The ledger's ruling and UI3a final review M19: no plaque covers another place or plaque, every
  // pair, at the two project sizes, the smallest iPad landscape and the 13" iPad.
  for (const id of [fresh, ready]) {
    for (const size of [
      { width: 1024, height: 768 },
      { width: 1180, height: 820 },
      { width: 1280, height: 720 },
      { width: 1366, height: 1024 },
    ]) {
      const at = `${id === fresh ? 'fresh' : 'ready'} ${size.width}x${size.height}`;
      await page.setViewportSize(size);
      await openCamp(page, id);
      await expect(page.getByTestId('scene-exit'), at).toHaveCount(0);
      if (id === ready) {
        await expect(page.getByTestId('camp-boss'), at).toContainText("Combat I : Sandales d'Hermès");
        await expect(page.getByTestId('camp-oracle-badge'), at).toBeVisible();
        await expect(page.getByTestId('camp-dossier-seals'), at).toBeVisible();
      } else {
        await expect(page.getByTestId('camp-boss').locator('img.hotspot-lock'), at).toBeVisible();
      }
      await expectInSafeZone(page, 'camp', ALL);
      expect(await labelOverlaps(page, 'camp'), at).toEqual([]);
      // UI3b playability #8, #16: the cabin wears the same dark plaque as the others; gold means
      // « next » only: the glowing plaque alone has the gold-leaf band.
      await expect(page.getByTestId('camp-cabin'), at).toHaveClass(/label-below/);
      const plaques = await page.evaluate(() =>
        [...document.querySelectorAll('[data-testid="scene-camp"] button.hotspot')].map((b) => {
          const l = getComputedStyle(b.querySelector('.hotspot-label')!);
          return { id: b.getAttribute('data-testid'), glow: b.classList.contains('is-new'), band: l.backgroundImage, edge: l.borderTopColor };
        }),
      );
      for (const p of plaques) {
        if (p.glow) expect(p.band, `${at} ${p.id}`).toMatch(/gradient/);
        else expect([p.band, p.edge], `${at} ${p.id}`).toEqual(['none', 'rgba(90, 58, 24, 0.9)']);
      }
    }
  }
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
  await expect(page.getByTestId('hud-xp')).toContainText('Œuf · 0 XP');
  await expect(page.getByTestId('hud-hero').locator('img[src="/art/icons/avatar-chouette.webp"]')).toBeVisible();

  // UI5 Ruling E8: the lyre opens the sound plate; music and effects off strike the lyre through.
  const opener = page.getByTestId('hud-mute');
  await expect(opener.locator('[data-icon="lyre"]')).toBeVisible();
  await opener.click();
  const music = page.getByTestId('hud-sound-music');
  const sfx = page.getByTestId('hud-sound-sfx');
  await music.click();
  await sfx.click();
  await expect(music).toHaveAttribute('aria-pressed', 'false');
  await expect(sfx).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hud-sound')).toHaveCount(0);
  await expect(opener.locator('[data-icon="lyre-muted"]')).toBeVisible();
  // Final review I3: leave the camp and come back - the camp remounts and re-seeds the sound
  // store from the in-session profile, which must know about the toggles.
  await page.getByTestId('camp-parchemins').click();
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await page.goBack();
  await expectCamp(page);
  await expect(page.getByTestId('hud-xp')).toBeVisible();
  await expect(opener.locator('[data-icon="lyre-muted"]')).toBeVisible();
  await opener.click();
  await expect(music).toHaveAttribute('aria-pressed', 'false');
  await expect(sfx).toHaveAttribute('aria-pressed', 'false');
  await music.click();
  await sfx.click();
  await expect(music).toHaveAttribute('aria-pressed', 'true');
  await expect(sfx).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(opener.locator('[data-icon="lyre"]')).toBeVisible();

  // UI3 Ruling B3: what the dragon is up to now lives in the nest; the hub seats its cut-out.
  await expect(page.getByTestId('camp-dragon-layer').locator('img')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');

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
  await (await catalog).finished();
  // Final review I2: the catalog arriving must not re-run the camp's load effect. Svelte applies
  // the catalog and re-runs whatever depends on it in the tasks right after the response body is
  // read; two animation frames later (final review M11: not a fixed sleep) any such re-run has
  // already sent its request.
  await afterTwoFrames(page);
  expect(campCalls).toHaveLength(1);
});

test('the hero chip opens the hero panel in the cabin; closing steps back, a deep link hands over', async ({ page, request }, testInfo) => {
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
  await expect(page.getByRole('heading', { name: 'Tes parchemins' })).toBeVisible();
  await openCamp(page, id);
  // UI3 Ruling B2: the panel lives in the cabin; its seal steps back to the camp it was opened from.
  const stage = page.getByTestId('scene-cabin');
  const camp = page.getByTestId('scene-camp');
  const panel = page.getByTestId('overlay-heros');

  await page.getByTestId('hud-hero').click();
  await expect(page).toHaveURL(/\/cabane\?panel=heros$/);
  await expect(panel).toBeVisible();
  for (const name of ['La lyre', 'Ton journal', 'Changer de héros']) {
    await expect(panel.getByRole('link', { name })).toBeVisible();
  }
  // Final review I5: the scene behind is inert, Tab stays in the panel, particles pause (M4).
  await expect(stage).toHaveAttribute('inert', '');
  await expect(stage.getByTestId('fx-canvas')).toHaveAttribute('data-paused', 'true');
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="overlay-heros"]')), `Tab ${i + 1}`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/camp$/);
  await expect(camp).toBeVisible();
  await expect(camp).not.toHaveAttribute('inert', '');
  await expect(page.getByTestId('hud-hero')).toBeFocused();
  await expect(camp.getByTestId('fx-canvas')).toHaveAttribute('data-paused', 'false');
  // Final review M11: the overlay's outro has ended (the panel is gone, its modal destroyed and
  // focus handed back), so two more frames are enough for a stray second hand-back to show.
  await afterTwoFrames(page);
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

  // The camp's own deep link stays a route and hands over to the cabin's panel; a deep link closes
  // by replacing its own entry: Back never lands on ?panel=heros again.
  // Scoped to the panel (final review M12), like every seal in these specs: an overlay swap can
  // have two seals in the DOM for a moment, whatever the reason.
  await page.goto(`/#/p/${id}/camp?panel=heros`);
  await expect(page).toHaveURL(/\/cabane\?panel=heros$/);
  await expect(panel).toBeVisible();
  await panel.getByTestId('overlay-close').click();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/cabane$/);
  await page.goBack();
  await expect(page).not.toHaveURL(/panel=heros/);

  await page.goto(`/#/p/${id}/camp?panel=heros`);
  await expect(page).toHaveURL(/\/cabane\?panel=heros$/);
  await expect(panel).toBeVisible();
  await panel.getByRole('link', { name: 'La lyre' }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test('the dragon greets once per visit; a tap advances, « Tout passer » closes', async ({ page, request }, testInfo) => {
  const name = heroName(testInfo.project.name);
  const id = await createProfileApi(request, name);
  await openCamp(page, id);
  const box = page.getByTestId('dialogue-box');
  const text = page.getByTestId('dialogue-text');
  // UI5 Ruling E12: one of camp.enter's variants, with her name.
  await expectLineOf(box, 'camp.enter', { hero: name });
  // Final review M6: the live region starts empty and is filled after insertion.
  await expect(page.getByTestId('dialogue-live')).toHaveText((await text.textContent())!);
  await page.getByTestId('dialogue-advance').click();
  await expect(text).toHaveText("Chaque piège d'Éris déjoué me fait frémir dans ma coquille.");
  // Playability #2: the last line points at where the texts are defended.
  await nextLine(page);
  await expectLineOf(box, 'camp.next.first-text');
  await expect(page.getByTestId('camp-parchemins')).toContainText('Choisis un texte à défendre');
  await expect(page.getByTestId('camp-parchemins')).toHaveClass(/is-new/);
  // Ruling B9: one next-step glow on the hub, the same step the greeting names.
  await expect(page.locator('[data-testid="scene-camp"] button.hotspot.is-new')).toHaveCount(1);
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

test('the path to battle opens once Éris can be fought; badges sit on their plaque', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await readyTheBattle(request, id, testInfo.project.name);
  expect((await request.post(`/api/profiles/${id}/quests`, { data: { target: 'chimere' } })).ok()).toBeTruthy();
  await openCamp(page, id);
  const boss = page.getByTestId('camp-boss');
  await expect(boss).toBeVisible();
  await expect(boss).not.toHaveAttribute('aria-disabled', 'true');
  await expect(boss.locator('img.hotspot-lock')).toHaveCount(0);
  // Controller ruling P8c: assert the actual reward name (tier 1 -> BOSS_REWARDS[1] ==
  // "sandales_hermes" -> "Sandales d'Hermès" per server/app/world/catalog.py), not just the
  // tier number.
  await expect(boss).toContainText("Combat I : Sandales d'Hermès");
  await expect(page.getByTestId('camp-dragon-layer').locator('img')).not.toHaveAttribute('src', /dragon_egg/);

  // Playability #5, UI3 Ruling B3: the quest count is pinned to the top-right corner of the Delphi
  // plaque (the chimère board quest). UI3b playability #17: the foiled tricks are two gold seals on
  // the war tent's plaque, never the « something waits » coin.
  await expect(page.getByTestId('camp-oracle-badge')).toHaveText('1');
  await expect(page.getByTestId('camp-dossier-badge')).toHaveCount(0);
  await expect(page.getByTestId('camp-dossier-seals').locator('.hotspot-seal')).toHaveCount(2);
  await expect(page.getByTestId('camp-dossier')).toHaveAccessibleName(/La tente de guerre.*2 ruses neutralisées/);
  for (const place of ['oracle']) {
    const b = await measureBoxes(page, {
      badge: `[data-testid="camp-${place}-badge"]`,
      label: `[data-testid="camp-${place}"] .hotspot-label`,
    });
    if (!b.badge || !b.label) throw new Error(`${place} badge or label did not render`);
    const cx = b.badge.x + b.badge.width / 2;
    const cy = b.badge.y + b.badge.height / 2;
    expect(Math.abs(cx - (b.label.x + b.label.width)), `${place} badge centre on the plaque right edge`).toBeLessThanOrEqual(16);
    expect(Math.abs(cy - b.label.y), `${place} badge centre on the plaque top edge`).toBeLessThanOrEqual(16);
  }

  await boss.click();
  await expect(page).toHaveURL(/\/eris$/);
});

// The clear gap between two boxes, in px: how far apart they are along the axis that separates
// them (negative when they overlap).
function boxGap(a: { x: number; y: number; width: number; height: number }, b: typeof a): number {
  const dx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width));
  const dy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height));
  return Math.max(dx, dy);
}

test('the weekly ribbon hangs in the open sky, at least 4 px clear of every place and plaque', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await readyTheBattle(request, id, testInfo.project.name); // the battle path's caption is the widest plaque near the sky
  // The widest ribbon: five leaves (the lyre's goal goes up to 5).
  expect((await request.patch(`/api/profiles/${id}`, { data: { settings: { weekly_goal: 5 } } })).ok()).toBeTruthy();
  for (const size of [
    { width: 1024, height: 768 },
    { width: 1180, height: 820 },
    { width: 1280, height: 720 },
    { width: 1366, height: 1024 },
  ]) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${id}/camp?debug`);
    await expectCamp(page);
    await waitForSceneSettled(page, 'camp');
    await expect(page.getByTestId('camp-weekly')).toContainText('0 / 5');
    await expect(page.getByTestId('camp-boss')).toContainText("Combat I : Sandales d'Hermès");
    const { art, weekly, hotspots } = await page.evaluate(() => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      return {
        art: rect(document.querySelector('[data-testid="scene-camp"] .art')!),
        weekly: rect(document.querySelector('[data-testid="camp-weekly"]')!),
        hotspots: Array.from(document.querySelectorAll('button.hotspot[data-testid^="camp-"]')).map((el) => ({
          testId: el.getAttribute('data-testid'),
          box: rect(el),
          labelBox: rect(el.querySelector('.hotspot-label')!),
        })),
      };
    });
    const at = `${size.width}x${size.height}`;
    expect(hotspots, `six places at ${at}`).toHaveLength(6);
    expect((weekly.x - art.x) / art.width, `ribbon left at ${at}`).toBeGreaterThanOrEqual(0.3);
    expect((weekly.x + weekly.width - art.x) / art.width, `ribbon right at ${at}`).toBeLessThanOrEqual(0.7);
    expect((weekly.y + weekly.height - art.y) / art.height, `ribbon bottom at ${at}`).toBeLessThanOrEqual(0.22);
    for (const h of hotspots) {
      // Task 7 review: a visible margin, not a 1 px graze.
      expect(boxGap(weekly, h.box), `ribbon gap to ${h.testId} at ${at}`).toBeGreaterThanOrEqual(4);
      expect(boxGap(weekly, h.labelBox), `ribbon gap to ${h.testId}'s label at ${at}`).toBeGreaterThanOrEqual(4);
    }
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

// Spec 2026-09-29 dragon growth §2: one gauge, the dragon's: named by its stage, full at the last one,
// empty for a stage grown before its XP (R3). This hero's /camp answer carries the stage and XP.
test("HUD: the laurel is the dragon's growth, named by its stage, full at the last stage", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let fake: { stage: string; xp: { total: number; floor: number; next: number | null } } = { stage: 'young', xp: { total: 3100, floor: 1200, next: 5000 } };
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage: fake.stage, name: 'Braise' };
    camp.xp = fake.xp;
    await route.fulfill({ response: res, json: camp });
  });
  await openCamp(page, id);
  const laurel = page.getByTestId('hud-xp');
  await expect(laurel).toContainText('Jeune dragon · 3 100 XP');
  await expect(laurel).toHaveAttribute('aria-valuenow', '1900');
  await expect(laurel).toHaveAttribute('aria-valuemax', '3800');
  await expect(laurel.locator('.leaf.lit')).toHaveCount(5);

  fake = { stage: 'ancestral', xp: { total: 41000, floor: 40000, next: null } };
  await page.reload();
  await expectCamp(page);
  await expect(laurel).toContainText('Dragon ancestral · 41 000 XP');
  await expect(laurel.locator('.leaf.lit')).toHaveCount(10);
  await expect(page.getByTestId('hud-dragon').locator('img')).toHaveAttribute('src', '/art/dragon/dragon_ancestral_cut.webp');

  fake = { stage: 'adult', xp: { total: 300, floor: 5000, next: 15000 } };
  await page.reload();
  await expectCamp(page);
  await expect(laurel).toContainText('Dragon adulte · 300 XP');
  await expect(laurel).toHaveAttribute('aria-valuenow', '0');
  await expect(laurel.locator('.leaf.lit')).toHaveCount(0);
});
