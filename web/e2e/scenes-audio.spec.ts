import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { test, expect } from './crashGuard';
import {
  audioContext,
  audioState,
  closeOverlay,
  createFreshHeroApi,
  createProfileApi,
  interruptAudio,
  createText,
  expectBattle,
  expectCamp,
  expectMusic,
  expectScene,
  heroNamer,
  installFastPauses,
  resumeSeeded,
  seedPlay,
  spokenLines,
  spokenVolumes,
  tap,
  uniqueName,
} from './helpers';
import { readdirSync, readFileSync } from 'node:fs';
import { frenchSpacing } from '../src/lib/text/french';
import { MUSIC_BUDGET_BYTES, SFX, SFX_BUDGET_BYTES, SFX_MAX_BYTES, TRACKS, TRACK_MAX_BYTES } from '../src/lib/audio/catalog';

// UI5 (spec §7): the engine's state through the recording backend (Ruling E10): no real sound.
const heroName = heroNamer('Lyre');

// Ruling E7's warning, written with a plain space; the lyre shows it through frenchSpacing (E15).
const MUTED_VOICE_NOTE = "En sourdine, la dictée n'est plus lue à voix haute : il faudra quelqu'un pour te la lire.";

test('silent until « Entrer », then the sea wind at the gates (Ruling E3)', async ({ page }, testInfo) => {
  // Review #12: an e2e page records and never even loads Howler (its chunk is imported lazily).
  const scripts: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'script') scripts.push(r.url());
  });
  await page.goto('/');
  await expectScene(page, 'title');
  await expect.poll(async () => (await audioState(page))?.wanted).toBe('sea');
  expect(await audioState(page)).toMatchObject({ unlocked: false, playing: null, sfx: [] });
  // Ruling E3 over E3b: a tap on the title's background (its bottom-left corner) stays silent.
  const stage = (await page.getByTestId('scene-title').boundingBox())!;
  const corner = { x: stage.x + 12, y: stage.y + stage.height - 12 };
  if (testInfo.project.name === 'ipad') await page.touchscreen.tap(corner.x, corner.y);
  else await page.mouse.click(corner.x, corner.y);
  expect(await audioState(page)).toMatchObject({ unlocked: false, playing: null, sfx: [] });
  await tap(page.getByTestId('title-gate'), testInfo);
  await expectMusic(page, 'sea');
  // The gate's chime rings once its press has played out (the hotspot's activation), after the unlock.
  await expect.poll(async () => (await audioState(page))?.sfx).toContain('chime');
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.filter((u) => /howler/i.test(u))).toEqual([]);
});

test('each place plays its loop; a reload waits for the first tap', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect.poll(async () => (await audioState(page))?.wanted).toBe('camp');
  expect((await audioState(page))!.playing).toBeNull();
  await tap(page.getByTestId('camp-parchemins'), testInfo);
  await expectScene(page, 'library');
  await expectMusic(page, 'temple');
  await page.goBack();
  await expectCamp(page);
  await expectMusic(page, 'camp');
  await tap(page.getByTestId('camp-dossier'), testInfo);
  await expectScene(page, 'war');
  await expectMusic(page, 'war');
});

// Ruling E3b: after a reload, the first tap anywhere unlocks, not only « Entrer » or a hotspot. Final
// review I3: on the events that end a gesture, which WebKit accepts (a finger's pointerdown is not one).
test('after a reload the first tap on the dialogue box unlocks the camp (Ruling E3b)', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect.poll(async () => (await audioState(page))?.wanted).toBe('camp');
  expect(await audioState(page)).toMatchObject({ unlocked: false, playing: null });
  expect(await audioContext(page)).toBe('suspended');
  await tap(page.getByTestId('dialogue-advance'), testInfo);
  await expectMusic(page, 'camp');
  expect(await audioContext(page)).toBe('running');
});

