import { test, expect, type Page } from '@playwright/test';
import { createProfileApi, enterTitle, expectCamp, expectInSafeZone, expectScene, measureBoxes, redScan, uniqueName } from './helpers';

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

test('« Entrer » opens the gate onto the shields, once per page load', async ({ page }, testInfo) => {
  await page.goto('/');
  await expectScene(page, 'title');
  await expect(page.locator('h1')).toContainText('La Discorde');
  const gate = page.getByTestId('title-gate');
  await expect(gate).toHaveAccessibleName(/Entrer/);
  await expectInSafeZone(page, 'title', ['title-gate']);
  await expect(page.getByTestId('title-shields')).toHaveCount(0);
  if (testInfo.project.name === 'ipad') await gate.tap();
  else await gate.click();
  await expect(page.getByTestId('title-shields')).toBeVisible();
  await expect(gate).toHaveCount(0);
  await expect(page.getByTestId('title-new')).toHaveAccessibleName('Nouveau héros');
  // Same document, same page load: the gate stays open.
  await page.goto('/#/profiles/new');
  await page.goto('/#/');
  await expect(page.getByTestId('title-shields')).toBeVisible();
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
  await page.getByTestId('overlay-close').click();
  await expect(ritual).toHaveCount(0);
  await expect(page).toHaveURL(/#\/$/);

  await page.goto('/#/profiles/new');
  await page.getByLabel('Ton prénom').fill(name);
  await ritual.locator('label.avatar-choice', { hasText: 'Trident' }).click();
  await page.getByLabel('Ton niveau').selectOption('9H');
  await expect(page.getByLabel(/Un code à quatre chiffres/)).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expectCamp(page);
  await expect(page.getByTestId('hud-hero').locator('img[src="/art/icons/avatar-trident.webp"]')).toBeVisible();
  // The form replaced its own entry: Back lands on the title, not on an empty ritual.
  await page.goBack();
  await expect(page).not.toHaveURL(/profiles\/new/);
});

test('six slots: newest heroes, « Tous les héros » when there are more, « Nouveau héros » last', async ({ page, request }, testInfo) => {
  const names: string[] = [];
  for (let i = 0; i < 6; i++) {
    const n = `${hero(testInfo.project.name)}-${i}`;
    names.push(n);
    await createProfileApi(request, n);
  }
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
  await page.getByTestId('title-all').click();
  await expect(page).toHaveURL(/#\/\?panel=tous$/);
  await page.getByTestId('overlay-heroes').getByRole('button', { name: new RegExp(names[0]) }).click();
  await expectCamp(page);
});

test('a protected hero asks for the code on a sealed parchment', async ({ page, request }, testInfo) => {
  const res = await request.post('/api/profiles', { data: { name: hero(testInfo.project.name), avatar: 'lyre', level: '10H', pin: '1234' } });
  expect(res.ok()).toBeTruthy();
  const id = (await res.json()).id as number;
  await page.goto(`/#/p/${id}/camp`);
  await expect(page.getByTestId('pin-gate')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.getByLabel(/Code de/).fill('0000');
  await expect(page.getByText("Ce n'est pas le bon code")).toBeVisible();
  await page.getByLabel(/Code de/).fill('1234');
  await expectCamp(page);
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
