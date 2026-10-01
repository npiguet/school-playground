import { test, expect } from './crashGuard';
import type { APIRequestContext, Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { posix } from 'node:path';
import {
  audioState,
  createFreshHeroApi,
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  expectLineOf,
  expectScene,
  installKeyboardSim,
  nextLine,
  redScan,
  seedPlay,
  setKeyboard,
} from './helpers';

// UI5 audio and dialogue walk (scenes spec §7-§8, §10): iPad-size screenshots of the first-visit
// tours, the greetings, the HUD's sound plate, the lyre's sound rows and the battle's lines,
// <project>-<id>-<name>.jpg, for the Opus playability review ("does anything still look like a school
// form?"). No e2e plays sound (Ruling E10): each shot's note records the mixer's state instead (the
// loop wanted and playing, the ducks), so the review can check each place's loop without a speaker.
//
// Where the shots go - WALK_OUT, a path relative to the repo root (or absolute in the container):
// - unset: web/test-results/walk-ui5, a scratch dir (git-ignored), so a walk run to look at the
//   game never dirties the tracked review baseline:
//     scripts/playwright.sh --config playwright.playability.config.ts playability-ui5
// - docs/reviews/ui5: deliberately refreshes the review baseline (tracked JPEGs and the walk's
//   notes, walk-notes-<project>.md), for a re-review:
//     WALK_OUT=docs/reviews/ui5 scripts/playwright.sh --config playwright.playability.config.ts playability-ui5
// compose.e2e.yaml passes WALK_OUT into the Playwright container.
const OUT = posix.resolve('/work', process.env.WALK_OUT || 'web/test-results/walk-ui5');

// The first-visit tours show (Ruling E10: off in every other spec).
test.use({ tours: true });

// The playability config runs one worker, so fixed names are safe; an earlier walk's copies are
// deleted first (clearEarlierWalk).
const TOUR_HERO = 'Nausicaa-Iris';
const BATTLE_HERO = 'Pénélope-Aurore';
const T_MUSTER = 'Les fées du soir';
const T_RETRY = 'Les fées du soir (II)';
const T_VICTORY = 'Les fées du soir (III)';
const TITLES = [T_MUSTER, T_RETRY, T_VICTORY];
const REF = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const DRAFT = 'Les fées danse dans la clairière. Elles chante et les oiseaux les écoutent.';
// scenes-battle-victory.spec.ts's E14 case: four traps in the draft, one caught, so Éris answers
// and the dragon then explains « dansent », a trap still standing.
const FOUR = 'Les fée danse dans la clairiere. Elles chante et les oiseaux les écoutent.';
const ONE_CAUGHT = 'Les fées danse dans la clairiere. Elles chante et les oiseaux les écoutent.';

type TextKey = 'muster' | 'retry' | 'victory';

async function deleteHeroes(request: APIRequestContext, names: string[]) {
  const profiles = (await (await request.get('/api/profiles')).json()) as { id: number; name: string }[];
  for (const p of profiles.filter((x) => names.includes(x.name))) {
    expect((await request.delete(`/api/profiles/${p.id}`)).status()).toBe(204);
  }
}

async function deleteTexts(request: APIRequestContext, titles: string[]) {
  const texts = (await (await request.get('/api/texts')).json()) as { id: number; title: string }[];
  for (const t of texts.filter((x) => titles.includes(x.title))) {
    expect((await request.delete(`/api/texts/${t.id}`)).status()).toBe(204);
  }
}

async function clearEarlierWalk(request: APIRequestContext) {
  await deleteHeroes(request, [TOUR_HERO, BATTLE_HERO]);
  await deleteTexts(request, TITLES);
}

interface Walk {
  page: Page;
  project: string;
  tourHero: number;
  battleHero: number;
  notes: string[];
  texts: Record<TextKey, number>;
}

// Screenshots wait on real state, never a fixed animation delay (the UI3 walk's rule): fonts and
// images finished, then two animation frames so the state is painted.
async function waitForImagesAndFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => Array.from(document.images).every((img) => img.complete))).toBe(true);
}

