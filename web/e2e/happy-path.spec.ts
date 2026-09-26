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
  // UI4 playability #11: the heading is the text's title, the phase told in the fiction.
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-phase', 'proofreading');
  await expect(page.getByText("Traque les pièges d'Éris.", { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verbes', exact: true })).toBeVisible();
  const danse = page.locator('[data-testid^="tok-"]', { hasText: /^danse$/ });
  await danse.click();
  await page.getByTestId('word-editor').fill('dansent');
  await page.getByTestId('word-editor').press('Enter');
  await expect(page.locator('[data-testid^="tok-"]', { hasText: /^dansent$/ })).toBeVisible();
  await page.getByTestId('btn-done-proofreading').click();
  // « Valider quand même ? » only shows while passes remain: wait for whichever comes, never sample
  // it once (final review M16, as grimoire.spec.ts does).
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  await expect(confirm.or(page.getByTestId('victory-title'))).toBeVisible();
  if (await confirm.isVisible()) await confirm.click();

  // Results
  await expect(page.getByTestId('victory-title')).toBeVisible();
  // UI4 playability #1: the tally in the game's words - no percentage, no « Score », no « x / y ».
  await expect(page.getByTestId('results-catch-rate')).toHaveText('Pièges déjoués : 1 sur 2');
  await expect(page.getByTestId('victory')).not.toContainText(/Score|%/);
  // Nor the rate as it used to read (with its narrow no-break space): the journal keeps it.
  await expect(page.getByTestId('results-catch-rate')).not.toContainText('50 %');
  expect(await page.getByTestId('results-catch-rate').textContent()).not.toContain('50 %');
  await expect(page.getByTestId('results-score')).toHaveText(/^Gloire gagnée : \d+$/);
  await page.getByTestId('battle-revoir').click();
  await expect(page.getByTestId('overlay-revoir').getByText(/chantent/).first()).toBeVisible();
  await closeOverlay(page);

  // The stats reflect the session (the journal route; the hero panel and the dossier that lead to it
  // are covered by scenes-cabin and scenes-war).
  const profileId = /\/p\/(\d+)\//.exec(page.url())![1];
  await page.getByTestId('btn-back-camp').click();
  await expectCamp(page);
  await page.goto(`/#/p/${profileId}/stats`);
  await expect(page.getByTestId('journal-totals')).toContainText('1 texte défendu');
  // UI3b playability #1: the trick is told by its monster, the grammar as its small print.
  await expect(page.getByTestId('journal-ruse-hydre')).toContainText("L'Hydre — tu as déjoué");
  await expect(page.getByTestId('journal-ruse-hydre')).toContainText("l'accord du verbe avec son sujet");
});
