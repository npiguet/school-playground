import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { test, expect } from './crashGuard';
import {
  audioState,
  closeOverlay,
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  expectMusic,
  expectScene,
  heroNamer,
  resumeSeeded,
  seedPlay,
  spokenVolumes,
  stubSpeech,
  tap,
  uniqueName,
} from './helpers';
import { frenchSpacing } from '../src/lib/text/french';

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
  await expectMusic(page, 'lair');
});

test('the battle loop ducks through the dictation and the proofreading, and the camp comes back clear (Ruling E5)', async ({ page, request }, testInfo) => {
  await stubSpeech(page);
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
  await tap(opener, testInfo);
  const plate = page.getByTestId('hud-sound');
  await expect(plate).toBeVisible();
  await expect(opener).toHaveAttribute('aria-expanded', 'true');
  for (const ch of ['music', 'sfx', 'voice']) await expect(plate.getByTestId(`hud-sound-${ch}`)).toHaveAttribute('aria-pressed', 'true');
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes(`/api/profiles/${id}`));
  await tap(plate.getByTestId('hud-sound-music'), testInfo);
  await saved;
  await expect(plate.getByTestId('hud-sound-music')).toHaveAttribute('aria-pressed', 'false');
  expect((await audioState(page))!.settings.music.muted).toBe(true);
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
  await stubSpeech(page);
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
  await expect(lyre.locator('input[type="checkbox"]')).toHaveCount(0);
  await closeOverlay(page);
});

// Review #11: the voice channel reaches a real dictation line; muted, nothing is spoken (Ruling E7b:
// iOS ignores an utterance's volume) and the dictation goes on at its pace.
async function dictationWithVoice(page: Page, request: APIRequestContext, testInfo: TestInfo, voice: { volume: number; muted: boolean }) {
  await stubSpeech(page);
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const res = await request.patch(`/api/profiles/${id}`, {
    data: { settings: { audio: { music: { volume: 0.5, muted: false }, sfx: { volume: 0.7, muted: false }, voice } } },
  });
  expect(res.ok()).toBeTruthy();
  const body = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
  const text = await createText(request, { title: uniqueName('Voix'), body, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await tap(sheet.getByTestId('pace-option-1'), testInfo);
  await tap(sheet.getByRole('button', { name: 'Commencer la dictée' }), testInfo);
  await expectBattle(page, 'dictation');
  return { id, textId: text.id as number };
}
/** The non-empty lines the stubbed speechSynthesis was asked to say, with their volume. */
const said = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __spoken: string[]; __spokenVolumes: number[] };
    return w.__spoken.map((text, i) => ({ text, volume: w.__spokenVolumes[i] })).filter((l) => l.text.trim() !== '');
  });

test('a dictation line is spoken at the voice volume, with the music down under it (Ruling E5)', async ({ page, request }, testInfo) => {
  await dictationWithVoice(page, request, testInfo, { volume: 0.4, muted: false });
  await expect.poll(async () => (await said(page)).length).toBeGreaterThan(0);
  const first = (await said(page))[0];
  expect(first.text).toContain('Les fées dansent');
  expect(first.volume).toBe(0.4);
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.");
  await expect.poll(async () => (await audioState(page))?.ducks).toEqual(['dictation']);
});

test('a muted voice says nothing, and the dictation still goes on at its pace (Ruling E7b)', async ({ page, request }, testInfo) => {
  const { id, textId } = await dictationWithVoice(page, request, testInfo, { volume: 1, muted: true });
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.");
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await tap(page.getByTestId('btn-next'), testInfo);
  const key = `discorde.play.${id}.${textId}`;
  await expect.poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').dictationStep, key)).toBe(2);
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.");
  expect(await said(page)).toEqual([]);
  expect((await audioState(page))!.voiceSpeaking).toBe(false);
});