async function shot(w: Walk, name: string) {
  // The pointer of the last click rests off the page's controls, so nothing shows its hover tint.
  const size = w.page.viewportSize();
  if (size) await w.page.mouse.move(size.width / 2, size.height - 1);
  await waitForImagesAndFonts(w.page);
  await w.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // JPEG at 85 (UI4 final review M23): the review reads them by eye, where 85 loses nothing.
  await w.page.screenshot({ path: `${OUT}/${w.project}-${name}.jpg`, type: 'jpeg', quality: 85 });
  // What the camp would sound like here (Ruling E10: the recording backend's snapshot).
  const a = await audioState(w.page);
  w.notes.push(
    `${name}: ${a ? `wanted=${a.wanted} playing=${a.playing} ducks=[${a.ducks.join(',')}] unlocked=${a.unlocked} voiceSpeaking=${a.voiceSpeaking}` : 'no mixer'}`,
  );
}

// Overlay.svelte's fly-in registers as Web Animations on the panel itself: drained, it has landed.
async function waitForOverlaySettled(page: Page, testId: string) {
  const panel = page.getByTestId(testId);
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((el) => el.getAnimations().length)).toBe(0);
}

// One tap on `.advance` completes the current line; its name flips to « Suite » once it shows whole.
async function settleDialogue(page: Page) {
  const box = page.getByTestId('dialogue-box');
  await expect(box).toBeVisible();
  const advanceBtn = box.getByTestId('dialogue-advance');
  if ((await advanceBtn.getAttribute('aria-label')) === 'Tout afficher') await advanceBtn.click();
  await expect(advanceBtn).toHaveAccessibleName('Suite');
}

async function noRed(w: Walk, where: string) {
  const red = await redScan(w.page);
  if (red.length) w.notes.push(`RED at ${where}: ${red.join(', ')}`);
  expect(red, where).toEqual([]);
}

/** Nothing but looping decorations (the ring's pulse) still runs under `el`. */
async function finiteAnimationsDone(page: Page, testId: string) {
  await expect
    .poll(() =>
      page.getByTestId(testId).evaluate((el) =>
        el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).length,
      ),
    )
    .toBe(0);
}

/** Walks the open tour line by line until `reached` holds, then shows that line whole and lets the
 *  dimming and the ring move to it. */
async function tourTo(page: Page, reached: () => Promise<boolean>) {
  const tour = page.getByTestId('tour');
  for (let i = 0; i < 20 && !(await reached()); i++) {
    const step = await tour.getAttribute('data-step');
    await nextLine(page);
    await expect.poll(() => tour.getAttribute('data-step')).not.toBe(step);
  }
  expect(await reached(), 'the tour reached its step').toBe(true);
  await settleDialogue(page);
  await finiteAnimationsDone(page, 'tour');
}
const atTarget = (page: Page, target: string) => async () => (await page.getByTestId('tour').getAttribute('data-target')) === target;

/** Walks the tour to its end, then waits until the server holds it as seen (a reload reads it). */
async function finishTour(w: Walk, id: string) {
  const tour = w.page.getByTestId('tour');
  for (let i = 0; i < 20 && (await tour.count()) > 0; i++) await nextLine(w.page);
  await expect(tour).toHaveCount(0);
  await expect
    .poll(async () => ((await (await w.page.request.get(`/api/profiles/${w.tourHero}`)).json()).settings.tours ?? []) as string[])
    .toContain(id);
}

/** A place's tour is open on its first line, the place settled behind it. */
async function openTour(page: Page, path: string, tourId: string, sceneId: string) {
  await page.goto(path);
  await expect(page.getByTestId('tour')).toHaveAttribute('data-tour', tourId);
  await expectScene(page, sceneId);
}

/** The combatants have come in and finished their entry (the muster's taunt and brace included). */
async function combatantsSettled(page: Page) {
  await expect(page.getByTestId('battle-opponent')).toBeVisible();
  await expect(page.getByTestId('battle-dragon')).toBeVisible();
  await finiteAnimationsDone(page, 'battle-scene');
}

/** The reckoning's end poses are held and the victory sheet has come in. */
async function sheetSettled(page: Page) {
  await combatantsSettled(page);
  await finiteAnimationsDone(page, 'victory');
}

