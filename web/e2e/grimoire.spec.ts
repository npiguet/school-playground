import { test, expect } from '@playwright/test';
import { createProfile, createText, stubSpeech, uniqueName } from './helpers';

const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent. Le vent emporte leurs chansons jusqu\'au village. Les enfants sortent de leurs maisons, émerveillés. La musique descend de la forêt et la nuit est douce.';

test('Grimoire corrompu: planted errors, Fil d\'Ariane, results and stats', async ({ page, request }) => {
  await stubSpeech(page);
  await createProfile(page, uniqueName('Grim'), '10H');
  // A unique title: the library is shared by every profile, so a fixed one matches several cards
  // under --repeat-each (strict mode violation).
  const title = uniqueName('Fées grimoire');
  const t = await createText(request, { title, body: BODY, level: '8H', source: 'custom' });
  // createText bypasses the UI (API only): the library's list was already fetched on mount, so
  // it needs a reload to pick up a text added out-of-band this way.
  await page.reload();
  await page.locator('[data-testid="text-card"]', { hasText: title }).click();
  await page.getByTestId('btn-grimoire').click();
  await expect(page.getByRole('heading', { name: 'Grimoire corrompu' })).toBeVisible();
  await page.getByTestId('btn-open-grimoire').click();
  await expect(page.getByRole('heading', { name: 'Grimoire corrompu' })).toBeVisible();
  await expect(page.getByText(/Éris a corrompu ce grimoire/)).toBeVisible();
  // the shown text differs from the original
  const shown = (await page.locator('[data-testid^="tok-"]').allTextContents()).join(' ');
  expect(shown).not.toBe(BODY);
  // Fil d'Ariane on a verb. Éris plants at random (the server seeds its RNG with the clock), and
  // « dansent » / « fées » are themselves plantable (« dense », « danse », « fees »...): the tokens
  // are picked by position, never by wording. A plant swaps one word for one word, so the player's
  // token 1 is always the subject noun and token 2 always the verb of « Les fées dansent ».
  const subject = page.getByTestId('tok-1');
  const verb = page.getByTestId('tok-2');
  await page.getByTestId('btn-fil').click();
  await expect(page.getByTestId('fil-message')).toContainText('Touche un verbe');
  await verb.click();
  await expect(page.getByTestId('fil-message')).toContainText('Maintenant, touche son sujet');
  await subject.click();
  await expect(page.getByTestId('fil-message')).toContainText('Le fil est tendu');
  await page.getByTestId('btn-fil-exit').click();
  // Fix the verb if Éris planted on it, else just finish.
  if ((await verb.textContent()) !== 'dansent') {
    await verb.click();
    await page.getByTestId('word-editor').fill('dansent');
    await page.getByTestId('word-editor').press('Enter');
    await expect(verb).toHaveText('dansent');
  }
  await page.getByTestId('btn-done-proofreading').click();
  // « Valider quand même ? » only shows while passes remain: wait for whichever comes, never
  // sample it once.
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  const results = page.getByTestId('results-catch-rate');
  await expect(confirm.or(results)).toBeVisible();
  if (await confirm.isVisible()) await confirm.click();
  await expect(page.getByTestId('results-catch-rate')).toContainText(/Dés-accords retrouvés : \d+ sur \d+/);
  const m = /sur (\d+)/.exec((await page.getByTestId('results-catch-rate').textContent()) ?? '');
  expect(Number(m?.[1])).toBeGreaterThanOrEqual(3);
  await page.getByTestId('btn-back-camp').click();
  // The hero panel's « Ton journal » medallion points at `dossier` (SP3 decision 14, wired in Task 6);
  // its own "Voir les chiffres bruts" link goes on to the raw stats page.
  await page.getByTestId('hud-hero').click();
  await page.getByTestId('hero-journal').click();
  await expect(page.getByRole('heading', { name: "Le dossier d'Éris" })).toBeVisible();
  await page.getByRole('link', { name: 'Voir les chiffres bruts' }).click();
  await expect(page.getByText('Grimoire').first()).toBeVisible();
  expect(t.id).toBeGreaterThan(0);
});
