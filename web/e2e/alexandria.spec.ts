import { test, expect } from '@playwright/test';
import { createProfile } from './helpers';

test('Alexandria: refresh from offline fixtures, graceful failure, adopt a scroll', async ({ page }) => {
  await createProfile(page, 'Alex' + Date.now().toString().slice(-6), '9H');
  await page.getByTestId('btn-add-text').click();
  await page.getByTestId('menu-add-alexandria').click();
  await expect(page.getByRole('heading', { name: "Bibliothèque d'Alexandrie" })).toBeVisible();
  expect(await page.getByTestId('work-card').count()).toBeGreaterThanOrEqual(10);
  // a work without fixtures fails gracefully
  await page.locator('[data-testid="work-card"]', { hasText: 'Lettres de mon moulin' }).click();
  await page.getByTestId('btn-refresh-work').click();
  await expect(page.getByTestId('alexandria-error')).toContainText("hors d'atteinte", { timeout: 60_000 });
  await page.goBack();
  // the Verne work has one fixture page
  await page.locator('[data-testid="work-card"]', { hasText: 'Vingt mille lieues' }).click();
  await page.getByTestId('btn-refresh-work').click();
  await expect(page.getByTestId('chunk-card').first()).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('chunk-card').first()).toContainText(/Rouleau \d+/);
  await page.getByTestId('btn-adopt').first().click();
  await expect(page.getByText('Rouleau ajouté aux Parchemins.')).toBeVisible();
  await page.getByTestId('btn-adopt-play').click();
  await expect(page.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  await expect(page.getByText(/Jules Verne/)).toBeVisible();
});
