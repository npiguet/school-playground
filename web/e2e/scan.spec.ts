import { test, expect } from '@playwright/test';
import { createProfile } from './helpers';

test('scan a printed handout, verify, save as a prophecy', async ({ page }) => {
  await createProfile(page, 'Scan' + Date.now().toString().slice(-6), '9H');
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
  await page.getByTestId('btn-scan-verified').click();
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
