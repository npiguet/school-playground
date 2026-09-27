// The voice walk (Kokoro plan Task 10), run only by tools/tts/voice_walk.sh, against the real voice:
// each pace's first lines, pace III on the longest seed text (its first line, under 10 s), and the card
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

async function start(page: Page, request: APIRequestContext, body: string, pace: 1 | 2 | 3) {
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
/** A time to a first line is polled every 100 ms (expect.poll's own back-off, up to 1 s a step, would
 *  round it up to the next second). */
const EVERY_100_MS = [100];
/** A figure for the report: an annotation, and a line on stdout (the list reporter prints it). */
function note(testInfo: { annotations: { type: string; description?: string }[] }, type: string, description: string) {
  testInfo.annotations.push({ type, description });
  console.log(`[voice walk] ${type}: ${description}`);
}
const mark = (name: string) => {
  mkdirSync(MARKS, { recursive: true });
  writeFileSync(`${MARKS}/${name}`, '');
};

// The pace redesign: every pace reads each group twice, a long pause between; pace I then waits for
// « Suivant ». The walk takes the pauses at their real length.
for (const pace of [1, 2, 3] as const) {
  test(`pace ${pace}: the real voice reads its first lines`, async ({ page, request }, testInfo) => {
    const t0 = await start(page, request, SHORT, pace);
    await expect.poll(() => lines(page), { timeout: 120_000, intervals: EVERY_100_MS }).toBeGreaterThan(0);
    note(testInfo, `pace ${pace}, first line`, `${Date.now() - t0} ms`);
    await expect.poll(() => lines(page), { timeout: 120_000 }).toBeGreaterThan(1);
    if (pace === 1) {
      await expect(page.getByTestId('btn-next')).toBeEnabled({ timeout: 60_000 });
      await page.getByTestId('btn-next').click();
    }
    await expect.poll(() => lines(page), { timeout: 120_000 }).toBeGreaterThan(2);
    note(testInfo, `pace ${pace}, lines`, (await spokenLines(page)).map((l) => l.text).join(' / '));
  });
}

// Fix wave A, Ruling R-A1: no line is ever the whole text (the final reading is said a sentence at a
// time), so the first line of even the longest text comes in about a second (the whole text as one
// line took 23 to 26 s). Since the pace redesign that first line is pace III's first group, the
// longest line a dictation opens on. The test then stays until the group's second reading, so the voice
// has made the lines around it (what the walk's memory samples measure). The e2e mixer plays each line
// in 20 ms (recordingBackend.ts), so the time noted is how long the voice took to make them, not to say
// them; tts.log has each line's length and making.
test('pace III on the longest seed text: its first line, one group, comes quickly', async ({ page, request }, testInfo) => {
  test.setTimeout(300_000);
  const body = (JSON.parse(readFileSync('../content/seed/007-renard-mouches-eau.json', 'utf-8')) as { body: string }).body;
  const t0 = await start(page, request, body, 3);
  await expect.poll(() => lines(page), { timeout: 60_000, intervals: EVERY_100_MS }).toBeGreaterThan(0);
  const ms = Date.now() - t0;
  note(testInfo, 'first line (longest text, pace III)', `${ms} ms`);
  expect(ms).toBeLessThan(10_000);
  await expect(page.getByText(/^Groupe 1 sur \d+$/)).toBeVisible();
  await expect.poll(() => lines(page), { timeout: 240_000 }).toBeGreaterThan(1);
  note(testInfo, 'first group read twice (longest text, pace III)', `${Date.now() - t0} ms, ${await lines(page)} lines said`);
});

test("the card when the voice's container stops, and « Réessayer » once it is back", async ({ page, request }) => {
  test.setTimeout(600_000);
  await start(page, request, SHORT, 1);
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.", { timeout: 120_000 });
  mark('stop-tts');
  await expect.poll(async () => (await request.get('/api/tts/health')).status(), { timeout: 180_000 }).toBe(503);
  // The second group was fetched ahead while the first played: it plays, twice (the same clip); the
  // third cannot come.
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('btn-next')).toBeEnabled({ timeout: 120_000 });
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('voice-lost')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('voice-lost-cause')).toHaveText(frenchSpacing('voix : serveur injoignable'));
  mark('start-tts');
  await expect.poll(async () => (await request.get('/api/tts/health')).status(), { timeout: 300_000 }).toBe(200);
  await page.getByTestId('btn-voice-retry').click();
  await expect(page.getByTestId('voice-lost')).toHaveCount(0);
  // Two groups twice, then the third, twice.
  await expect.poll(() => lines(page), { timeout: 120_000 }).toBe(6);
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.", { timeout: 120_000 });
});
