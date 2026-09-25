import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import {
  chooseLevel,
  createProfileApi,
  enterTitle,
  expectCamp,
  expectInSafeZone,
  expectNoOverlap,
  expectOverlayTapTargets,
  expectScene,
  measureBoxes,
  rectsOverlap,
  redScan,
  uniqueName,
  watchOverlap,
} from './helpers';

// UI3a Task 8 (scenes spec §3 Title, §4 tilt, §10): the camp gates at dusk. « Entrer » unlocks
// audio and tilt and shows the heroes' shields; a new hero is named in an overlay on
// #/profiles/new; a protected hero asks for the code on a sealed parchment. desktop + ipad.

const hero = (project: string) => uniqueName(`Porte-${project}`);

async function stubTilt(page: Page, answer: 'granted' | 'denied') {
  // The iOS permission API, so the test exercises the real request path in WebKit.
  await page.addInitScript((a) => {
    class FakeOrientationEvent extends Event {
      static requestPermission() {
        return Promise.resolve(a);
      }
    }
    (window as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = FakeOrientationEvent;
  }, answer);
}

async function tiltBy(page: Page, beta: number, gamma: number) {
  await page.evaluate(([b, g]) => {
    const e = new Event('deviceorientation');
    Object.defineProperties(e, { beta: { value: b }, gamma: { value: g } });
    window.dispatchEvent(e);
  }, [beta, gamma]);
}

test('« Entrer » opens the gate onto the shields, once per page load', async ({ page, request }, testInfo) => {
  await page.goto('/');
  await expectScene(page, 'title');
  await expect(page.locator('h1')).toContainText('La Discorde');
  const gate = page.getByTestId('title-gate');
  await expect(gate).toHaveAccessibleName(/Entrer/);
  await expectInSafeZone(page, 'title', ['title-gate']);
  // Playability #11: the scene's one next step wears the gold rim and the grand plaque.
  const label = page.getByTestId('title-gate').locator('.hotspot-label');
  await expect(label).toHaveCSS('border-top-color', 'rgb(241, 220, 154)');
  expect(await label.evaluate((e) => parseFloat(getComputedStyle(e.querySelector('.hotspot-name')!).fontSize))).toBe(20);
  await expect(page.getByTestId('title-shields')).toHaveCount(0);
  if (testInfo.project.name === 'ipad') await gate.tap();
  else await gate.click();
  await expect(page.getByTestId('title-shields')).toBeVisible();
  await expect(gate).toHaveCount(0);
  await expect(page.getByTestId('title-new')).toHaveAccessibleName('Nouveau héros');
  // One ribbon line (playability #13), not two.
  const hint = page.getByTestId('title-hint');
  await expect(hint).toHaveCount(1);
  await expect(hint).toHaveText(/Accroche ton bouclier à la porte du camp\.|Choisis ton bouclier/);
  // Same document, same page load: the gate stays open (title never unmounts, only its panel
  // changes here - not yet proof of module-level persistence).
  await page.goto('/#/profiles/new');
  await page.goto('/#/');
  await expect(page.getByTestId('title-shields')).toBeVisible();

  // Fix round 1 #2: a real round trip through a *different* place. `view?.place` flips away from
  // 'title' to 'camp' and back, so Title actually unmounts and remounts - proving `titleGate` is
  // module state (survives the remount), not component state (which would reset to closed).
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await page.goto('/#/');
  await expect(page.getByTestId('title-shields')).toBeVisible();
  await expect(page.getByTestId('title-gate')).toHaveCount(0);
});

test('the naming ritual is an overlay with its own route; Back and the seal close it', async ({ page }, testInfo) => {
  const name = hero(testInfo.project.name);
  await page.goto('/');
  await enterTitle(page);
  await page.getByTestId('title-new').click();
  await expect(page).toHaveURL(/#\/profiles\/new$/);
  const ritual = page.getByTestId('overlay-hero-new');
  await expect(ritual).toBeVisible();
  await expect(page.getByTestId('scene-title')).toHaveAttribute('inert', '');
  await page.goBack();
  await expect(ritual).toHaveCount(0);
  await expect(page.getByTestId('title-shields')).toBeVisible();

  await page.goto('/#/profiles/new');
  await expect(ritual).toBeVisible();
  await ritual.getByTestId('overlay-close').click();
  await expect(ritual).toHaveCount(0);
  await expect(page).toHaveURL(/#\/$/);

  await page.goto('/#/profiles/new');
  await expect(ritual.getByRole('heading', { name: 'Forge ton bouclier' })).toBeVisible();
  await expect(ritual.getByTestId('overlay-voice')).toContainText('bannière');
  await ritual.getByLabel('Ton prénom').fill(name);
  await expect(ritual.getByTestId('forge-banner')).toHaveText(name);
  await ritual.locator('label.avatar-choice', { hasText: 'Trident' }).click();
  await expect(ritual.getByTestId('forge-emblem')).toHaveAttribute('src', '/art/icons/avatar-trident.webp');
  await expect(ritual.getByRole('group', { name: 'Ta classe' })).toBeVisible();
  await chooseLevel(ritual, '9H');
  await expect(ritual.locator('select')).toHaveCount(0);
  await expect(ritual.getByText(/HarmoS|facultatif|profil/)).toHaveCount(0);
  // Playability #3, #4: the seal field is hidden until the toggle is pressed, then visible, and
  // pressing again hides it and clears it.
  await expect(ritual.getByLabel('Ton sceau à quatre chiffres')).toHaveCount(0);
  await ritual.getByRole('button', { name: "Protéger ton bouclier d'un sceau" }).click();
  await expect(ritual.getByLabel('Ton sceau à quatre chiffres')).toBeVisible();
  // B2 fix round 1 #2: with the seal open, the submit stays fully on screen and clear of the
  // scroll's bottom rod (both desktop 1280x720 and ipad 1180x820 run this same test).
  {
    const submitBox = await ritual.getByRole('button', { name: 'Accrocher mon bouclier' }).boundingBox();
    const rodBox = await ritual.locator('.scroll-rod.rod-bottom').boundingBox();
    const vh = page.viewportSize()!.height;
    expect(submitBox, 'submit button rendered').not.toBeNull();
    expect(submitBox!.y, 'submit inside the viewport').toBeGreaterThanOrEqual(0);
    expect(submitBox!.y + submitBox!.height, 'submit inside the viewport').toBeLessThanOrEqual(vh);
    if (rodBox) expect(rectsOverlap(submitBox!, rodBox), 'submit clear of the bottom rod').toBe(false);
  }
  await ritual.getByRole('button', { name: "Protéger ton bouclier d'un sceau" }).click();
  await expect(ritual.getByLabel('Ton sceau à quatre chiffres')).toHaveCount(0);
  await expectOverlayTapTargets(page, 'overlay-hero-new');
  expect(await redScan(page)).toEqual([]);
  // Fix round 1 #1 guard (Task 11 review), tightened in fix round 2 finding 2: proves Overlay's OUT
  // transition is local, not `|global` - handing off from the title to the camp (an ancestor
  // unmount) must drop `scene-title` and its ritual overlay at once rather than lingering for their
  // 160ms fade (which used to leave the next scene `inert` and the ritual's `<svelte:window>`
  // bound, see the Escape test below). `watchOverlap` watches every DOM mutation from before the
  // click, so it catches the coexistence no matter how briefly it lasted or how loaded the machine
  // running the test is - a fixed "count 0 within Nms" window was either too tight (flakes under
  // load) or too loose (hides the regression on a fast one).
  await watchOverlap(page, 'scene-title', 'scene-camp');
  await ritual.getByRole('button', { name: 'Accrocher mon bouclier' }).click();
  await expectCamp(page);
  await expect(page.getByTestId('scene-title')).toHaveCount(0);
  await expect(ritual).toHaveCount(0);
  await expectNoOverlap(page);
  await expect(page.getByTestId('hud-hero').locator('img[src="/art/icons/avatar-trident.webp"]')).toBeVisible();
  // The form replaced its own entry: Back lands on the title, not on an empty ritual (fix round 1
  // #3: prove the actual scene and the overlay's absence, not only the URL).
  await page.goBack();
  await expectScene(page, 'title');
  await expect(page.getByTestId('overlay-hero-new')).toHaveCount(0);
});

test('Escape while the ritual overlay is closing does not undo the hand-off to camp', async ({ page }, testInfo) => {
  // Fix round 1 #1 (original defect, Task 8 review): Overlay.svelte's `out:leave|global` used to
  // keep the ritual (and the title behind it) mounted for its 160ms close animation while the camp
  // had already loaded, its `<svelte:window onkeydown>` staying bound for that whole window - an
  // Escape landing there re-ran `onClose` (`closeToTitle`), replacing the just-loaded camp with the
  // title. Task 11 review, fix round 1: the OUT transition is now local, so handing off to the camp
  // (an ancestor unmount, not the ritual's own toggle) drops the ritual at once instead - there is
  // no longer a stale listener for Escape to hit here. Kept as a regression guard.
  const name = hero(testInfo.project.name);
  await page.goto('/');
  await enterTitle(page);
  await page.getByTestId('title-new').click();
  const ritual = page.getByTestId('overlay-hero-new');
  await ritual.getByLabel('Ton prénom').fill(name);
  await chooseLevel(ritual, '10H');
  await ritual.getByRole('button', { name: 'Accrocher mon bouclier' }).click();
  await page.waitForURL(/\/camp$/);
  await page.keyboard.press('Escape');
  await expectCamp(page);
  await expect(page).toHaveURL(/\/camp$/);
});

// Fix wave A (seen once in a full run, then made deterministic here): between HeroForm replacing the
// route with the camp and the app handling that hashchange, the ritual overlay is still on screen,
// and an Escape there used to close it - stepping back from the camp to the title. An init script
// lets the test queue the app's hashchange handling (`__holdHash()`, before the hand-off) until it
// releases it (`__releaseHash()`, after the Escape), so the Escape always lands inside that window,
// however slow the host;
// closePanel now drops a close while a navigation is pending.
test('an Escape before the hand-off to camp has been handled does not undo it', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const add = window.addEventListener.bind(window);
    const held: (() => void)[] = [];
    let holding = false;
    const w = window as unknown as { __holdHash: () => void; __releaseHash: () => void };
    w.__holdHash = () => (holding = true);
    w.__releaseHash = () => {
      holding = false;
      for (const run of held.splice(0)) run();
    };
    window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
      if (type !== 'hashchange') return add(type, listener, options);
      const deliver = (e: Event) => (typeof listener === 'function' ? listener(e) : listener.handleEvent(e));
      const queued = (e: Event) => (holding ? held.push(() => deliver(e)) : deliver(e));
      return add(type, queued, options);
    }) as typeof window.addEventListener;
  });
  const name = hero(testInfo.project.name);
  await page.goto('/');
  await enterTitle(page);
  await page.getByTestId('title-new').click();
  const ritual = page.getByTestId('overlay-hero-new');
  await expect(ritual).toBeVisible();
  await ritual.getByLabel('Ton prénom').fill(name);
  await chooseLevel(ritual, '10H');
  await page.evaluate(() => (window as unknown as { __holdHash: () => void }).__holdHash());
  await ritual.getByRole('button', { name: 'Accrocher mon bouclier' }).click();
  await page.waitForURL(/\/camp$/);
  await expect(ritual).toBeVisible(); // the hashchange is still held back: the ritual is on screen
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as unknown as { __releaseHash: () => void }).__releaseHash());
  await expectCamp(page);
  await expect(page).toHaveURL(/\/camp$/);
});

