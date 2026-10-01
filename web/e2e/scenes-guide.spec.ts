import { test, expect } from './crashGuard';
import { createProfileApi, heroNamer, tap } from './helpers';

// Spec 2026-09-29 explanations §3, §5 (plan R12).
const heroName = heroNamer('Guide');
const TITLES = ['La gloire et ton dragon', 'Les sceaux', 'Les drachmes', 'Les aides', 'Les combats contre Éris'];

test('the guide opens from the lyre, five sections, and its seal steps back to the lyre', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/settings`);
  const lyre = page.getByTestId('overlay-lyre');
  await expect(lyre).toBeVisible();
  await tap(lyre.getByTestId('lyre-guide'), testInfo);
  await expect(page).toHaveURL(/\/cabane\?panel=guide$/);
  const guide = page.getByTestId('overlay-guide');
  await expect(guide).toBeVisible();
  await expect(guide.locator('h3')).toHaveText(TITLES);
  await expect(guide.getByTestId('guide-aides')).toContainText('20\u202f% de gloire');
  await expect(guide.getByTestId('guide-gloire')).toContainText('Dragonnet\u202f: 100 XP');
  await guide.getByTestId('overlay-close').click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(lyre).toBeVisible();
});

// Review focus 4: the numbers are the server's.
test('the guide reads the rules the server serves', async ({ page, request }, testInfo) => {
  await page.route('**/api/world', async (route) => {
    const world = await (await route.fetch()).json();
    world.rules.aid_bonus = 0.3;
    world.rules.fights[0] = { level: 1, count: 3 };
    await route.fulfill({ json: world });
  });
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?panel=guide`);
  const guide = page.getByTestId('overlay-guide');
  await expect(guide.getByTestId('guide-aides')).toContainText('30\u202f% de gloire');
  await expect(guide.getByTestId('guide-eris')).toContainText('Combat I\u202f: trois lieutenants au sceau de bois');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