async function campSection(w: Walk) {
  const { page } = w;
  const tour = page.getByTestId('tour');
  const box = page.getByTestId('dialogue-box');
  await openTour(page, `/#/p/${w.tourHero}/camp`, 'camp', 'camp');
  await expect(box).toHaveAttribute('data-speaker', 'dragon');
  await expect(tour).toHaveAttribute('data-target', '');
  await tourTo(page, async () => true);
  await shot(w, 'e01-camp-tour-egg');
  await noRed(w, 'camp tour');
  await tourTo(page, atTarget(page, 'parchemins'));
  await shot(w, 'e02-camp-tour-ring-parchemins');
  await tourTo(page, atTarget(page, 'boss'));
  await nextLine(page);
  await tourTo(page, atTarget(page, ''));
  await shot(w, 'e03-camp-tour-last');
  await finishTour(w, 'camp');
  await page.reload();
  await expectCamp(page);
  await expectLineOf(box, 'camp.enter', { hero: TOUR_HERO });
  await settleDialogue(page);
  await shot(w, 'e04-camp-greeting');
  await noRed(w, 'camp greeting');
}

async function placesSection(w: Walk) {
  const { page } = w;
  const box = page.getByTestId('dialogue-box');
  await openTour(page, `/#/p/${w.tourHero}/tente-parchemins`, 'library', 'library');
  await tourTo(page, atTarget(page, 'lens'));
  await shot(w, 'e05-library-tour-lens');
  await noRed(w, 'library tour');
  await openTour(page, `/#/p/${w.tourHero}/temple`, 'delphi', 'delphi');
  await tourTo(page, atTarget(page, 'tablets'));
  await expect(box).toHaveAttribute('data-speaker', 'pythia');
  await shot(w, 'e06-delphi-tour-tablets');
  await openTour(page, `/#/p/${w.tourHero}/tente-de-guerre`, 'war', 'war');
  // UI5 playability #10: the lieutenants' line rings the wall of portraits.
  await tourTo(page, atTarget(page, 'portraits'));
  await shot(w, 'e21-war-tour-portraits');
  await tourTo(page, async () => (await box.getAttribute('data-speaker')) === 'eris');
  await shot(w, 'e07-war-tour-eris');
  await noRed(w, 'war tour');
  await finishTour(w, 'war');
  // The second visit (a greeting is once per page load, Ruling A9): Éris speaks first.
  await page.reload();
  await expectScene(page, 'war');
  await expectLineOf(box, 'war.enter');
  await expect(box).toHaveAttribute('data-speaker', 'eris');
  await settleDialogue(page);
  await shot(w, 'e08-war-greeting');
  await openTour(page, `/#/p/${w.tourHero}/dragon`, 'nest', 'nest');
  await tourTo(page, atTarget(page, 'dragon'));
  await shot(w, 'e09-nest-tour');
  await openTour(page, `/#/p/${w.tourHero}/cabane`, 'cabin', 'cabin');
  await tourTo(page, atTarget(page, 'lyre'));
  await shot(w, 'e10-cabin-tour-lyre');
  await noRed(w, 'cabin tour');
}

