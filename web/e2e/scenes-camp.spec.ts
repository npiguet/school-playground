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

// Round 1 review #2: SceneTransition (kind="zoom") scales the whole art box in from 1.04 to 1
// over 450ms on mount (SceneTransition.svelte) - a `transform`, not layout, so any boundingBox()
// read taken mid-animation reads a box that's still shrinking (up to ~4% oversized). Every test
// below that measures element geometry waits for this first.
async function waitForSceneSettled(page: Page) {
  await expect(page.locator('.scene-transition')).toHaveCSS('transform', 'none');
}

async function openCamp(page: Page, profileId: number) {
  await page.goto(`/#/p/${profileId}/camp`);
  await expectCamp(page);
  await expect(page.getByTestId('hud-xp')).toBeVisible(); // /camp has loaded
  await waitForSceneSettled(page);
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Reads every requested box in one browser round trip (round 1 review #2: separate boundingBox()
// calls are separate CDP round trips, each its own chance to straddle a layout-changing frame -
// batching them removes that source of skew between boxes measured for the same comparison).
async function measureBoxes(page: Page, selectors: Record<string, string>): Promise<Record<string, Rect | null>> {
  return page.evaluate((sel) => {
    const rect = (el: Element): Rect => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const out: Record<string, Rect | null> = {};
    for (const [key, selector] of Object.entries(sel)) {
      const el = document.querySelector(selector);
      out[key] = el ? rect(el) : null;
    }
    return out;
  }, selectors);
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
  const boxes = await measureBoxes(page, {
    art: '[data-testid="scene-camp"] .art',
    ...Object.fromEntries(PLACES.map((p) => [p.id, `[data-testid="camp-${p.id}"]`])),
  });
  const art = boxes.art;
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
    const b = boxes[place.id];
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

  // Round 1 review #3: a `title` tooltip never shows on iPad (the target device has no mouse
  // hover), so the dragon's ambient status (what it's up to, used to always show on the old camp
  // card) is a short, visible addition to the camp-dragon hotspot's caption instead (a fresh
  // profile's dragon is still an egg).
  await expect(page.getByTestId('camp-dragon')).toContainText('Un œuf de dragon · Frémit');

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
    // Hover parallax is a pointer-device behaviour; on the iPad it follows a touch drag.
    await page.mouse.move(10, 10);
    await expect(dragon).not.toHaveAttribute('data-offset', '0,0');
    // Round 1 review #8: data-offset alone only proves the art-% math (parallaxOffset()) ran; it
    // says nothing about the art-% -> px conversion (off.x/100 * runtime.artW) that actually
    // drives the visible transform. A regression that zeroed artW/artH (e.g. SceneStage's `box`
    // never reaching SceneLayer) would still report a nonzero data-offset while the layer visually
    // never moves - checked here directly. SceneLayer always sets an inline `transform:
    // translate()`, even at a zero offset, so the computed value is never literally the string
    // 'none' either way; compare against the identity matrix instead, which is what a zero offset
    // (correctly computed or not) actually renders as. `.scene-layer`'s `transform` eases over
    // 0.35s (item #3), so poll instead of reading it once immediately after the move - a bare read
    // could land at t=0 of that transition, still showing the identity matrix it started from.
    await expect
      .poll(() => dragon.evaluate((el) => getComputedStyle(el).transform))
      .not.toBe('matrix(1, 0, 0, 1, 0, 0)');
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
    await waitForSceneSettled(page);
    await expect(page.getByTestId('camp-prophecy')).toBeVisible();
    // One evaluate() for the column and every hotspot + its label (round 1 review #2): each is a
    // box measured at the exact same instant, rather than several separate CDP round trips that
    // could each land on a different frame.
    const { column, hotspots } = await page.evaluate(() => {
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const columnEl = document.querySelector('[data-testid="camp-column"]');
      const hotspotEls = Array.from(document.querySelectorAll('button.hotspot[data-testid^="camp-"]'));
      return {
        column: columnEl ? rect(columnEl) : null,
        hotspots: hotspotEls.map((el) => {
          const label = el.querySelector('.hotspot-label');
          return { testId: el.getAttribute('data-testid'), box: rect(el), labelBox: label ? rect(label) : null };
        }),
      };
    });
    if (!column) throw new Error('camp-column has no bounding box: it did not render');
    for (const h of hotspots) {
      if (!h.labelBox) throw new Error(`${h.testId}'s label has no bounding box: it did not render`);
      expect(boxesIntersect(column, h.box), `camp-column vs ${h.testId} at ${size.width}x${size.height}`).toBe(false);
      expect(boxesIntersect(column, h.labelBox), `camp-column vs ${h.testId}'s label at ${size.width}x${size.height}`).toBe(
        false,
      );
    }
  }
});

test('a long prophecy title never pushes « Réviser » out of view', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // Exactly the server's own max title length (server/app/schemas.py: max_length=120) - round 1
  // review #1 found an 80-char title already pushed the button 17px below a scrolling fold.
  const longTitle = 'Prophétie ancienne des mers et des montagnes lointaines '.repeat(3).slice(0, 120);
  expect(longTitle).toHaveLength(120);
  await createText(request, {
    title: longTitle,
    body: 'Les héros reviennent au camp. Ils racontent leurs voyages et les Muses les écoutent.',
    level: '10H',
    due_date: '2099-01-01',
  });
  for (const size of [
    { width: 1280, height: 720 }, // the desktop project's own default viewport
    { width: 1180, height: 820 }, // the ipad project's default iPad landscape
  ]) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${id}/camp`);
    await expectCamp(page);
    await waitForSceneSettled(page);
    await expect(page.getByTestId('camp-prophecy')).toBeVisible();
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