test('a tap anywhere resumes the camp after a phone call; a pointerdown alone does not (review I3)', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  // Not a control: the laurel bar only shows the XP.
  const inert = page.getByTestId('hud-xp');
  await tap(inert, testInfo);
  await expectMusic(page, 'camp');
  await interruptAudio(page);
  expect(await audioContext(page)).toBe('interrupted');
  await inert.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, bubbles: true });
  expect(await audioContext(page)).toBe('interrupted');
  await tap(inert, testInfo);
  await expect.poll(() => audioContext(page)).toBe('running');
  await interruptAudio(page);
  await page.keyboard.press('Shift');
  await expect.poll(() => audioContext(page)).toBe('running');
  expect((await audioState(page))!.playing).toBe('camp');
});

test.describe('with the tours on', () => {
  test.use({ tours: true });
  test("after a reload the first tap on a tour unlocks (Ruling E3b)", async ({ page, request }, testInfo) => {
    const id = await createFreshHeroApi(request, heroName(testInfo.project.name));
    await page.goto(`/#/p/${id}/camp`);
    const tour = page.getByTestId('tour');
    await expect(tour).toHaveAttribute('data-tour', 'camp');
    await expect.poll(async () => (await audioState(page))?.wanted).toBe('camp');
    expect((await audioState(page))!.unlocked).toBe(false);
    // The tour's tap-anywhere: the place under it, away from its dialogue box.
    const box = (await tour.boundingBox())!;
    if (testInfo.project.name === 'ipad') await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.3);
    else await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
    await expectMusic(page, 'camp');
  });
});

test('the battle loop ducks through the dictation and the proofreading, and the camp comes back clear (Ruling E5)', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const body = 'Les enfants jouent dans le jardin. Ils rient.';
  const text = await createText(request, { title: uniqueName('Duck'), body, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'proofreading', draft: body.replace('jouent', 'joue') });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect.poll(async () => (await audioState(page))?.wanted).toBe('battle');
  expect((await audioState(page))!.ducks).toEqual([]);
  await resumeSeeded(page);
  await expectBattle(page, 'proofreading');
  await expect.poll(async () => (await audioState(page))?.ducks).toEqual(['proofreading']);
  // A hash navigation (Back, a link) keeps the page and its mixer: the camp's SceneStage clears the ducks.
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect.poll(async () => (await audioState(page))?.ducks).toEqual([]);
  await expect.poll(async () => (await audioState(page))?.wanted).toBe('camp');
});

test("the HUD's lyre opens three quick toggles that the lyre and a reload remember (Ruling E8)", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  const opener = page.getByTestId('hud-mute');
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  // Final review M11: it names the plate only while the plate is there.
  await expect(opener).not.toHaveAttribute('aria-controls');
  await tap(opener, testInfo);
  const plate = page.getByTestId('hud-sound');
  await expect(plate).toBeVisible();
  await expect(opener).toHaveAttribute('aria-expanded', 'true');
  await expect(opener).toHaveAttribute('aria-controls', 'hud-sound');
  for (const ch of ['music', 'sfx', 'voice']) await expect(plate.getByTestId(`hud-sound-${ch}`)).toHaveAttribute('aria-pressed', 'true');
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes(`/api/profiles/${id}`));
  await tap(plate.getByTestId('hud-sound-music'), testInfo);
  await saved;
  await expect(plate.getByTestId('hud-sound-music')).toHaveAttribute('aria-pressed', 'false');
  expect((await audioState(page))!.settings.music.muted).toBe(true);
  // UI5 playability #2: each row says its state in the lyre's words, never by a dimmed word alone.
  await expect(plate.getByTestId('hud-sound-music-state')).toHaveText('en sourdine');
  await expect(plate.getByTestId('hud-sound-sfx-state')).toHaveText('en marche');
  await expect(plate.getByTestId('hud-sound-voice-state')).toHaveText('en marche');
  // #1: a bronze plaque with a way to the full lyre as a button, not a link.
  await expect(plate.getByTestId('hud-sound-lyre')).toHaveText('Ouvrir la lyre');
  expect(await plate.getByTestId('hud-sound-lyre').evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('none');
  // The notch hangs right under the lyre button's centre.
  const notch = await plate.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const right = parseFloat(getComputedStyle(el, '::before').right);
    return r.right - 3 - right - 8; // inside the 3 px rim; the 16 px square's centre
  });
  const lyre = (await opener.boundingBox())!;
  expect(Math.abs(notch - (lyre.x + lyre.width / 2))).toBeLessThanOrEqual(3);
  await page.keyboard.press('Escape');
  await expect(plate).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.reload();
  await expectCamp(page);
  await tap(page.getByTestId('hud-mute'), testInfo);
  await expect(page.getByTestId('hud-sound-music')).toHaveAttribute('aria-pressed', 'false');
  // A tap outside closes the plate.
  await tap(page.getByTestId('hud-xp'), testInfo);
  await expect(page.getByTestId('hud-sound')).toHaveCount(0);
  // So does focus leaving it (Tab past its last control; review #8).
  await tap(page.getByTestId('hud-mute'), testInfo);
  await page.getByTestId('hud-sound-lyre').focus();
  await page.getByTestId('hud-hero').focus();
  await expect(page.getByTestId('hud-sound')).toHaveCount(0);
  await tap(page.getByTestId('hud-mute'), testInfo);
  await tap(page.getByTestId('hud-sound-lyre'), testInfo);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByTestId('hud-sound')).toHaveCount(0);
  await expect(page.getByTestId('lyre-mute-music')).toHaveAttribute('aria-pressed', 'true');
});

