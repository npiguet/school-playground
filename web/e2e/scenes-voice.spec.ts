// The dictation's voice on the server (spec 2026-09-27 §5): the lines sent ahead, the waiting line,
// Éris's card when the voice is silenced (a route stands in for a stopped `tts` container), « Réessayer »,
// the way back to the camp, and the lyre's trial. The e2e stack runs `tts` as its stub (TTS_STUB=1).
import type { APIRequestContext, Page, Route, TestInfo } from '@playwright/test';
import { test, expect } from './crashGuard';
import { createProfileApi, createText, expectBattle, expectCamp, heroNamer, spokenLines, tap, uniqueName, variantsOf } from './helpers';
import { frenchSpacing } from '../src/lib/text/french';

const heroName = heroNamer('Voix');
const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
/** BODY's sentences as the voice says them (spoken.ts: a full stop is followed by its name). */
const SENTENCES = ['Les fées dansent dans la clairière. Point.', 'Elles chantent et les oiseaux les écoutent. Point.'];
const WRITE = "À toi d'écrire.";
type PrepareBody = { profile_id: number; lines: { text: string; speed: number }[] };

async function startDictation(page: Page, request: APIRequestContext, testInfo: TestInfo, pace: 1 | 2 | 3 | 4) {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('Voix'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await tap(sheet.getByTestId(`pace-option-${pace}`), testInfo);
  await tap(sheet.getByRole('button', { name: 'Commencer la dictée' }), testInfo);
  await expectBattle(page, 'dictation');
  return { id, textId: text.id as number };
}

/** Answers /api/tts/speak with `status` while `down()` says so, else lets it through; counts the asks. */
async function voiceDown(page: Page, status: number, down: () => boolean) {
  const asked = { n: 0 };
  await page.route('**/api/tts/speak', (route: Route) => {
    asked.n++;
    return down() ? route.fulfill({ status, contentType: 'application/json', body: '{"detail":"voice down"}' }) : route.continue();
  });
  return asked;
}

test('the whole script is sent ahead once, each line once, in script order (spec §5.2)', async ({ page, request }, testInfo) => {
  const prepared = page.waitForRequest((r) => r.url().endsWith('/api/tts/prepare'));
  const { id } = await startDictation(page, request, testInfo, 3);
  const body = (await prepared).postDataJSON() as PrepareBody;
  expect(body.profile_id).toBe(id);
  expect(body.lines.length).toBeGreaterThan(1);
  expect(new Set(body.lines.map((l) => l.text)).size).toBe(body.lines.length);
  expect(body.lines.every((l) => l.speed === 0.9)).toBe(true);
  expect(body.lines[0].text).toContain('Les fées dansent');
});

// Fix wave A, Ruling R-A1: pace 4's full readings are said a sentence at a time, so the first sound
// comes as soon as the first sentence is made, not the whole text.
test('pace 4 reads the text a sentence at a time: the first sentence alone first, sent ahead first', async ({ page, request }, testInfo) => {
  const prepared = page.waitForRequest((r) => r.url().endsWith('/api/tts/prepare'));
  const asked = page.waitForRequest((r) => r.url().endsWith('/api/tts/speak'));
  await startDictation(page, request, testInfo, 4);
  const body = (await prepared).postDataJSON() as PrepareBody;
  expect(body.lines.slice(0, 2)).toEqual(SENTENCES.map((text) => ({ text, speed: 1 })));
  expect(body.lines.slice(-2)).toEqual(SENTENCES.map((text) => ({ text, speed: 0.95 })));
  expect((await asked).postDataJSON()).toMatchObject({ text: SENTENCES[0], speed: 1 });
  await expect.poll(async () => (await spokenLines(page)).length).toBeGreaterThanOrEqual(2);
  expect((await spokenLines(page)).slice(0, 2).map((l) => l.text)).toEqual(SENTENCES);
});

/** Holds the first /api/tts/speak until the test calls `release()` (review fix round 1 #2: the waiting
 *  line stays up as long as the test needs, so a stalled page cannot make it slip past a poll). */
async function holdFirstLine(page: Page) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let first = true;
  await page.route('**/api/tts/speak', async (route) => {
    if (first) {
      first = false;
      await released;
    }
    await route.continue();
  });
  return { release };
}

const WAITING = () => variantsOf('battle.voice.wait');

test('a line slow to come shows the waiting line until it plays (spec §5.2)', async ({ page, request }, testInfo) => {
  const held = await holdFirstLine(page);
  await startDictation(page, request, testInfo, 1);
  const status = page.getByTestId('dictation-status');
  await expect.poll(async () => WAITING().includes(((await status.textContent()) ?? '').trim())).toBe(true);
  held.release();
  await expect(status).toHaveText(WRITE);
  expect((await spokenLines(page))[0].text).toContain('Les fées dansent');
});

