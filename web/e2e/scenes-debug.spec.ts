import { test, expect } from './crashGuard';
import { createProfileApi, expectCamp, uniqueName, heroNamer } from './helpers';

// Task 9b: the read-only `?debug` hotspot outline overlay (replaces the interactive `?edit`
// editor the user decided against). Runs on both WebKit projects (scenes-*.spec.ts matches the
// `ipad` project too). Hotspots are authored as data and checked visually in screenshots, so this
// spec only proves the overlay's wiring, not the shapes themselves.

// Fix round 1 #6: `Date.now() % 1e6` alone collided across workers under `--repeat-each` (see
// uniqueName's own comment in helpers.ts).
const heroName = heroNamer('Debug');

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
  // UI3 Ruling B3: the six places of hub_camp.webp, the locked path to battle included, and
  // Hermès's stall (spec 2026-09-29 drachmes §2).
  expect(await visibleHotspots.count()).toBe(7);

  // A hotspot is still a real, clickable button through the overlay (pointer-events: none).
  const parchemins = page.getByTestId('camp-parchemins');
  await expect(parchemins).toBeVisible();
  await parchemins.click();
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});