async function soundSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.tourHero}/camp`);
  await expectCamp(page);
  // The greeting shows its line whole first (the plate opens over a camp at rest).
  await settleDialogue(page);
  await page.getByTestId('hud-mute').click();
  const plate = page.getByTestId('hud-sound');
  await expect(plate).toBeVisible();
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/api/profiles/${w.tourHero}`));
  await plate.getByTestId('hud-sound-music').click();
  await saved;
  await expect(plate.getByTestId('hud-sound-music')).toHaveAttribute('aria-pressed', 'false');
  await shot(w, 'e11-hud-sound-plate');
  await noRed(w, 'sound plate');
  // The lyre: the music comes back from its row, the voice goes to « Sourdine ».
  await page.goto(`/#/p/${w.tourHero}/settings`);
  await waitForOverlaySettled(page, 'overlay-lyre');
  const lyre = page.getByTestId('overlay-lyre');
  // UI5 playability #17, #18: the egg's line at the top of the lyre, in the places' parchment box.
  await expect(lyre.getByTestId('overlay-voice')).toContainText('Règle ici la musique, les bruitages et la voix');
  await shot(w, 'e22-lyre-egg');
  await lyre.getByTestId('lyre-mute-music').click();
  await expect(lyre.getByTestId('lyre-mute-music')).toHaveAttribute('aria-pressed', 'false');
  await lyre.getByTestId('lyre-mute-voice').click();
  await expect(lyre.getByTestId('lyre-voice-muted')).toBeVisible();
  await lyre.getByRole('heading', { name: 'Les sons du camp' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await shot(w, 'e12-lyre-sounds');
  await noRed(w, 'lyre');
  await lyre.getByTestId('lyre-credits').locator('summary').click();
  await expect(lyre.getByTestId('lyre-credits')).toHaveAttribute('open', '');
  // UI5 playability #16: the seal, « Enregistrer » in its own row, then the tours past a line.
  await lyre.getByRole('heading', { name: 'Ton sceau' }).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await shot(w, 'e13-lyre-tours');
  // The voice back, for whoever looks at the walk's hero afterwards.
  await lyre.getByTestId('lyre-mute-voice').click();
  await expect(lyre.getByTestId('lyre-voice-muted')).toHaveCount(0);
}

async function battleSection(w: Walk) {
  const { page } = w;
  const voice = page.getByTestId('battle-voice');
  // A free text faces Éris herself only when no lieutenant is awake (opponentFor): the camp's answer
  // is intercepted so the muster is hers (battle.start), not a lieutenant's dossier line.
  await page.route('**/api/profiles/*/camp', async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.lieutenants = json.lieutenants.map((l: object) => ({ ...l, available: false }));
    await route.fulfill({ response: res, json });
  });
  w.notes.push('battle: /camp intercepted, no lieutenant awake, so the free text is Éris against the dragon');
  await page.goto(`/#/p/${w.battleHero}/play/${w.texts.muster}`);
  await expectBattle(page, 'muster');
  await combatantsSettled(page);
  // Spec 2026-09-29 explanations §2 (R11): the first dictation muster is the dragon's tour, on the
  // plate where Éris's line stands; skipped here, her line comes back (scenes-muster-tour.spec.ts
  // walks it).
  await expect(page.getByTestId('muster-tour')).toBeVisible();
  await shot(w, 'e14-muster-tour');
  await page.getByTestId('muster-tour-skip').click();
  await expect(page.getByTestId('muster-tour')).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get(`/api/profiles/${w.battleHero}`)).json()).settings.tours ?? []).toContain('muster');
  await expectLineOf(voice, 'battle.start');
  await shot(w, 'e14-muster-eris-start');
  await noRed(w, 'muster');
  // The voice muted on the hero (the lyre's toggle), read at the next load.
  const muted = await page.request.patch(`/api/profiles/${w.battleHero}`, {
    data: { settings: { audio: { music: { volume: 0.5, muted: false }, sfx: { volume: 0.7, muted: false }, voice: { volume: 1, muted: true } } } },
  });
  expect(muted.ok()).toBeTruthy();
  await page.reload();
  await expectBattle(page, 'muster');
  await combatantsSettled(page);
  await expect(page.getByTestId('battle-voice-muted')).toBeVisible();
  await shot(w, 'e15-muster-voice-muted');
  await page.getByTestId('battle-voice-unmute').click();
  await expect(page.getByTestId('battle-voice-muted')).toHaveCount(0);
  // « Rejouer ce texte » from a won battle: Éris's retry line.
  await page.goto(`/#/p/${w.battleHero}/play/${w.texts.retry}`);
  await expectBattle(page, 'victory');
  await page.getByTestId('victory-actions').getByRole('button', { name: 'Rejouer ce texte' }).click();
  await expectBattle(page, 'muster');
  await combatantsSettled(page);
  await expectLineOf(voice, 'battle.retry');
  await shot(w, 'e16-muster-retry');
  // The victory's dialogue: Éris, the dragon's tally, a trap still standing, its explanation.
  await page.goto(`/#/p/${w.battleHero}/play/${w.texts.victory}`);
  await expectBattle(page, 'victory');
  await sheetSettled(page);
  await page.getByTestId('reveal-continue').click();
  const dialogue = page.getByTestId('victory-dialogue');
  await expect(dialogue.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'eris');
  await settleDialogue(page);
  await shot(w, 'e17-victory-eris');
  await noRed(w, 'victory dialogue');
  await nextLine(page);
  await nextLine(page);
  await expectLineOf(dialogue.getByTestId('dialogue-box'), 'battle.explain', { word: 'dansent' });
  await settleDialogue(page);
  await shot(w, 'e18-victory-explain');
  await nextLine(page);
  await expect(dialogue.getByTestId('dialogue-box')).not.toHaveAttribute('data-key', /./);
  await settleDialogue(page);
  await shot(w, 'e19-victory-explanation');
  // The compact band (a simulated keyboard): the HUD folds into it, the plate hangs below it.
  await page.goto(`/#/p/${w.battleHero}/play/${w.texts.muster}`);
  await expectBattle(page, 'muster');
  await combatantsSettled(page);
  await setKeyboard(page, 400);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  const band = page.getByTestId('band-hud');
  await band.getByTestId('hud-mute').click();
  await expect(page.getByTestId('hud-sound')).toBeVisible();
  await shot(w, 'e20-band-sound-plate');
  await noRed(w, 'band plate');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('hud-sound')).toHaveCount(0);
  await setKeyboard(page, 0);
  await page.unrouteAll({ behavior: 'wait' });
}