// Review fix round 1 #1: a pause (or the portrait auto-pause) while a line is still coming says
// « En pause. », not the waiting line, for as long as the fetch goes on.
test('a pause while a line is still coming says « En pause. », not the waiting line', async ({ page, request }, testInfo) => {
  const held = await holdFirstLine(page);
  await startDictation(page, request, testInfo, 3);
  const status = page.getByTestId('dictation-status');
  await expect.poll(async () => WAITING().includes(((await status.textContent()) ?? '').trim())).toBe(true);
  await tap(page.getByTestId('btn-pause'), testInfo);
  await expect(status).toHaveText('En pause.');
  await expect(page.getByTestId('btn-resume')).toBeVisible();
  held.release();
  await expect(status).toHaveText('En pause.');
  await tap(page.getByTestId('btn-resume'), testInfo);
  await expect.poll(async () => (await spokenLines(page)).length).toBeGreaterThan(0);
});

test("a silenced voice stops on Éris's card; « Réessayer » carries on with the draft kept, even after failing again (spec §5.3)", async ({ page, request }, testInfo) => {
  let down = true;
  const asked = await voiceDown(page, 503, () => down);
  let prepares = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/tts/prepare')) prepares++;
  });
  await startDictation(page, request, testInfo, 1);
  const card = page.getByTestId('voice-lost');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-failure', 'unreachable');
  expect(asked.n).toBe(2); // one silent retry
  await expect(card.getByTestId('voice-lost-cause')).toHaveText(frenchSpacing('voix : serveur injoignable'));
  await expect(card.getByTestId('voice-lost-eris')).toHaveAttribute('data-key', 'battle.voice.lost');
  expect(variantsOf('battle.voice.lost')).toContain(((await card.getByTestId('voice-lost-eris-text').textContent()) ?? '').trim());
  await expect(page.getByTestId('dictation-status')).toHaveText("La voix s'est tue.");
  await page.getByTestId('dictation-textarea').fill('Les fées');
  // Review Focus 3: still down, « Réessayer » brings the card back, never a stuck dictation.
  expect(prepares).toBe(1);
  await tap(card.getByTestId('btn-voice-retry'), testInfo);
  await expect.poll(() => asked.n).toBe(4);
  // Final review M4: a restarted voice has lost its queue: « Réessayer » sends the rest ahead again.
  await expect.poll(() => prepares).toBe(2);
  await expect(page.getByTestId('voice-lost')).toBeVisible();
  down = false;
  await tap(page.getByTestId('btn-voice-retry'), testInfo);
  await expect(page.getByTestId('voice-lost')).toHaveCount(0);
  await expect(page.getByTestId('dictation-status')).toHaveText(WRITE);
  await expect(page.getByTestId('dictation-textarea')).toHaveValue('Les fées');
  expect((await spokenLines(page))[0].text).toContain('Les fées dansent');
});

test("a voice that answers with an error names it for the parent: « erreur du serveur »", async ({ page, request }, testInfo) => {
  await voiceDown(page, 500, () => true);
  await startDictation(page, request, testInfo, 2);
  await expect(page.getByTestId('voice-lost')).toHaveAttribute('data-failure', 'server');
  await expect(page.getByTestId('voice-lost-cause')).toHaveText(frenchSpacing('voix : erreur du serveur'));
});

test('« Retour au camp » leaves the dictation as « Quitter » does: the draft waits behind the ribbon', async ({ page, request }, testInfo) => {
  await voiceDown(page, 503, () => true);
  const { id, textId } = await startDictation(page, request, testInfo, 1);
  await page.getByTestId('dictation-textarea').fill('Les fées');
  await tap(page.getByTestId('btn-voice-camp'), testInfo);
  await expectCamp(page);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.goto(`/#/p/${id}/play/${textId}`);
  await expectBattle(page, 'muster');
  // The resume ribbon (MUSTER.resume), where the existing resume tests read it.
  await expect(page.getByTestId('battle-resume')).toContainText("Ton brouillon t'attend là où tu l'avais laissé.");
});

test("the lyre's trial slow to come shows the dictation's waiting line until it plays (Task 9 review #6)", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const held = await holdFirstLine(page);
  await page.goto(`/#/p/${id}/settings`);
  const lyre = page.getByTestId('overlay-lyre');
  await tap(lyre.getByTestId('lyre-try-voice'), testInfo);
  const wait = lyre.getByTestId('lyre-voice-wait');
  await expect(wait).toBeVisible();
  expect(WAITING()).toContain(((await wait.textContent()) ?? '').trim());
  held.release();
  await expect.poll(async () => (await spokenLines(page)).at(-1)?.text ?? '').toContain('Je lirai tes dictées');
  await expect(wait).toHaveCount(0);
  await expect(lyre.getByTestId('voice-lost')).toHaveCount(0);
});

test("the lyre's trial speaks through the server; silenced, it shows the card's short form", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let down = true;
  await voiceDown(page, 503, () => down);
  await page.goto(`/#/p/${id}/settings`);
  const lyre = page.getByTestId('overlay-lyre');
  await tap(lyre.getByTestId('lyre-try-voice'), testInfo);
  const card = lyre.getByTestId('voice-lost');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('btn-voice-camp')).toHaveCount(0);
  down = false;
  await tap(card.getByTestId('btn-voice-retry'), testInfo);
  await expect.poll(async () => (await spokenLines(page)).at(-1)?.text ?? '').toContain('Je lirai tes dictées');
  await expect(lyre.getByTestId('voice-lost')).toHaveCount(0);
});
