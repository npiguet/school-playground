// The voice walk (Kokoro plan Task 10), run only by tools/tts/voice_walk.sh, against the real voice:
// each pace's first lines, pace 4 on the longest seed text (its first line, under 10 s), and the card
// when the `tts` container is really stopped, then « Réessayer » once it is back. The script stops and
// starts the container when this spec writes a marker file (web/.cache/voice-walk/, outside
// test-results, which Playwright empties at the start of a run).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect } from './crashGuard';
import { createProfileApi, createText, expectBattle, spokenLines, uniqueName } from './helpers';
import { frenchSpacing } from '../src/lib/text/french';

const MARKS = '.cache/voice-walk';
const SHORT = 'Le renard court dans la forêt. Il cherche sa tanière. La nuit tombe sur la colline.';
test.skip(!process.env.VOICE_WALK, 'run by tools/tts/voice_walk.sh');
test.describe.configure({ mode: 'serial' });

async function start(page: Page, request: APIRequestContext, body: string, pace: 1 | 2 | 3 | 4) {
  const id = await createProfileApi(request, uniqueName('Marche'));
  const text = await createText(request, { title: uniqueName('Marche'), body, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await sheet.getByTestId(`pace-option-${pace}`).click();
  await sheet.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expectBattle(page, 'dictation');
  return Date.now();
}
const lines = async (page: Page) => (await spokenLines(page)).length;
/** A figure for the report: an annotation, and a line on stdout (the list reporter prints it). */
function note(testInfo: { annotations: { type: string; description?: string }[] }, type: string, description: string) {
  testInfo.annotations.push({ type, description });
  console.log(`[voice walk] ${type}: ${description}`);
}
const mark = (name: string) => {
  mkdirSync(MARKS, { recursive: true });
  writeFileSync(`${MARKS}/${name}`, '');
};

for (const pace of [1, 2, 3, 4] as const) {
  test(`pace ${pace}: the real voice reads its first lines`, async ({ page, request }, testInfo) => {
    const t0 = await start(page, request, SHORT, pace);
    await expect.poll(() => lines(page), { timeout: 120_000 }).toBeGreaterThan(0);
    note(testInfo, `pace ${pace}, first line`, `${Date.now() - t0} ms`);
    if (pace <= 2) {
      await expect(page.getByTestId('btn-next')).toBeEnabled({ timeout: 60_000 });
      await page.getByTestId('btn-next').click();
    }
    await expect.poll(() => lines(page), { timeout: 120_000 }).toBeGreaterThan(1);
    note(testInfo, `pace ${pace}, lines`, (await spokenLines(page)).map((l) => l.text).join(' / '));
  });
}

// Fix wave A, Ruling R-A1: pace 4 reads its full readings a sentence at a time, so the first line of
// even the longest text comes in about a second (it was the whole text as one line: 23 to 26 s).
test('pace 4 on the longest seed text: its first line, one sentence, comes quickly', async ({ page, request }, testInfo) => {
  const body = (JSON.parse(readFileSync('../content/seed/007-renard-mouches-eau.json', 'utf-8')) as { body: string }).body;
  const t0 = await start(page, request, body, 4);
  await expect.poll(() => lines(page), { timeout: 60_000 }).toBeGreaterThan(0);
  const ms = Date.now() - t0;
  note(testInfo, 'first line (longest text, pace 4)', `${ms} ms`);
  expect(ms).toBeLessThan(10_000);
  await expect.poll(() => lines(page), { timeout: 60_000 }).toBeGreaterThan(1);
  note(testInfo, 'second line (longest text, pace 4)', `${Date.now() - t0} ms`);
});

test("the card when the voice's container stops, and « Réessayer » once it is back", async ({ page, request }) => {
  test.setTimeout(600_000);
  await start(page, request, SHORT, 1);
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.", { timeout: 120_000 });
  mark('stop-tts');
  await expect.poll(async () => (await request.get('/api/tts/health')).status(), { timeout: 180_000 }).toBe(503);
  // The second sentence was fetched ahead while the first played: it plays; the third cannot come.
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('btn-next')).toBeEnabled({ timeout: 120_000 });
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('voice-lost')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('voice-lost-cause')).toHaveText(frenchSpacing('voix : serveur injoignable'));
  mark('start-tts');
  await expect.poll(async () => (await request.get('/api/tts/health')).status(), { timeout: 300_000 }).toBe(200);
  await page.getByTestId('btn-voice-retry').click();
  await expect(page.getByTestId('voice-lost')).toHaveCount(0);
  await expect.poll(() => lines(page), { timeout: 120_000 }).toBe(3);
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.", { timeout: 120_000 });
});
