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
  await page.goto('/');
  await expectScene(page, 'title');
  await expect.poll(async () => (await audioState(page))?.wanted).toBe('sea');
  expect(await audioState(page)).toMatchObject({ unlocked: false, playing: null, sfx: [] });
  await tap(page.getByTestId('title-gate'), testInfo);
  await expectMusic(page, 'sea');
  // The gate's chime rings once its press has played out (the hotspot's activation), after the unlock.
  await expect.poll(async () => (await audioState(page))?.sfx).toContain('chime');
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
  await tap(page.getByTestId('hud-mute'), testInfo);
  await tap(page.getByTestId('hud-sound-lyre'), testInfo);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByTestId('hud-sound')).toHaveCount(0);
  await expect(page.getByTestId('lyre-mute-music')).toHaveAttribute('aria-pressed', 'true');
});

test('the lyre sets each channel; the voice reaches the dictation at its volume, and says when it is muted (Ruling E7)', async ({ page, request }, testInfo) => {
  await stubSpeech(page);
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/settings`);
  const lyre = page.getByTestId('overlay-lyre');
  const slider = lyre.getByTestId('lyre-volume-voice');
  await expect(slider).toHaveAttribute('aria-label', 'Volume de la voix');
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('40');
  await expect.poll(async () => (await audioState(page))?.settings.voice.volume).toBe(0.4);
  await lyre.getByRole('button', { name: 'Écouter un essai' }).click();
  await expect.poll(async () => (await spokenVolumes(page)).at(-1)).toBe(0.4);
  await expect(lyre.getByTestId('lyre-voice-muted')).toHaveCount(0);
  await lyre.getByTestId('lyre-mute-voice').click();
  await expect(lyre.getByTestId('lyre-mute-voice')).toHaveAttribute('aria-pressed', 'true');
  await expect(lyre.getByTestId('lyre-voice-muted')).toHaveText(frenchSpacing(MUTED_VOICE_NOTE));
  await expect(lyre.locator('input[type="checkbox"]')).toHaveCount(0);
  await closeOverlay(page);
});
