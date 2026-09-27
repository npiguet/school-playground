// The dictation's voice on the server (spec 2026-09-27 §5): the lines sent ahead, the waiting line,
// Éris's card when the voice is silenced (a route stands in for a stopped `tts` container), « Réessayer »,
// the way back to the camp, and the lyre's trial. The e2e stack runs `tts` as its stub (TTS_STUB=1).
import type { APIRequestContext, Page, Route, TestInfo } from '@playwright/test';
import { test, expect } from './crashGuard';
import {
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  heroNamer,
  installKeyboardSim,
  setKeyboard,
  spokenLines,
  tap,
  uniqueName,
  variantsOf,
} from './helpers';
import { frenchSpacing } from '../src/lib/text/french';

/** waitLine.ts's WAIT_HOLD_MS (that module pulls in the audio engine, so it is not imported here). */
const WAIT_HOLD_MS = 800;

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
const WAITING_LONG = () => variantsOf('battle.voice.waitLong');
/** Matches exactly one of `lines` (a key's variants, for toHaveText). */
const oneOf = (lines: string[]) => new RegExp(`^\\s*(${lines.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*$`);

// Fix wave B ruling 1: the opener after 1.2 s, the seal waiting (not the reading's pulse), a second
// line past 5 s, « Pause » still there to tap.
test('a line slow to come shows the waiting line, then a second one, until it plays (spec §5.2)', async ({ page, request }, testInfo) => {
  const held = await holdFirstLine(page);
  await startDictation(page, request, testInfo, 3);
  const status = page.getByTestId('dictation-status');
  const seal = page.getByTestId('dictation-seal').first();
  await expect(status).toHaveText(oneOf(WAITING()));
  await expect(seal).toHaveAttribute('data-status', 'voice-waiting');
  await expect(seal).not.toHaveClass(/pulse/);
  await expect(page.getByTestId('btn-pause')).toBeEnabled();
  await expect(status).toHaveText(oneOf(WAITING_LONG()), { timeout: 10_000 });
  held.release();
  await expect.poll(async () => (await spokenLines(page)).length).toBeGreaterThan(0);
  expect((await spokenLines(page))[0].text).toContain('Les fées dansent');
  await expect(status).toHaveText('Écoute…');
  await expect(seal).toHaveAttribute('data-status', 'playing');
});

