import { test, expect } from '@playwright/test';
import { expectCamp, newHero, openShelves, pickHero, skipOnboarding, uniqueName } from './helpers';

const unique = () => uniqueName('Héros');

test('create a profile and reach the library with seed texts', async ({ page }) => {
  await newHero(page, unique(), '10H');
  await skipOnboarding(page);
  await page.getByTestId('camp-parchemins').click();
  await openShelves(page);
  // The list loads asynchronously (a plain .count() can race the fetch, especially with the
  // extra camp round-trip now in front of it) - wait for at least one card before counting.
  await expect(page.locator('[data-testid="text-card"]').first()).toBeVisible();
  expect(await page.locator('[data-testid="text-card"]').count()).toBeGreaterThanOrEqual(25);
});

test('a profile with a code asks for it', async ({ page }) => {
  const name = unique();
  await page.goto('/#/profiles/new');
  await page.getByLabel('Ton prénom').fill(name);
  await page.getByLabel(/Un code à quatre chiffres/).fill('1234');
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expectCamp(page);
  await skipOnboarding(page);
  await page.getByTestId('hud-hero').click();
  await page.getByRole('link', { name: 'Changer de héros' }).click();
  await pickHero(page, name);
  await page.getByLabel(/Code de/).fill('0000');
  await expect(page.getByText("Ce n'est pas le bon code")).toBeVisible();
  await page.getByLabel(/Code de/).fill('1234');
  await expectCamp(page);
});
