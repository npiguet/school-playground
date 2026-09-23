import { test, expect } from '@playwright/test';
test('serves the SPA and the API', async ({ page, request }) => {
  const health = await request.get('/api/health');
  expect(health.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('La Discorde');
});