// Task S: the camp replaces the ritual's tagged entry. WebKit keeps `history.state` across that
// fragment `location.replace()`, so the camp's own entry used to keep the overlay's panel tag (a
// close there would then step back instead of staying). It is untagged on every engine.
test('the camp a new hero lands on is a screen of its own, not a tagged overlay entry', async ({ page }, testInfo) => {
  await page.goto('/');
  await enterTitle(page);
  await page.getByTestId('title-new').click();
  const ritual = page.getByTestId('overlay-hero-new');
  expect(await page.evaluate(() => (history.state as Record<string, unknown> | null)?.discordePanel)).toBe(true);
  await ritual.getByLabel('Ton prénom').fill(hero(testInfo.project.name));
  await chooseLevel(ritual, '10H');
  await ritual.getByRole('button', { name: 'Accrocher mon bouclier' }).click();
  await expectCamp(page);
  expect(await page.evaluate(() => (history.state as Record<string, unknown> | null)?.discordePanel)).toBeUndefined();
});

test('six slots: newest heroes, « Tous les héros » when there are more, « Nouveau héros » last', async ({ page, request }, testInfo) => {
  // A realistic 14-character hyphenated name (created last, so it is always among the newest and
  // shown on its own shield, never swallowed into « Tous les héros »).
  const longName = `Anne-Charlotte-${testInfo.project.name.slice(0, 1)}${uniqueName('').slice(-4)}`;
  const names: string[] = [];
  for (let i = 0; i < 6; i++) {
    const n = i === 5 ? longName : `${hero(testInfo.project.name)}-${i}`;
    names.push(n);
    await createProfileApi(request, n);
  }
  // The shields show the newest heroes of the whole database, and the other workers create heroes
  // all the time: one created after `longName` pushed it off its shield (Task S, 1 in 170 at
  // --repeat-each=5). The list the title reads is the real one, cut down to this test's heroes.
  await page.route('**/api/profiles', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const all = (await res.json()) as { name: string }[];
    await route.fulfill({ response: res, json: all.filter((p) => names.includes(p.name)) });
  });
  await page.goto('/');
  await enterTitle(page);
  const shields = page.getByTestId('title-shields').locator('button.shield');
  await expect(shields).toHaveCount(6);
  await expect(shields.nth(5)).toHaveAccessibleName('Nouveau héros');
  await expect(page.getByTestId('title-all')).toBeVisible();
  const sel: Record<string, string> = { art: '[data-testid="scene-title"] .art' };
  for (let i = 0; i < 6; i++) sel[`s${i}`] = `[data-testid="title-shields"] button.shield:nth-child(${i + 1})`;
  const b = await measureBoxes(page, sel);
  const art = b.art!;
  for (let i = 0; i < 6; i++) {
    const s = b[`s${i}`]!;
    expect(s.x, `shield ${i} left`).toBeGreaterThanOrEqual(art.x + art.width * 0.125 - 0.5);
    expect(s.x + s.width, `shield ${i} right`).toBeLessThanOrEqual(art.x + art.width * 0.875 + 0.5);
    expect(Math.min(s.width, s.height), `shield ${i} touch target`).toBeGreaterThanOrEqual(48);
  }
  // Playability #13: every ring sits on its painted hook. Computed from the DOM (not a hand copy of
  // title.ts's SHIELD_SLOTS - the e2e project can't import app modules): every hook tip shares the
  // same y across both rails, and that y falls inside the spec's own safe hook band (53-58 %,
  // title.test.ts).
  const ringSel: Record<string, string> = {};
  for (let i = 0; i < 6; i++) ringSel[`r${i}`] = `[data-testid="title-shields"] button.shield:nth-child(${i + 1}) .shield-ring`;
  const rings = await measureBoxes(page, ringSel);
  const ringYs = Array.from({ length: 6 }, (_, i) => rings[`r${i}`]!.y);
  for (const y of ringYs) {
    expect(y, 'ring inside the hook band (title.test.ts 53-58%)').toBeGreaterThanOrEqual(art.y + art.height * 0.53 - 2);
    expect(y, 'ring inside the hook band (title.test.ts 53-58%)').toBeLessThanOrEqual(art.y + art.height * 0.58 + 2);
    expect(Math.abs(y - ringYs[0]), 'every hook tip at the same y').toBeLessThanOrEqual(2);
  }
  // B2 fix round 1 #1: a realistic long name wraps (2-3 lines, smaller size) rather than being cut
  // to an ellipsis.
  const longShieldName = page.locator(`[data-testid="title-shields"] button[aria-label^="${longName}"] .shield-name`);
  await expect(longShieldName).toHaveText(longName);
  const clipped = await longShieldName.evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(clipped, 'the long name wraps, it is not clipped to an ellipsis').toBeLessThanOrEqual(1);
  await page.getByTestId('title-all').click();
  await expect(page).toHaveURL(/#\/\?panel=tous$/);
  await page.getByTestId('overlay-heroes').getByRole('button', { name: new RegExp(names[0]) }).click();
  await expectCamp(page);
});

