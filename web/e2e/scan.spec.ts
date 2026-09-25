import { test, expect } from '@playwright/test';
import { confirmScanVerified, createProfile, uniqueName } from './helpers';

test('scan a printed handout, verify, save as a prophecy', async ({ page }) => {
  await createProfile(page, uniqueName('Scan'), '9H');
  await page.getByTestId('btn-add-text').click();
  await page.getByTestId('menu-add-scan').click();
  await page.getByTestId('scan-input').first().setInputFiles('/work/server/tests/fixtures/scan/handout.png');
  await page.getByTestId('btn-scan-read').click();
  const ta = page.getByTestId('scan-textarea');
  await expect(ta).toHaveValue(/fées dansent dans la clairière/, { timeout: 60_000 });
  await expect(ta).toHaveValue(/village endormi/);          // hyphenated line end merged
  // the child removes the handout's title line: the saved body is the dictation text only
  const value = await ta.inputValue();
  await ta.fill(value.split('\n\n').filter((p) => !p.startsWith('Dictée')).join('\n\n'));
  // SP2 playability P1-8: the verify step is not a formality — « Le texte est juste » asks for a
  // confirmation, and the details form is not reachable before it.
  await page.getByTestId('btn-scan-verified').click();
  await expect(page.getByTestId('scan-confirm')).toContainText('As-tu comparé chaque ligne avec la feuille ?');
  await page.getByRole('button', { name: 'Pas encore' }).click();
  await expect(page.getByTestId('scan-title')).toHaveCount(0);
  await confirmScanVerified(page);
  await page.getByTestId('scan-title').fill('Feuille des fées');
  await page.getByTestId('scan-due-date').fill('2035-06-30');
  await page.getByTestId('btn-scan-save').click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
  const card = page.locator('[data-testid="text-card"]', { hasText: 'Feuille des fées' });
  await expect(card).toContainText('Scanné');
  await expect(card.getByTestId('chip-prophecy')).toContainText('30.06.2035');
  await expect(page.getByRole('heading', { name: "Prophéties de l'Oracle" })).toBeVisible();
  await card.click();
  await expect(page.getByTestId('play-prophecy')).toContainText('30.06.2035');
  await page.getByRole('button', { name: 'Voir la feuille' }).click();
  await expect(page.locator('img[src*="/api/scan/"]')).toBeVisible();
});

// SP2 playability P1-8: on a phone-like photo the « À vérifier » chips appear, and every one of
// them has to be tapped (each tap selects the word in the textarea) before « Le texte est juste »
// is even enabled.
test('a phone photo shows « À vérifier » chips that must each be looked at', async ({ page }) => {
  await createProfile(page, uniqueName('Chip'), '9H');
  await page.getByTestId('btn-add-text').click();
  await page.getByTestId('menu-add-scan').click();
  await page.getByTestId('scan-input').first().setInputFiles('/work/server/tests/fixtures/scan/handout-phone.jpg');
  await page.getByTestId('btn-scan-read').click();
  const ta = page.getByTestId('scan-textarea');
  await expect(ta).toHaveValue(/fées dansent/, { timeout: 60_000 });
  const chips = page.getByTestId('scan-low-confidence').locator('button');
  expect(await chips.count()).toBeGreaterThan(0);
  await expect(page.getByTestId('scan-verify-hint')).toContainText('Touche chaque mot à vérifier');
  await expect(page.getByTestId('btn-scan-verified')).toBeDisabled();
  const first = (await chips.first().textContent())!.trim();
  await chips.first().click();
  await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');
  const selected = await ta.evaluate((el: HTMLTextAreaElement) => el.value.slice(el.selectionStart, el.selectionEnd));
  expect(selected.toLowerCase()).toBe(first.toLowerCase());
  for (let i = 1; i < (await chips.count()); i++) await chips.nth(i).click();
  await expect(page.getByTestId('scan-verify-hint')).toContainText('Chaque mot à vérifier a été regardé');
  await expect(page.getByTestId('btn-scan-verified')).toBeEnabled();
  await page.getByTestId('btn-scan-verified').click();
  await page.getByTestId('btn-scan-confirm').click();
  await expect(page.getByTestId('scan-title')).toBeVisible();
});
