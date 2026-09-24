import { test, expect } from '@playwright/test';
import { createProfileApi, expectCamp } from './helpers';

// Task 9b: the read-only `?debug` hotspot outline overlay (replaces the interactive `?edit`
// editor the user decided against). Runs on both WebKit projects (scenes-*.spec.ts matches the
// `ipad` project too). Hotspots are authored as data and checked visually in screenshots, so this
// spec only proves the overlay's wiring, not the shapes themselves.

const heroName = (project: string) => `Debug-${project}-${Date.now() % 1e6}`;

test('?debug shows one outline per visible camp hotspot and hotspots stay clickable', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));

  // Baseline: no overlay at all outside debug mode.
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect(page.getByTestId('hotspot-debug')).toHaveCount(0);

  await page.goto(`/#/p/${id}/camp?debug`);
  await expectCamp(page);
  const overlay = page.getByTestId('hotspot-debug');
  await expect(overlay).toBeVisible();

  const visibleHotspots = page.locator('button.hotspot');
  const outlines = overlay.locator('svg.outline');
  await expect(outlines).toHaveCount(await visibleHotspots.count());
  expect(await visibleHotspots.count()).toBeGreaterThan(0);

  // A hotspot is still a real, clickable button through the overlay (pointer-events: none).
  const parchemins = page.getByTestId('camp-parchemins');
  await expect(parchemins).toBeVisible();
  await parchemins.click();
  await expect(page).toHaveURL(/\/parchemins$/);
});

test('screenshot hook: captures the camp with ?debug at iPad size', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto(`/#/p/${id}/camp?debug`);
  await expectCamp(page);
  await expect(page.getByTestId('hotspot-debug')).toBeVisible();
  await page.screenshot({ path: 'test-results/scenes-debug-camp.png' });
});
