import { test, expect } from './crashGuard';
import { closeOverlay, expectCamp, newHero, openShelves, stubSpeech, skipOnboarding, uniqueName } from './helpers';

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
  await page.getByRole('button', { name: "Poser sur l'étagère" }).click();
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
  // A narrow no-break space before « % » (French typography: the sign never wraps alone).
  // toContainText folds every space into ' ', so the character itself is read from the DOM.
  await expect(page.getByTestId('results-catch-rate')).toContainText('50 %');
  expect(await page.getByTestId('results-catch-rate').textContent()).toContain('50 %');
  await expect(page.getByTestId('results-score')).not.toContainText('NaN');
  await expect(page.getByText(/chantent/).first()).toBeVisible();

  // The stats reflect the session (the journal route; the hero panel and the dossier that lead to it
  // are covered by scenes-cabin and scenes-war).
  const profileId = /\/p\/(\d+)\//.exec(page.url())![1];
  await page.getByTestId('btn-back-camp').click();
  await expectCamp(page);
  await page.goto(`/#/p/${profileId}/stats`);
  await expect(page.getByTestId('journal-totals')).toContainText('1 texte défendu');
  await expect(page.getByText("Accord du verbe avec son sujet (L'Hydre)").first()).toBeVisible();
});
