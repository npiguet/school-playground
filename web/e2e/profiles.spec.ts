import { test, expect } from '@playwright/test';
import { skipOnboarding } from './helpers';

const unique = () => 'Héros' + Date.now().toString().slice(-6);

test('create a profile and reach the library with seed texts', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Nouveau héros/ }).click();
  await page.getByLabel('Ton prénom').fill(unique());
  await page.getByLabel('Ton niveau').selectOption('10H');
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expect(page.getByRole('heading', { name: /Bienvenue au camp/ })).toBeVisible();
  await skipOnboarding(page);
  await page.getByTestId('camp-parchemins').click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: /Bienvenue au camp/ })).toBeVisible();
  await skipOnboarding(page);
  await page.getByRole('link', { name: 'Changer de héros' }).click();
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByLabel(/Code de/).fill('0000');
  await expect(page.getByText("Ce n'est pas le bon code")).toBeVisible();
  await page.getByLabel(/Code de/).fill('1234');
  await expect(page.getByRole('heading', { name: /Bienvenue au camp/ })).toBeVisible();
});