test('the lyre sets each channel: its trial speaks at the voice volume, the keys save once they rest, and a muted voice is said so (Ruling E7)', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/settings`);
  const lyre = page.getByTestId('overlay-lyre');
  const slider = lyre.getByTestId('lyre-volume-voice');
  await expect(slider).toHaveAttribute('aria-label', 'Volume de la voix');
  const patches: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PATCH' && r.url().includes(`/api/profiles/${id}`)) patches.push(r.url());
  });
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('40');
  await expect.poll(async () => (await audioState(page))?.settings.voice.volume).toBe(0.4);
  // Review #7: nine key presses, one save, once the keys rest.
  await page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes(`/api/profiles/${id}`));
  expect(patches).toHaveLength(1);
  await lyre.getByRole('button', { name: 'Écouter un essai' }).click();
  await expect.poll(async () => (await spokenVolumes(page)).at(-1)).toBe(0.4);
  await expect(lyre.getByTestId('lyre-voice-muted')).toHaveCount(0);
  // Review #6: each « Sourdine » names its channel; a muted channel's slider shows inactive.
  await lyre.getByRole('button', { name: frenchSpacing('Sourdine : Voix') }).click();
  await expect(lyre.getByTestId('lyre-mute-voice')).toHaveAttribute('aria-pressed', 'true');
  await expect(slider).toHaveClass(/inactive/);
  await expect(lyre.getByTestId('lyre-voice-muted')).toHaveText(frenchSpacing(MUTED_VOICE_NOTE));
  // Final review M7: a muted voice's trial would say nothing: it waits for the voice to come back.
  await expect(lyre.getByTestId('lyre-try-voice')).toBeDisabled();
  await expect(lyre.locator('input[type="checkbox"]')).toHaveCount(0);
  await closeOverlay(page);
});

// Review #11: the voice channel reaches a real dictation line; muted, nothing is fetched or played (Ruling
// E7b) and the dictation goes on at its pace.
async function dictationWithVoice(page: Page, request: APIRequestContext, testInfo: TestInfo, voice: { volume: number; muted: boolean }) {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const res = await request.patch(`/api/profiles/${id}`, {
    data: { settings: { audio: { music: { volume: 0.5, muted: false }, sfx: { volume: 0.7, muted: false }, voice } } },
  });
  expect(res.ok()).toBeTruthy();
  const body = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
  const text = await createText(request, { title: uniqueName('Voix'), body, level: '10H' });
  // The script's pauses only are shortened: a muted line still takes its length (voice.ts).
  await installFastPauses(page);
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await tap(sheet.getByTestId('pace-option-1'), testInfo);
  await tap(sheet.getByRole('button', { name: 'Commencer la dictée' }), testInfo);
  await expectBattle(page, 'dictation');
  return { id, textId: text.id as number };
}

test('a dictation line is spoken at the voice volume, with the music down under it (Ruling E5)', async ({ page, request }, testInfo) => {
  await dictationWithVoice(page, request, testInfo, { volume: 0.4, muted: false });
  await expect.poll(async () => (await spokenLines(page)).length).toBeGreaterThan(0);
  const first = (await spokenLines(page))[0];
  expect(first.text).toContain('Les fées dansent');
  expect(first.gain).toBe(0.4);
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.");
  await expect.poll(async () => (await audioState(page))?.ducks).toEqual(['dictation']);
});

test('a muted voice says nothing, and the dictation still goes on at its pace (Ruling E7b)', async ({ page, request }, testInfo) => {
  // Final review I1: each status the dictation shows, timed by the page itself (no round trip in it).
  await page.addInitScript(() => {
    const seen: { text: string; t: number }[] = [];
    (window as unknown as { __statuses: typeof seen }).__statuses = seen;
    new MutationObserver(() => {
      const text = document.querySelector('[data-testid="dictation-status"]')?.textContent ?? null;
      if (text !== null && text !== seen.at(-1)?.text) seen.push({ text, t: performance.now() });
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  const { id, textId } = await dictationWithVoice(page, request, testInfo, { volume: 1, muted: true });
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.");
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await tap(page.getByTestId('btn-next'), testInfo);
  const key = `discorde.play.${id}.${textId}`;
  // The second group's first step: the first group's two readings, its two pauses and « Suivant ».
  await expect.poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').dictationStep, key)).toBe(5);
  const statuses = () => page.evaluate(() => (window as unknown as { __statuses: { text: string; t: number }[] }).__statuses);
  const writing = "À toi d'écrire.";
  await expect.poll(async () => (await statuses()).filter((s) => s.text === writing).length).toBe(2);
  await expect(page.getByTestId('dictation-status')).toHaveText(writing);
  // Final review I1: « Suivant » starts the second group at once (« Écoute… »), read twice at the
  // pace redesign's rate 0.85. « Elles chantent et les oiseaux les écoutent. » is 43 characters before
  // its said punctuation, so the voice takes at least 43 × 65 ms / 0.85 ≈ 3.3 s a reading (voice.ts,
  // SPEECH_MS_PER_CHAR): the muted readings take as long (they used to take a third of it).
  const seen = await statuses();
  const second = seen.map((s) => s.text).lastIndexOf(writing);
  expect(seen[second - 1]?.text, JSON.stringify(seen)).toBe('Écoute…');
  expect(seen[second].t - seen[second - 1].t, JSON.stringify(seen)).toBeGreaterThanOrEqual((2 * 43 * 65) / 0.85);
  expect(await spokenLines(page)).toEqual([]);
  expect((await audioState(page))!.voiceSpeaking).toBe(false);
});

// ===== The files served (Ruling E16, E17, E9) =====

/** The boxes of an MP4 file, by path ('moov/trak/mdia/mdhd'): the first of each, its payload. */
function mp4Boxes(buf: Buffer): Map<string, Buffer> {
  const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'edts', 'minf', 'stbl']);
  const found = new Map<string, Buffer>();
  const walk = (at: number, end: number, path: string) => {
    while (at + 8 <= end) {
      let size = buf.readUInt32BE(at);
      const type = buf.toString('latin1', at + 4, at + 8);
      let head = 8;
      if (size === 1) {
        size = Number(buf.readBigUInt64BE(at + 8));
        head = 16;
      } else if (size === 0) size = end - at;
      if (size < head || at + size > end) break;
      const key = path ? `${path}/${type}` : type;
      if (!found.has(key)) found.set(key, buf.subarray(at + head, at + size));
      if (CONTAINERS.has(type)) walk(at + head, at + size, key);
      at += size;
    }
  };
  walk(0, buf.length, '');
  return found;
}

/** What the file says about its audio: the movie's and the track's clocks, and its one edit. Each is
 *  a full box (a version byte, three flag bytes); version 1 widens times and durations to 64 bits. */
function loopTiming(buf: Buffer) {
  const boxes = mp4Boxes(buf);
  const mvhd = boxes.get('moov/mvhd')!;
  const mdhd = boxes.get('moov/trak/mdia/mdhd')!;
  const elst = boxes.get('moov/trak/edts/elst')!;
  const v1 = (b: Buffer) => b[0] === 1;
  const num = (b: Buffer, at: number) => (v1(b) ? Number(b.readBigUInt64BE(at)) : b.readUInt32BE(at));
  // mvhd/mdhd: creation and modification times, then the timescale (always 32-bit), the duration.
  const clock = (b: Buffer) => {
    const at = 4 + (v1(b) ? 16 : 8);
    return { timescale: b.readUInt32BE(at), duration: num(b, at + 4) };
  };
  // elst: an entry count (32-bit), then per entry the segment's duration and its media time.
  expect(elst.readUInt32BE(4), 'one edit').toBe(1);
  const segment = num(elst, 8);
  const mediaTime = num(elst, 8 + (v1(elst) ? 8 : 4));
  // stsz: after the full box's header, a default sample size (32-bit), then the sample count: the
  // number of AAC frames, 1024 samples each once decoded.
  const stsz = boxes.get('moov/trak/mdia/minf/stbl/stsz')!;
  const frames = stsz.readUInt32BE(8);
  return { movie: clock(mvhd), media: clock(mdhd), segment, mediaTime, frames };
}

test('every sound is served as audio/mp4, within budget, each loop as long as meta.gen.json says (Ruling E16)', async ({ request }) => {
  const files = ['music', 'sfx'].flatMap((k) =>
    readdirSync(new URL(`../public/audio/${k}`, import.meta.url)).map((f) => `/audio/${k}/${f}`),
  );
  expect(files.length).toBe(15);
  expect(files.sort()).toEqual([...Object.values(TRACKS), ...Object.values(SFX)].map((d) => d.src).sort());
  const meta = JSON.parse(readFileSync(new URL('../src/lib/audio/meta.gen.json', import.meta.url), 'utf-8')) as Record<
    string,
    { samples: number; rate: number; priming: number }
  >;
  const served = new Map<string, Buffer>();
  for (const f of files) {
    const res = await request.get(f);
    expect(res.status(), f).toBe(200);
    expect(res.headers()['content-type'], f).toBe('audio/mp4');
    served.set(f, await res.body());
  }
  // Ruling E17's budget, on the bytes the iPad downloads.
  const bytes = (src: string) => served.get(src)!.length;
  for (const d of Object.values(TRACKS)) expect(bytes(d.src), d.src).toBeLessThanOrEqual(TRACK_MAX_BYTES);
  for (const d of Object.values(SFX)) expect(bytes(d.src), d.src).toBeLessThanOrEqual(SFX_MAX_BYTES);
  expect(Object.values(TRACKS).reduce((n, d) => n + bytes(d.src), 0)).toBeLessThanOrEqual(MUSIC_BUDGET_BYTES);
  expect(Object.values(SFX).reduce((n, d) => n + bytes(d.src), 0)).toBeLessThanOrEqual(SFX_BUDGET_BYTES);
  // Ruling E9: the loop region the runtime plays is meta.gen.json's. The served file must agree:
  // its edit skips exactly the encoder's priming, its track clock is the sample rate, and it holds
  // exactly the priming and the loop's samples (the movie clock rounds the edit to 1 ms).
  for (const [id, d] of Object.entries(TRACKS)) {
    const m = meta[id];
    expect(m, id).toBeDefined();
    const t = loopTiming(served.get(d.src)!);
    expect(t.media.timescale, id).toBe(m.rate);
    expect(t.mediaTime, id).toBe(m.priming);
    expect(t.media.duration - t.mediaTime, id).toBe(m.samples);
    expect(Math.abs((t.segment * m.rate) / t.movie.timescale - m.samples), id).toBeLessThanOrEqual(m.rate / t.movie.timescale);
    // Final review M6: loopRegion (loop.ts) tells a buffer that kept the priming from one that kept
    // only the tail padding by its length, which holds while the padding is shorter than the priming.
    const padding = t.frames * 1024 - m.priming - m.samples;
    expect(padding, id).toBeGreaterThanOrEqual(0);
    expect(padding, id).toBeLessThan(m.priming);
  }
});
