import { test, expect } from './crashGuard';
import { chooseLevel, createProfile, createText, expectCamp, stubSpeech, uniqueName } from './helpers';

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
  // The text is 8H and the hero 10H: it waits behind « Autres classes » (immersion wave Task 8),
  // so this also covers the toggle.
  const shelves = page.getByTestId('overlay-shelves');
  await shelves.getByRole('button', { name: 'Autres classes' }).click();
  await chooseLevel(shelves.getByTestId('shelf-levels'), 'Tous');
  await shelves.locator('[data-testid="text-card"]', { hasText: title }).click();
  await page.getByTestId('btn-grimoire').click();
  await expect(page.getByRole('heading', { name: 'Grimoire corrompu' })).toBeVisible();
  await page.getByTestId('btn-open-grimoire').click();
  // UI4 playability #11: the proofreading is headed by the text's title; Éris's framing follows.
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
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
  // Éris plants at random: none of hers may be caught, and the tally then says they hid (UI4
  // playability #1: never « 0 sur n »). She planted three at least, as the saved grimoire shows.
  await expect(page.getByTestId('results-catch-rate')).toHaveText(/^(Dés-accords retrouvés\u202f: [1-9]\d* sur \d+|Ses dés-accords se sont bien cachés cette fois)$/);
  const profileId = /\/p\/(\d+)\//.exec(page.url())![1];
  const plants = await page.evaluate(
    ([pid, tid]) => (JSON.parse(localStorage.getItem(`discorde.play.${pid}.${tid}.grimoire`) ?? '{}').plants ?? []).length as number,
    [profileId, t.id] as const,
  );
  expect(plants).toBeGreaterThanOrEqual(3);
  // The stats reflect the session (the journal route; the hero panel and the dossier that lead to it
  // are covered by scenes-cabin and scenes-war).
  await page.getByTestId('btn-back-camp').click();
  await expectCamp(page);
  await page.goto(`/#/p/${profileId}/stats`);
  await expect(page.getByTestId('overlay-journal').getByText('Grimoire').first()).toBeVisible();
  expect(t.id).toBeGreaterThan(0);
});