// Playability #2: with the keyboard open the stage folds into the compact bar; the late line is
// said there too, next to the seal, as « En pause. » is.
test('with the keyboard open, the compact bar says the waiting line', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  const held = await holdFirstLine(page);
  await startDictation(page, request, testInfo, 3);
  await tap(page.getByTestId('dictation-textarea'), testInfo);
  await setKeyboard(page, (await page.evaluate(() => window.innerHeight)) - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  const bar = page.getByTestId('bar-status');
  await expect(bar).toHaveText(oneOf(WAITING()));
  // One line (17 px type), cut with an ellipsis if the bar is short: never two lines tall.
  expect((await bar.boundingBox())!.height).toBeLessThan(34);
  held.release();
  await expect(bar).toHaveText(/^\s*$/);
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

test("a silenced voice stops on Éris's card; « Réessayer » keeps it up while it asks, and carries on with the draft kept (spec §5.3)", async ({ page, request }, testInfo) => {
  let down = true;
  // While set, the voice's answers wait for it (the card's « Réessayer » caught in the middle).
  let gate: Promise<void> | null = null;
  const asked = { n: 0 };
  await page.route('**/api/tts/speak', async (route: Route) => {
    asked.n++;
    if (gate) await gate;
    return down ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"voice down"}' }) : route.continue();
  });
  let prepares = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/tts/prepare')) prepares++;
  });
  await startDictation(page, request, testInfo, 1);
  const card = page.getByTestId('voice-lost');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-failure', 'unreachable');
  expect(asked.n).toBe(2); // one silent retry
  // Fix wave B ruling 4: her own tap first, a parent if the voice stays silent.
  await expect(card).toContainText(frenchSpacing('Touche « Réessayer ». Si la voix reste muette, appelle un parent : il saura rompre ce sortilège.'));
  const cause = card.getByTestId('voice-lost-cause');
  await expect(cause).toHaveText(frenchSpacing('voix : serveur injoignable'));
  // Playability #13: the parent's line upright, 15 px, in the ink, readable over her shoulder.
  await expect(cause).toHaveCSS('font-style', 'normal');
  await expect(cause).toHaveCSS('font-size', '15px');
  const eris = card.getByTestId('voice-lost-eris');
  await expect(eris).toHaveAttribute('data-key', 'battle.voice.lost');
  const gloat = ((await card.getByTestId('voice-lost-eris-text').textContent()) ?? '').trim();
  expect(variantsOf('battle.voice.lost')).toContain(gloat);
  // Playability #7: the speaking plate's layout, her name above her line, and no wax seal by her portrait.
  await expect(eris.locator('.voice-name')).toHaveText('Éris');
  const name = (await eris.locator('.voice-name').boundingBox())!;
  const said = (await eris.locator('.voice-text').boundingBox())!;
  expect(name.y + name.height).toBeLessThanOrEqual(said.y + 1);
  expect(await card.evaluate((el) => getComputedStyle(el, '::before').display)).toBe('none');
  await expect(page.getByTestId('dictation-status')).toHaveText("La voix s'est tue.");
  await page.getByTestId('dictation-textarea').fill('Les fées');
  // Playability #5: while « Réessayer » asks, the card stays up (the same card, the same gloat) and
  // says so; still down, it stays with Éris's first line, never a new one in reply to her tap.
  expect(prepares).toBe(1);
  await card.evaluate((el) => el.setAttribute('data-first-card', ''));
  let open!: () => void;
  gate = new Promise<void>((resolve) => (open = resolve));
  await tap(card.getByTestId('btn-voice-retry'), testInfo);
  await expect(card).toHaveAttribute('data-retrying', 'true');
  await expect(card.getByTestId('btn-voice-retry')).toBeDisabled();
  await expect(card.getByTestId('voice-lost-retrying')).toHaveText('La Pythie essaie encore…');
  await expect(page.getByTestId('dictation-status')).toHaveText("La voix s'est tue.");
  gate = null;
  open();
  await expect.poll(() => asked.n).toBe(4);
  await expect(card).toHaveAttribute('data-retrying', 'false');
  await expect(card.getByTestId('btn-voice-retry')).toBeEnabled();
  await expect(card).toHaveAttribute('data-first-card', '');
  await expect(card.getByTestId('voice-lost-eris-text')).toHaveText(gloat);
  // Final review M4: a restarted voice has lost its queue: « Réessayer » sends the rest ahead again.
  await expect.poll(() => prepares).toBe(2);
  down = false;
  await tap(page.getByTestId('btn-voice-retry'), testInfo);
  await expect(page.getByTestId('voice-lost')).toHaveCount(0);
  await expect(page.getByTestId('dictation-status')).toHaveText(WRITE);
  await expect(page.getByTestId('dictation-textarea')).toHaveValue('Les fées');
  expect((await spokenLines(page))[0].text).toContain('Les fées dansent');
});

// Playability #8: the voice back after « Réessayer », the Pythia says so for a moment in the status
// line, and the card folds away rather than vanishing.
test('when the voice comes back, the Pythia says so, then the dictation reads on', async ({ page, request }, testInfo) => {
  let down = true;
  await voiceDown(page, 503, () => down);
  await startDictation(page, request, testInfo, 3);
  const card = page.getByTestId('voice-lost');
  await expect(card).toBeVisible();
  down = false;
  await tap(card.getByTestId('btn-voice-retry'), testInfo);
  const status = page.getByTestId('dictation-status');
  await expect(status).toHaveText(oneOf(variantsOf('battle.voice.back')));
  await expect(card).toHaveCount(0);
  await expect(status).toHaveText('Écoute…');
  expect((await spokenLines(page))[0].text).toContain('Les fées dansent');
});

