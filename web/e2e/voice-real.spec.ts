// The real voice (spec 2026-09-27 §7): Kokoro, not the stub, reads a dictation's first line. Run by
// scripts/check.sh with TTS_STUB=0 through playwright.voice.config.ts.
import { test, expect } from './crashGuard';
import { createProfileApi, createText, expectBattle, installFastPauses, spokenLines, uniqueName } from './helpers';

test("Kokoro reads a dictation's first line", async ({ page, request }) => {
  await installFastPauses(page);
  const health = await request.get('/api/tts/health');
  expect(health.status()).toBe(200);
  const { voice, engine } = (await health.json()) as { voice: string; engine: string };
  expect(voice).toBe('ready');
  expect(engine).toMatch(/^kokoro-82m-v1\.0-/);
  const id = await createProfileApi(request, uniqueName('Kokoro'));
  const text = await createText(request, { title: uniqueName('Kokoro'), body: 'Le renard court dans la forêt. Il cherche sa tanière.', level: '10H' });
  const speak = page.waitForResponse((r) => r.url().endsWith('/api/tts/speak'), { timeout: 120_000 });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await sheet.getByTestId('pace-option-1').click();
  await sheet.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expectBattle(page, 'dictation');
  const res = await speak;
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('audio/mpeg');
  // About 3 s of speech: an MP3 of that length is several kilobytes, whatever the encoder's bitrate.
  expect((await res.body()).length).toBeGreaterThan(4_000);
  // The pace redesign: pace I reads the group twice (a long pause between), then waits for « Suivant ».
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.", { timeout: 60_000 });
  expect((await spokenLines(page)).map((l) => l.text)).toEqual(['Le renard court dans la forêt. Point.', 'Le renard court dans la forêt. Point.']);
});

// Pace-bug report 2026-09-27, open item 2: a breath group cut on a word ends with a bare comma, not a
// full stop, so the voice keeps the phrase open. Kokoro takes that ending and reads it. Pace II reads
// the breath groups as they are (pace III merges this sentence's two into one).
test('Kokoro reads a breath group that ends on a comma, the phrase going on', async ({ page, request }) => {
  const id = await createProfileApi(request, uniqueName('Kokoro'));
  const body = "Quand les marins d'Ulysse débarquèrent sur l'île boisée où régnait la magicienne Circé.";
  const text = await createText(request, { title: uniqueName('Kokoro'), body, level: '10H' });
  const first = "Quand les marins d'Ulysse débarquèrent sur l'île boisée,";
  const speak = page.waitForResponse(
    (r) => r.url().endsWith('/api/tts/speak') && (r.request().postDataJSON() as { text: string }).text === first,
    { timeout: 120_000 },
  );
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await sheet.getByTestId('pace-option-2').click();
  await sheet.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expectBattle(page, 'dictation');
  const res = await speak;
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('audio/mpeg');
  expect((await res.body()).length).toBeGreaterThan(4_000);
  await expect.poll(async () => (await spokenLines(page)).length, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
  expect((await spokenLines(page))[0].text).toBe(first);
});
