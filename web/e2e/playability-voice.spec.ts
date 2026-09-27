import { test, expect } from './crashGuard';
import type { APIRequestContext, Page, Route } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import { createProfileApi, createText, expectBattle, installKeyboardSim, setKeyboard, spokenLines, variantsOf } from './helpers';

// The voice walk for the playability review (Kokoro plan, spec 2026-09-27 §5): iPad-landscape
// screenshots of what the player sees while the server's voice gets ready, reads, pauses, fails and
// comes back, plus a timeline of the status line (when the waiting line shows, when the first line
// starts). Run it on the real voice, so the timings are Kokoro's own:
//     TTS_STUB=0 scripts/playwright.sh --config playwright.playability.config.ts playability-voice --project=ipad-landscape
// WALK_OUT=docs/reviews/voice refreshes the tracked baseline (the shots and walk-notes-ipad-landscape.md);
// unset, the shots go to web/test-results/walk-voice. The failure card comes from routes (a 503 is what
// the game server answers while the `tts` container is stopped; tools/tts/voice_walk.sh stops it for real).
const OUT = posix.resolve('/work', process.env.WALK_OUT || 'web/test-results/walk-voice');
const SHORT = 'Le renard court dans la forêt. Il cherche sa tanière. La nuit tombe sur la colline.';

test.use({ tours: false });

interface Walk {
  page: Page;
  request: APIRequestContext;
  notes: string[];
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => Array.from(document.images).every((img) => img.complete))).toBe(true);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function shot(w: Walk, name: string, quick = false) {
  const size = w.page.viewportSize();
  if (!quick) {
    if (size) await w.page.mouse.move(size.width / 2, size.height - 1);
    await settle(w.page);
  }
  await w.page.screenshot({ path: `${OUT}/ipad-landscape-${name}.jpg`, type: 'jpeg', quality: 85 });
  w.notes.push(`- shot ${name}`);
}

// The status line's text, sampled every 25 ms from the page, with the time since the dictation began.
async function installStatusLog(page: Page) {
  await page.addInitScript(() => {
    const log: { t: number; text: string }[] = [];
    (window as unknown as { __statusLog: typeof log }).__statusLog = log;
    let last = '';
    let t0 = 0;
    setInterval(() => {
      const el = document.querySelector('[data-testid="dictation-status"]');
      if (!el) {
        // Off the dictation: the next one starts a fresh timeline.
        t0 = 0;
        last = '';
        log.length = 0;
        return;
      }
      if (!t0) t0 = performance.now();
      const text = (el.textContent ?? '').trim();
      if (text !== last) {
        last = text;
        log.push({ t: Math.round(performance.now() - t0), text });
      }
    }, 25);
  });
}
const statusLog = (page: Page) =>
  page.evaluate(() => (window as unknown as { __statusLog: { t: number; text: string }[] }).__statusLog ?? []);
/** The timeline once the waiting line has given way (the sampler lags a line's start by up to 25 ms). */
async function settledLog(page: Page) {
  await expect.poll(async () => WAITING().includes((await statusLog(page)).at(-1)?.text ?? '')).toBe(false);
  const log = await statusLog(page);
  return log.map((e) => `${e.t} ms « ${e.text} »`).join(' → ');
}

// Readable names for the shots (the playability config runs one worker; an earlier walk's heroes are
// deleted first, since a hero's name is unique).
const HEROES = ['Ariane', 'Iris', 'Daphné', 'Thalie', 'Io', 'Hélène', 'Médée', 'Callisto'].map((n) => `${n}-Voix`);
let heroes = 0;
const nextHero = (request: APIRequestContext) => createProfileApi(request, HEROES[heroes++]);
async function clearEarlierWalk(request: APIRequestContext) {
  const profiles = (await (await request.get('/api/profiles')).json()) as { id: number; name: string }[];
  for (const p of profiles.filter((x) => HEROES.includes(x.name))) {
    expect((await request.delete(`/api/profiles/${p.id}`)).status()).toBe(204);
  }
}

