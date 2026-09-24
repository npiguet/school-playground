import { test, expect } from '@playwright/test';
import { createProfile, createText, stubSpeech } from './helpers';

const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent. Le vent emporte leurs chansons jusqu\'au village. Les enfants sortent de leurs maisons, émerveillés. La musique descend de la forêt et la nuit est douce.';

test('Grimoire corrompu: planted errors, Fil d\'Ariane, results and stats', async ({ page, request }) => {
  await stubSpeech(page);
  await createProfile(page, 'Grim' + Date.now().toString().slice(-6), '10H');
  const t = await createText(request, { title: 'Fées grimoire', body: BODY, level: '8H', source: 'custom' });
  // createText bypasses the UI (API only): the library's list was already fetched on mount, so
  // it needs a reload to pick up a text added out-of-band this way.
  await page.reload();
  await page.locator('[data-testid="text-card"]', { hasText: 'Fées grimoire' }).click();
  await page.getByTestId('btn-grimoire').click();
  await expect(page.getByRole('heading', { name: 'Grimoire corrompu' })).toBeVisible();
  await page.getByTestId('btn-open-grimoire').click();
  await expect(page.getByRole('heading', { name: 'Grimoire corrompu' })).toBeVisible();
  await expect(page.getByText(/Éris a corrompu ce grimoire/)).toBeVisible();
  // the shown text differs from the original
  const shown = (await page.locator('[data-testid^="tok-"]').allTextContents()).join(' ');
  expect(shown).not.toBe(BODY);
  // Fil d'Ariane on a verb
  await page.getByTestId('btn-fil').click();
  await expect(page.getByTestId('fil-message')).toContainText('Touche un verbe');
  const dansent = page.locator('[data-testid^="tok-"]', { hasText: /^danse(nt)?$/ }).first();
  await dansent.click();
  const msg = await page.getByTestId('fil-message').textContent();
  if (/Maintenant, touche son sujet/.test(msg ?? '')) {
    await page.locator('[data-testid^="tok-"]', { hasText: /^fées?$/ }).first().click();
    await expect(page.getByTestId('fil-message')).toContainText('Le fil est tendu');
  }
  await page.getByTestId('btn-fil-exit').click();
  // fix one planted error if "danse" was planted, else just finish
  const danse = page.locator('[data-testid^="tok-"]', { hasText: /^danse$/ });
  if (await danse.count()) {
    await danse.first().click();
    await page.getByTestId('word-editor').fill('dansent');
    await page.getByTestId('word-editor').press('Enter');
  }
  await page.getByTestId('btn-done-proofreading').click();
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  if (await confirm.isVisible()) await confirm.click();
  await expect(page.getByTestId('results-catch-rate')).toContainText(/Dés-accords retrouvés : \d+ sur \d+/);
  const m = /sur (\d+)/.exec((await page.getByTestId('results-catch-rate').textContent()) ?? '');
  expect(Number(m?.[1])).toBeGreaterThanOrEqual(3);
  await page.getByTestId('btn-back-camp').click();
  // The hero panel's "Progrès" link now points at `dossier` (SP3 decision 14, wired in Task 6);
  // its own "Voir les chiffres bruts" link goes on to the raw stats page.
  await page.getByTestId('hud-hero').click();
  await page.getByRole('link', { name: 'Progrès' }).click();
  await expect(page.getByRole('heading', { name: "Le dossier d'Éris" })).toBeVisible();
  await page.getByRole('link', { name: 'Voir les chiffres bruts' }).click();
  await expect(page.getByText('Grimoire').first()).toBeVisible();
  expect(t.id).toBeGreaterThan(0);
});