// The card under the keyboard (playability #7's plate is taller): a smaller plate, the parent's line
// beside the buttons, and still a line of her draft in sight under the card.
test('under the keyboard the card leaves a line of the draft in sight', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  await voiceDown(page, 503, () => true);
  await startDictation(page, request, testInfo, 1);
  const card = page.getByTestId('voice-lost');
  await expect(card).toBeVisible();
  const ta = page.getByTestId('dictation-textarea');
  await ta.fill('Les fées dansent');
  await tap(ta, testInfo);
  const inner = await page.evaluate(() => window.innerHeight);
  const view = await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await expect(card.getByTestId('btn-voice-retry')).toBeVisible();
  await expect(card.getByTestId('voice-lost-cause')).toBeVisible();
  const cardBox = (await card.boundingBox())!;
  const box = (await ta.boundingBox())!;
  // The first line of the draft: the textarea's top padding, then one line of Literata.
  const firstLine = await ta.evaluate((el) => parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).lineHeight));
  expect(box.y).toBeGreaterThanOrEqual(cardBox.y + cardBox.height - 1);
  expect(Math.min(box.y + box.height, view.bottom) - box.y).toBeGreaterThanOrEqual(firstLine);
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
  // Playability #10: the trial says it is being read. The e2e voice plays a line in 20 ms, so what
  // the lyre showed is written down as it appears.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __lyreSeen: string[] }).__lyreSeen = seen;
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="lyre-voice-playing"]');
      if (el && !seen.includes(el.textContent ?? '')) seen.push(el.textContent ?? '');
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await tap(lyre.getByTestId('lyre-try-voice'), testInfo);
  const wait = lyre.getByTestId('lyre-voice-wait');
  await expect(wait).toBeVisible();
  expect(WAITING()).toContain(((await wait.textContent()) ?? '').trim());
  // Past the waiting line's hold (ruling 1), so the trial's own line shows as soon as it plays.
  await page.waitForTimeout(WAIT_HOLD_MS);
  held.release();
  await expect.poll(async () => (await spokenLines(page)).at(-1)?.text ?? '').toContain('Je lirai tes dictées');
  await expect(wait).toHaveCount(0);
  await expect(lyre.getByTestId('voice-lost')).toHaveCount(0);
  await expect(lyre.getByTestId('lyre-try-voice')).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as { __lyreSeen: string[] }).__lyreSeen)).toEqual(['Écoute la Pythie…']);
});

test("the lyre's trial speaks through the server; silenced, it shows the card's short form", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let down = true;
  let gate: Promise<void> | null = null;
  await page.route('**/api/tts/speak', async (route: Route) => {
    if (gate) await gate;
    return down ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }) : route.continue();
  });
  await page.goto(`/#/p/${id}/settings`);
  const lyre = page.getByTestId('overlay-lyre');
  await tap(lyre.getByTestId('lyre-try-voice'), testInfo);
  const card = lyre.getByTestId('voice-lost');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('btn-voice-camp')).toHaveCount(0);
  // Playability #10: one button replays the trial while the card is up, the card's own.
  await expect(lyre.getByTestId('lyre-try-voice')).toHaveCount(0);
  // Playability #5: the card stays up, its button waiting, while « Réessayer » asks.
  const gloat = ((await card.getByTestId('voice-lost-eris-text').textContent()) ?? '').trim();
  let open!: () => void;
  gate = new Promise<void>((resolve) => (open = resolve));
  await tap(card.getByTestId('btn-voice-retry'), testInfo);
  await expect(card).toHaveAttribute('data-retrying', 'true');
  await expect(card.getByTestId('btn-voice-retry')).toBeDisabled();
  await expect(card.getByTestId('voice-lost-eris-text')).toHaveText(gloat);
  down = false;
  gate = null;
  open();
  await expect.poll(async () => (await spokenLines(page)).at(-1)?.text ?? '').toContain('Je lirai tes dictées');
  await expect(lyre.getByTestId('voice-lost')).toHaveCount(0);
  await expect(lyre.getByTestId('lyre-try-voice')).toBeEnabled();
});
