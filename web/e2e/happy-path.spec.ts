import { test, expect } from '@playwright/test';
import { closeOverlay, newHero, openShelves, stubSpeech, skipOnboarding, uniqueName } from './helpers';

const REF = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const DRAFT = 'Les fées danse dans la clairière. Elles chante et les oiseaux les écoutent.';

test('create profile → add text → dictation → proofreading → results → stats', async ({ page }) => {
  await stubSpeech(page);
  const name = uniqueName('Test');

  // Profile
  await newHero(page, name, '10H');
  await skipOnboarding(page);
  await page.getByTestId('camp-parchemins').click();
  await openShelves(page);

  // Custom text (the tent's scribe desk, UI3a Task 9 - replaces the old add menu)
  await closeOverlay(page);
  await page.getByTestId('library-desk').click();
  await page.getByLabel('Titre').fill('Les fées ' + name);
  await page.getByLabel('Texte').fill(REF);
  await page.getByRole('button', { name: /Sauvegarder/ }).click();
  await expect(page.getByRole('heading', { name: 'Tes parchemins' })).toBeVisible();
  await page.locator('[data-testid="text-card"]', { hasText: 'Les fées ' + name }).click();

  // Dictation, pace 1 (two sentences)
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  const ta = page.getByTestId('dictation-textarea');
  await expect(page.locator('body')).not.toContainText('clairière'); // reference never shown
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await ta.fill('Les fées danse dans la clairière.');
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('btn-finish-writing')).toBeVisible();
  await ta.fill(DRAFT);
  expect(await page.evaluate(() => (window as any).__spoken.length)).toBeGreaterThanOrEqual(2);
  await page.getByTestId('btn-finish-writing').click();

  // Proofreading: stage 1 with Argus passes; fix one of the two errors
  await expect(page.getByRole('heading', { name: 'Relecture', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verbes', exact: true })).toBeVisible();
  const danse = page.locator('[data-testid^="tok-"]', { hasText: /^danse$/ });
  await danse.click();
  await page.getByTestId('word-editor').fill('dansent');
  await page.getByTestId('word-editor').press('Enter');
  await expect(page.locator('[data-testid^="tok-"]', { hasText: /^dansent$/ })).toBeVisible();
  await page.getByTestId('btn-done-proofreading').click();
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  if (await confirm.isVisible()) await confirm.click();

  // Results
  await expect(page.getByRole('heading', { name: 'Relecture terminée' })).toBeVisible();
  await expect(page.getByTestId('results-catch-rate')).toContainText('1 sur 2');
  await expect(page.getByTestId('results-catch-rate')).toContainText('50 %');
  await expect(page.getByTestId('results-score')).not.toContainText('NaN');
  await expect(page.getByText(/chantent/).first()).toBeVisible();

  // Stats reflect the session. The hero panel's « Ton journal » medallion points at `dossier` (SP3 decision
  // 14, wired in Task 6); its own "Voir les chiffres bruts" link goes on to the raw stats page.
  await page.getByTestId('btn-back-camp').click();
  await page.getByTestId('hud-hero').click();
  await page.getByTestId('hero-journal').click();
  await expect(page.getByRole('heading', { name: "Le dossier d'Éris" })).toBeVisible();
  await page.getByRole('link', { name: 'Voir les chiffres bruts' }).click();
  await expect(page.getByText(/1 parties?/).first()).toBeVisible();
  await expect(page.getByText("Accord du verbe avec son sujet (L'Hydre)").first()).toBeVisible();
});