test('naming a hero with a name already taken shows the parchment error, not a bounce to camp', async ({ page, request }, testInfo) => {
  const name = hero(testInfo.project.name);
  await createProfileApi(request, name);
  await page.goto('/');
  await enterTitle(page);
  await page.getByTestId('title-new').click();
  const ritual = page.getByTestId('overlay-hero-new');
  await ritual.getByLabel('Ton prénom').fill(name);
  await chooseLevel(ritual, '10H');
  await ritual.getByRole('button', { name: 'Accrocher mon bouclier' }).click();
  await expect(page.getByText('Ce nom est déjà pris.')).toBeVisible();
  await expect(page.getByTestId('overlay-hero-new')).toBeVisible();
  await expect(page).toHaveURL(/#\/profiles\/new$/);
});

test('#/?panel=tous deep-links straight to every hero; the gate stays closed underneath', async ({ page, request }, testInfo) => {
  const name = hero(testInfo.project.name);
  await createProfileApi(request, name);
  await page.goto('/#/?panel=tous');
  await expectScene(page, 'title');
  const heroes = page.getByTestId('overlay-heroes');
  await expect(heroes).toBeVisible();
  await expect(heroes.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByTestId('title-gate')).toHaveCount(1); // « Entrer » was never tapped
  await heroes.getByTestId('overlay-close').click();
  await expect(heroes).toHaveCount(0);
  await expect(page.getByTestId('title-gate')).toBeVisible();
  await expect(page.getByTestId('title-shields')).toHaveCount(0);
});

test('a protected hero asks for the code on a sealed parchment', async ({ page, request }, testInfo) => {
  const res = await request.post('/api/profiles', { data: { name: hero(testInfo.project.name), avatar: 'lyre', level: '10H', pin: '1234' } });
  expect(res.ok()).toBeTruthy();
  const id = (await res.json()).id as number;
  await page.goto(`/#/p/${id}/camp`);
  await expect(page.getByTestId('pin-gate')).toBeVisible();
  await expect(page.locator('.pin-title')).toHaveText(/^Le sceau d(e |')/);
  // B2 fix round 1 #6: the real input masks the PIN like a real code entry.
  await expect(page.locator('.pin-input')).toHaveCSS('-webkit-text-security', 'disc');
  expect(await redScan(page)).toEqual([]);
  await page.getByLabel('Tes quatre chiffres').fill('0000');
  await expect(page.getByText("Ce n'est pas le bon code")).toBeVisible();
  await page.getByLabel('Tes quatre chiffres').fill('12');
  await expect(page.getByTestId('pin-slots').locator('.pin-slot:not(.is-empty)')).toHaveCount(2);
  await page.getByLabel('Tes quatre chiffres').fill('1234');
  await expectCamp(page);
});

// B2 fix round 1 #3 (brief Task 6 Step 5): the « Changer de héros » link keeps its role and name.
test('the pin gate keeps a « Changer de héros » link', async ({ page, request }, testInfo) => {
  const res = await request.post('/api/profiles', { data: { name: hero(testInfo.project.name), avatar: 'lyre', level: '10H', pin: '1234' } });
  expect(res.ok()).toBeTruthy();
  const id = (await res.json()).id as number;
  await page.goto(`/#/p/${id}/camp`);
  await expect(page.getByTestId('pin-gate').getByRole('link', { name: 'Changer de héros' })).toBeVisible();
});

// B2 fix round 1 #6: a network error on verify-pin shows an in-world message, not a bare failure.
test('a network error checking the seal shows an in-world message', async ({ page, request }, testInfo) => {
  const res = await request.post('/api/profiles', { data: { name: hero(testInfo.project.name), avatar: 'lyre', level: '10H', pin: '1234' } });
  expect(res.ok()).toBeTruthy();
  const id = (await res.json()).id as number;
  await page.route('**/api/profiles/*/verify-pin', async (route) => {
    await route.fulfill({ status: 500, json: { detail: 'Les Muses ne répondent plus. Réessaie.' } });
  });
  await page.goto(`/#/p/${id}/camp`);
  await expect(page.getByTestId('pin-gate')).toBeVisible();
  await page.getByLabel('Tes quatre chiffres').fill('1234');
  await expect(page.getByText('Les Muses ne répondent plus. Réessaie.')).toBeVisible();
  await expect(page.getByTestId('pin-gate')).toBeVisible(); // never bounced to the camp
});

// Task 6 (findings #14, #26): the seal's title elides correctly for a real long accented name and
// the wax-parchment title still fits inside the seal.
test("the seal speaks French with a long accented name: « Le sceau d'Élise-M... »", async ({ page, request }, testInfo) => {
  // B2 fix round 1 #7: a shorter fixed prefix, more random entropy in the suffix (8 chars rather
  // than 4), still realistic (starts with a vowel, has an accent and a hyphen), well under the
  // 30-character server limit.
  const name = `Élise-M-${testInfo.project.name.slice(0, 1)}${uniqueName('').slice(-8)}`;
  const res = await request.post('/api/profiles', { data: { name, avatar: 'lyre', level: '10H', pin: '1234' } });
  expect(res.ok(), await res.text()).toBeTruthy();
  await page.goto(`/#/p/${(await res.json()).id}/camp`);
  const title = page.locator('.pin-title');
  await expect(title).toContainText("Le sceau d'Élise-M");
  const [t, seal] = await Promise.all([title.boundingBox(), page.locator('.pin-seal').boundingBox()]);
  expect(t!.x).toBeGreaterThanOrEqual(seal!.x);
  expect(t!.x + t!.width).toBeLessThanOrEqual(seal!.x + seal!.width);
});

test('« Entrer » turns on tilt parallax when the device allows it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, hero(testInfo.project.name));
  await stubTilt(page, 'granted');
  await page.goto('/');
  await enterTitle(page);
  await expect(page.getByTestId('scene-title')).toHaveAttribute('data-tilt', 'on');
  await page.goto(`/#/p/${id}/camp`); // same document: the permission holds for the session
  await expectCamp(page);
  const dragon = page.getByTestId('camp-dragon-layer');
  await expect(dragon).toBeVisible();
  await tiltBy(page, 40, 0); // resting pose
  await tiltBy(page, 50, 10);
  await expect(dragon).not.toHaveAttribute('data-offset', '0,0');
});

test('no tilt when it is refused', async ({ page }) => {
  await stubTilt(page, 'denied');
  await page.goto('/');
  await enterTitle(page);
  await expect(page.getByTestId('scene-title')).toHaveAttribute('data-tilt', 'off');
});

test('no tilt under reduced motion even when granted', async ({ page }) => {
  await stubTilt(page, 'granted');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await enterTitle(page);
  await expect(page.getByTestId('scene-title')).toHaveAttribute('data-tilt', 'off');
});

test('title: no red, rotate screen in portrait, ?debug outlines the gate', async ({ page }) => {
  await page.goto('/?debug#/');
  await expectScene(page, 'title');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(1);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});

// Final review M16: a failed hero list says so inside the art box (a long server message wraps
// rather than running off it) and « Réessayer » fetches the heroes again without a reload.
test('a failed hero list wraps its message inside the art and « Réessayer » loads the heroes', async ({ page, request }, testInfo) => {
  const name = hero(testInfo.project.name);
  await createProfileApi(request, name);
  let fail = true;
  await page.route('**/api/profiles', async (route) => {
    if (fail && route.request().method() === 'GET') {
      await route.fulfill({ status: 503, json: { detail: 'Les Muses sont parties chercher de l’eau à la source Castalie, au pied du Parnasse, et reviennent bientôt.' } });
    } else {
      await route.fallback();
    }
  });
  await page.goto('/');
  await enterTitle(page);
  const note = page.getByTestId('title-error');
  await expect(note).toContainText('Impossible de charger les héros');
  const b = await measureBoxes(page, { art: '[data-testid="scene-title"] .art', note: '[data-testid="title-error"]' });
  const vw = page.viewportSize()!.width;
  expect(b.note!.x, 'the note starts inside the art on screen').toBeGreaterThanOrEqual(Math.max(0, b.art!.x));
  expect(b.note!.x + b.note!.width, 'the note ends inside the art on screen').toBeLessThanOrEqual(Math.min(vw, b.art!.x + b.art!.width));
  expect(b.note!.width, 'at most 70 % of the art').toBeLessThanOrEqual(b.art!.width * 0.7 + 1);
  fail = false;
  await page.getByTestId('title-retry').click();
  await expect(note).toHaveCount(0);
  // The heroes are back: at least this one exists, so a hero shield hangs on the rail.
  await expect(page.locator('[data-testid^="title-hero-"]').first()).toBeVisible();
  expect(await redScan(page)).toEqual([]);
});
