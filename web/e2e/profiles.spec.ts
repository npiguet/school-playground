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
  const ritual = page.getByTestId('overlay-hero-new');
  await ritual.getByLabel('Ton prénom').fill(name);
  await ritual.getByRole('button', { name: "Protéger ton bouclier d'un sceau" }).click();
  await ritual.getByLabel('Ton sceau à quatre chiffres').fill('1234');
  await ritual.getByRole('button', { name: 'Accrocher mon bouclier' }).click();
  await expectCamp(page);
  await skipOnboarding(page);
  await page.getByTestId('hud-hero').click();
  await page.getByRole('link', { name: 'Changer de héros' }).click();
  await pickHero(page, name);
  await page.getByLabel('Tes quatre chiffres').fill('0000');
  await expect(page.getByText("Ce n'est pas le bon code")).toBeVisible();
  await page.getByLabel('Tes quatre chiffres').fill('1234');
  await expectCamp(page);
});