const SECTIONS: { name: string; run: (w: Walk) => Promise<void> }[] = [
  { name: 'camp', run: campSection },
  { name: 'places', run: placesSection },
  { name: 'sound', run: soundSection },
  { name: 'battle', run: battleSection },
];

test('UI5 audio and dialogue walk', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const project = testInfo.project.name;
  const w: Walk = { page, project, tourHero: 0, battleHero: 0, notes: [], texts: {} as Record<TextKey, number> };
  const origins = new Set<string>();
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
  });
  await installKeyboardSim(page);
  // Leftovers of an earlier run that failed (or was killed) before its cleanup.
  await clearEarlierWalk(page.request);
  try {
    w.tourHero = await createFreshHeroApi(page.request, TOUR_HERO, '10H');
    if (project === 'ipad-portrait') {
      // The shots are landscape (the game asks to turn the iPad): here only the rotate screen, over
      // a camp whose tour waits for it.
      await page.goto(`/#/p/${w.tourHero}/camp`);
      await expect(page.getByTestId('rotate-screen')).toBeVisible();
      w.notes.push('portrait: the rotate screen shows over the camp (no shot; the UI3 walk has it)');
      return;
    }
    w.battleHero = await createProfileApi(page.request, BATTLE_HERO, '10H');
    const body: Record<TextKey, string> = { muster: T_MUSTER, retry: T_RETRY, victory: T_VICTORY };
    for (const [key, title] of Object.entries(body) as [TextKey, string][]) {
      w.texts[key] = (await createText(page.request, { title, body: REF, level: '10H' })).id;
    }
    // Seeded before the first load: later hops are hash changes, which never rerun an init script.
    const pid = w.battleHero;
    await seedPlay(page, { profileId: pid, textId: w.texts.retry, phase: 'results', draft: DRAFT, current: REF, opponent: 'hydre' });
    await seedPlay(page, { profileId: pid, textId: w.texts.victory, phase: 'results', draft: FOUR, current: ONE_CAUGHT, opponent: 'hydre' });
    for (const s of SECTIONS) {
      w.notes.push(`section ${s.name}`);
      await s.run(w);
    }
  } finally {
    // The walk's texts leave with it, even when a section failed; the heroes stay for a look until
    // the next walk clears them. A failed delete is noted, never allowed to hide the walk's failure.
    try {
      await deleteTexts(page.request, TITLES);
    } catch (e) {
      w.notes.push(`cleanup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    w.notes.push(`request origins: ${JSON.stringify([...origins])}`);
    const text = `# UI5 walk notes (${project})\n\nWritten by web/e2e/playability-ui5.spec.ts: one line per shot with the mixer's state (Ruling E10), any RED, the request origins.\n\n${w.notes.map((n) => `- ${n}`).join('\n')}\n`;
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/walk-notes-${project}.md`, text);
    console.log(`\n===== NOTES ${project} =====\n${w.notes.join('\n')}\n`);
  }
  // Spec §2.7: no runtime third-party request (fonts, CDNs...).
  expect([...origins]).toEqual([new URL(String(testInfo.project.use.baseURL)).origin]);
});