async function startDictation(w: Walk, body: string, pace: 1 | 2 | 3 | 4, title = 'La forêt du renard') {
  const id = await nextHero(w.request);
  const text = await createText(w.request, { title, body, level: '10H' });
  await w.page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(w.page, 'muster');
  const sheet = w.page.getByTestId('battle-parchment');
  await sheet.getByTestId(`pace-option-${pace}`).tap();
  await sheet.getByRole('button', { name: 'Commencer la dictée' }).tap();
  await expectBattle(w.page, 'dictation');
  return { id, textId: text.id as number };
}

const WAITING = () => variantsOf('battle.voice.wait');
const isWaiting = (page: Page, variants: string[]) =>
  page.waitForFunction(
    (v) => v.includes((document.querySelector('[data-testid="dictation-status"]')?.textContent ?? '').trim()),
    variants,
    { polling: 'raf', timeout: 5_000 },
  );

async function voiceDown(page: Page, how: () => number | 'abort' | null) {
  await page.route('**/api/tts/speak', (route: Route) => {
    const h = how();
    if (h === null) return route.continue();
    if (h === 'abort') return route.abort('connectionrefused');
    return route.fulfill({ status: h, contentType: 'application/json', body: '{"detail":"voice down"}' });
  });
}

test('the voice walk: waiting, pause, the card, « Réessayer », the lyre', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'ipad-landscape', 'landscape only (the dictation pauses in portrait)');
  mkdirSync(OUT, { recursive: true });
  // The stack's voice, as /api/tts/health names it (TTS_STUB reaches the tts container, not this one).
  const health = await (await request.get('/api/tts/health')).text();
  const w: Walk = { page, request, notes: [`# Voice walk (ipad-landscape)`, '', `/api/tts/health: ${health}`, ''] };
  await installStatusLog(page);
  await installKeyboardSim(page);
  await clearEarlierWalk(request);

  // v01: the muster, now without the "this device can't read aloud" note.
  {
    const id = await nextHero(request);
    const text = await createText(request, { title: 'La forêt du renard', body: SHORT, level: '10H' });
    await page.goto(`/#/p/${id}/play/${text.id}`);
    await expectBattle(page, 'muster');
    await shot(w, 'v01-muster');
  }

  // v02-v09: each pace's start, the waiting line if it shows, then the first line under way.
  for (const pace of [1, 2, 3, 4] as const) {
    await startDictation(w, SHORT, pace);
    const n = 2 * pace;
    const pad = (k: number) => String(k).padStart(2, '0');
    let sawWait = true;
    try {
      await isWaiting(page, WAITING());
      await shot(w, `v${pad(n)}-pace${pace}-waiting`, true);
    } catch {
      sawWait = false;
      await shot(w, `v${pad(n)}-pace${pace}-start`, true);
    }
    await expect.poll(async () => (await spokenLines(page)).length, { timeout: 60_000 }).toBeGreaterThan(0);
    // A line counts as played when it is asked for; the status leaves the waiting line when it starts.
    const timeline = await settledLog(page);
    await shot(w, `v${pad(n + 1)}-pace${pace}-first-line`);
    w.notes.push(`- pace ${pace}: waiting line ${sawWait ? 'seen' : 'not seen'}; status timeline: ${timeline}`);
  }

  // v10-v13: pace 4 on the longest seed text (the known 23-26 s wait), and a pause taken during it.
  {
    const body = (JSON.parse(readFileSync('../content/seed/007-renard-mouches-eau.json', 'utf-8')) as { body: string }).body;
    await startDictation(w, body, 4, "Les Mouches d'eau");
    await isWaiting(page, WAITING());
    await shot(w, 'v10-long-pace4-waiting');
    await page.waitForTimeout(10_000);
    await shot(w, 'v11-long-pace4-still-waiting-10s');
    // She is typing (the keyboard is open, the compact bar): is the wait still said?
    await page.getByTestId('dictation-textarea').click();
    await setKeyboard(page, 400);
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
    await shot(w, 'v11b-long-pace4-waiting-keyboard');
    await setKeyboard(page, 0);
    await expect.poll(async () => (await spokenLines(page)).length, { timeout: 120_000 }).toBeGreaterThan(0);
    w.notes.push(`- longest text, pace 4: ${await settledLog(page)}`);
    await shot(w, 'v12-long-pace4-first-line', true);
    await page.getByTestId('btn-pause').tap();
    await expect(page.getByTestId('dictation-status')).toHaveText('En pause.');
    await page.getByTestId('dictation-textarea').fill('Un jour, le renard');
    await shot(w, 'v13-paused');
  }

  // v14-v18: the card. A 503 (what a stopped container gives), a 500, a refused connection; then back.
  {
    let mode: number | 'abort' | null = null;
    await voiceDown(page, () => mode);
    await startDictation(w, SHORT, 1);
    await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.", { timeout: 60_000 });
    await page.getByTestId('dictation-textarea').fill('Le renard court dans la forêt.');
    mode = 503;
    // The second sentence was fetched ahead while the first played; the third cannot come.
    await page.getByTestId('btn-next').tap();
    await expect(page.getByTestId('btn-next')).toBeEnabled({ timeout: 60_000 });
    await page.getByTestId('dictation-textarea').fill('Le renard court dans la forêt. Il cherche sa tanière.');
    const t = Date.now();
    await page.getByTestId('btn-next').tap();
    await expect(page.getByTestId('voice-lost')).toBeVisible({ timeout: 60_000 });
    w.notes.push(`- 503: the card showed ${Date.now() - t} ms after « Suivant »`);
    await shot(w, 'v14-card-503');
    mode = 500;
    await page.getByTestId('btn-voice-retry').tap();
    await expect(page.getByTestId('voice-lost')).toHaveAttribute('data-failure', 'server', { timeout: 30_000 });
    await shot(w, 'v15-card-500');
    mode = 'abort';
    await page.getByTestId('btn-voice-retry').tap();
    await expect(page.getByTestId('voice-lost')).toHaveAttribute('data-failure', 'unreachable', { timeout: 30_000 });
    await shot(w, 'v16-card-network');
    // The card while she types (the keyboard open, the compact layout).
    await page.getByTestId('dictation-textarea').click();
    await setKeyboard(page, 400);
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
    await shot(w, 'v16b-card-keyboard');
    await setKeyboard(page, 0);
    mode = null;
    await page.getByTestId('btn-voice-retry').tap();
    await expect(page.getByTestId('voice-lost')).toHaveCount(0, { timeout: 30_000 });
    await shot(w, 'v17-retry-resumed', true);
    await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.", { timeout: 60_000 });
    await shot(w, 'v18-retry-line-done');
    const log = await statusLog(page);
    w.notes.push(`- card and retry: ${log.map((e) => `${e.t} ms « ${e.text} »`).join(' → ')}`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }

  // v19-v22: the lyre's trial, its waiting line (the first line held), and its short card.
  {
    const id = await nextHero(request);
    let release!: () => void;
    const released = new Promise<void>((r) => (release = r));
    let hold = true;
    let fail = false;
    await page.route('**/api/tts/speak', async (route) => {
      if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      if (hold) {
        hold = false;
        await released;
      }
      return route.continue();
    });
    await page.goto(`/#/p/${id}/settings`);
    const lyre = page.getByTestId('overlay-lyre');
    await expect(lyre).toBeVisible();
    await expect.poll(() => lyre.evaluate((el) => el.getAnimations().length)).toBe(0);
    await shot(w, 'v19-lyre');
    await lyre.getByTestId('lyre-try-voice').tap();
    await expect(lyre.getByTestId('lyre-voice-wait')).toBeVisible();
    await shot(w, 'v20-lyre-waiting');
    release();
    await expect.poll(async () => (await spokenLines(page)).length, { timeout: 60_000 }).toBeGreaterThan(0);
    await expect(lyre.getByTestId('lyre-voice-wait')).toHaveCount(0);
    await shot(w, 'v21-lyre-trial-playing', true);
    await expect(lyre.getByTestId('lyre-try-voice')).toBeEnabled({ timeout: 30_000 });
    // A second trial replays the clip this lyre already holds: reopen it, so the trial fetches again.
    fail = true;
    await page.reload();
    await expect(lyre).toBeVisible();
    await expect.poll(() => lyre.evaluate((el) => el.getAnimations().length)).toBe(0);
    await lyre.getByTestId('lyre-try-voice').tap();
    await expect(lyre.getByTestId('voice-lost')).toBeVisible();
    await shot(w, 'v22-lyre-card');
  }

  writeFileSync(`${OUT}/walk-notes-ipad-landscape.md`, `${w.notes.join('\n')}\n`);
});
