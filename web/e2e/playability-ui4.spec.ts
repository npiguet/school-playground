import { test, expect } from './crashGuard';
import type { APIRequestContext, Page } from '@playwright/test';
import { posix } from 'node:path';
import {
  closeOverlay,
  createProfileApi,
  createText,
  expectBattle,
  installKeyboardSim,
  makeResult,
  postSession,
  redScan,
  resumeSeeded,
  seedPlay,
  setKeyboard,
  stubSpeech,
} from './helpers';

// UI4 battle walk (scenes spec §10): iPad-size screenshots of the battle stage in every phase and
// layout, <project>-<id>-<name>.png, for the Opus playability review ("does anything still look like
// a school form?") and the legibility check of a long proofreading text. It also shows the dragon at
// each of its stages facing its opponent (FACES, Ruling C10) and Éris's two boss poses.
//
// Where the shots go - WALK_OUT, a path relative to the repo root (or absolute in the container):
// - unset: web/test-results/walk-ui4, a scratch dir (git-ignored), so a walk run to look at the
//   battle never dirties the tracked review baseline:
//     scripts/playwright.sh --config playwright.playability.config.ts playability-ui4
// - docs/reviews/ui4: deliberately refreshes the review baseline (tracked PNGs), for a re-review:
//     WALK_OUT=docs/reviews/ui4 scripts/playwright.sh --config playwright.playability.config.ts playability-ui4
// compose.e2e.yaml passes WALK_OUT into the Playwright container.
const OUT = posix.resolve('/work', process.env.WALK_OUT || 'web/test-results/walk-ui4');

// The playability config runs one worker, so fixed names are safe; an earlier walk's copies are
// deleted first (clearEarlierWalk).
const BATTLE_HERO = 'Pénélope-Aurore';
const T_SHORT = 'Le chant des fées';
const T_LONG = 'La nuit des fées';
const T_GRIMOIRE = "Le grimoire d'Ulysse";
const T_ROUT = 'Le chant des fées (II)';
const T_STANDOFF = 'Le chant des fées (III)';
const T_BOSS_WON = 'Le chant des fées (IV)';
const T_BOSS_LOST = 'Le chant des fées (V)';
const TITLES = [T_SHORT, T_LONG, T_GRIMOIRE, T_ROUT, T_STANDOFF, T_BOSS_WON, T_BOSS_LOST];
const SHORT = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const SHORT_HALF = 'Les fées dansent dans la clairière. Elles chante et les oiseaux les écoutent.';
const SHORT_DRAFT = 'Les fées danse dans la clairière. Elles chante et les oiseaux les écoutent.';
// ~300 words, two planted errors (scenes-battle-play.spec.ts's LONG_REF / LONG_DRAFT).
const SENTENCES = [
  'Les fées dansent dans la clairière pendant que la lune se lève.',
  'Elles chantent doucement et les oiseaux les écoutent sans bruit.',
  'Le vent emporte leurs chansons jusqu’au village endormi.',
  'Les enfants sortent de leurs maisons, émerveillés par la musique.',
  'La nuit est douce et les étoiles brillent au-dessus des arbres.',
];
const LONG_REF = Array.from({ length: 24 }, (_, i) => SENTENCES[i % SENTENCES.length]).join(' ');
const LONG_DRAFT = LONG_REF.replace('Les fées dansent', 'Les fées danse').replace(/La nuit est douce(?![\s\S]*La nuit est douce)/, 'La nuit et douce');

type TextKey = 'short' | 'long' | 'grimoire' | 'rout' | 'standoff' | 'bossWon' | 'bossLost';

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
  await deleteHeroes(request, [BATTLE_HERO]);
  await deleteTexts(request, TITLES);
}

interface Walk {
  page: Page;
  project: string;
  profileId: number;
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
  // The pointer of the last click rests off the page's controls, so no word shows its hover tint.
  const size = w.page.viewportSize();
  if (size) await w.page.mouse.move(size.width / 2, size.height - 1);
  await waitForImagesAndFonts(w.page);
  await w.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await w.page.screenshot({ path: `${OUT}/${w.project}-${name}.png` });
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
  if ((await box.count()) === 0) return;
  const advanceBtn = box.getByTestId('dialogue-advance');
  if ((await advanceBtn.getAttribute('aria-label')) === 'Tout afficher') await advanceBtn.click();
  await expect(advanceBtn).toHaveAccessibleName('Suite');
}

async function noRed(w: Walk, where: string) {
  const red = await redScan(w.page);
  if (red.length) w.notes.push(`RED at ${where}: ${red.join(', ')}`);
  expect(red, where).toEqual([]);
}

/** The combatants have come in and finished their entry (the muster's taunt and brace included). */
async function combatantsSettled(page: Page) {
  await expect(page.getByTestId('battle-opponent')).toBeVisible();
  await expect(page.getByTestId('battle-dragon')).toBeVisible();
  await expect
    .poll(() =>
      page.getByTestId('battle-scene').evaluate((el) =>
        el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).length,
      ),
    )
    .toBe(0);
}

/** The reckoning's end poses are held and the victory sheet has come in: nothing but looping
 *  decorations still runs on the stage or the sheet. */
async function sheetSettled(page: Page) {
  await combatantsSettled(page);
  await expect
    .poll(() =>
      page.getByTestId('victory').evaluate((el) =>
        el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).length,
      ),
    )
    .toBe(0);
}

/** Which way each combatant looks on screen: the art's own facing, flipped by `.mirror`. */
async function facing(page: Page) {
  return page.evaluate(() => {
    const look = (id: string) => {
      const el = document.querySelector(`[data-testid="${id}"] .facing`);
      return el ? getComputedStyle(el).transform : null;
    };
    return { dragon: look('battle-dragon'), opponent: look('battle-opponent') };
  });
}

async function musterSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.short}?encounter=hydre`);
  await expectBattle(page, 'muster');
  await combatantsSettled(page);
  await shot(w, 'c01-muster-hydre-river');
  await noRed(w, 'muster');
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.long}?encounter=sirenes&quest=1`);
  await expectBattle(page, 'muster');
  await combatantsSettled(page);
  await shot(w, 'c02-muster-sirenes-coast-quest');
  await page.goto(`/#/p/${w.profileId}/grimoire/${w.texts.grimoire}`);
  await expectBattle(page, 'muster');
  await combatantsSettled(page);
  await shot(w, 'c03-muster-grimoire-temple');
}

async function dictationSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.short}?encounter=lethe`);
  await expectBattle(page, 'muster');
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expectBattle(page, 'dictation');
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await page.getByTestId('dictation-textarea').fill('Les fées danse dans la clairière.');
  await shot(w, 'c04-dictation-lethe');
  await noRed(w, 'dictation');
  await page.getByTestId('dictation-textarea').click();
  await setKeyboard(page, 400);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await shot(w, 'c05-dictation-compact-keyboard');
  await setKeyboard(page, 0);
}

async function proofSection(w: Walk) {
  const { page } = w;
  for (const [help, name] of [
    [1, 'c06-proof-stage1-argus-long'],
    [3, 'c07-proof-stage3-notched-hold'],
  ] as const) {
    await page.goto(`/#/p/${w.profileId}/play/${w.texts.long}?help=${help}&encounter=chimere`);
    await expectBattle(page);
    if (await page.getByTestId('battle-resume').count()) await resumeSeeded(page);
    await expectBattle(page, 'proofreading');
    await shot(w, name);
    await noRed(w, name);
  }
  await page.getByTestId('btn-fil').click();
  await page.getByTestId('tok-2').click();
  await shot(w, 'c08-proof-fil');
  await page.getByTestId('btn-fil-exit').click();
  await page.getByTestId('btn-bouclier').click();
  await shot(w, 'c09-proof-bouclier');
  await page.getByTestId('btn-bouclier').click();
  const tokens = page.locator('[data-testid^="tok-"]');
  const near = tokens.nth((await tokens.count()) - 4);
  await near.scrollIntoViewIfNeeded();
  await near.click();
  await setKeyboard(page, 400);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await shot(w, 'c10-proof-compact-editing');
  await page.getByTestId('word-editor').press('Escape');
  await setKeyboard(page, 0);
}

async function victorySection(w: Walk) {
  const { page } = w;
  // A lived-in victory: two days of the Hydra already foiled, so today's live session can neutralise it.
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.short}?encounter=hydre`);
  await expectBattle(page, 'muster');
  await page.getByTestId('pace-option-1').click();
  await page.getByRole('button', { name: 'Commencer la dictée' }).click();
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await page.getByTestId('dictation-textarea').fill('Les fées danse dans la clairière.');
  await page.getByTestId('btn-next').click();
  await expect(page.getByTestId('btn-finish-writing')).toBeVisible();
  await page.getByTestId('dictation-textarea').fill(SHORT_DRAFT);
  await page.getByTestId('btn-finish-writing').click();
  await expectBattle(page, 'proofreading');
  const danse = page.locator('[data-testid^="tok-"]', { hasText: /^danse$/ });
  await danse.click();
  await page.getByTestId('word-editor').fill('dansent');
  await page.getByTestId('word-editor').press('Enter');
  await page.getByTestId('btn-done-proofreading').click();
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  if (await confirm.isVisible()) await confirm.click();
  await expectBattle(page, 'victory');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', /retreat|defeat/);
  await expect(page.getByTestId('reveal-xp')).toBeVisible();
  if ((await page.locator('[data-testid^="reveal-neutralised-"]').count()) === 0) {
    w.notes.push('c11/c12: the Hydra is not neutralised by this session (the server wants more); the spoils show without it');
  }
  await sheetSettled(page);
  await shot(w, 'c11-victory-reckoning-and-spoils');
  await noRed(w, 'victory');
  await page.getByTestId('victory').locator('.sheet-body').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await shot(w, 'c12-victory-spoils-end');
  await page.getByTestId('reveal-continue').click();
  await settleDialogue(page);
  await shot(w, 'c13-victory-eris-speaks');
  await page.getByTestId('dialogue-advance').click();
  await settleDialogue(page);
  await shot(w, 'c14-victory-dragon-speaks');
  await page.getByTestId('battle-revoir').click();
  await waitForOverlaySettled(page, 'overlay-revoir');
  await page.getByTestId('overlay-revoir').getByRole('button', { name: 'chante', exact: true }).click();
  await shot(w, 'c15-revoir-scroll');
  await noRed(w, 'revoir');
  await closeOverlay(page);
  // A rout and a standoff, from seeded states (a second and third text).
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.rout}`);
  await expectBattle(page, 'victory');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'defeat');
  await sheetSettled(page);
  await shot(w, 'c16-victory-rout');
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.standoff}`);
  await expectBattle(page, 'victory');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'taunt');
  await sheetSettled(page);
  await shot(w, 'c17-victory-standoff');
}

async function bossSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/eris`);
  await expectBattle(page, 'muster');
  await combatantsSettled(page);
  await shot(w, 'c18-boss-lair');
  await noRed(w, 'lair');
  // Éris's two boss poses. The walk's hero has no boss quest, so the server's verdict is intercepted:
  // the real session is posted, and its progression answers « won » or « lost » at tier I.
  for (const [key, won, pose, name] of [
    ['bossWon', true, 'defeat', 'c18b-boss-won'],
    ['bossLost', false, 'retreat', 'c18c-boss-lost'],
  ] as const) {
    await page.route('**/api/sessions', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const res = await route.fetch();
      const json = await res.json();
      json.progression.boss = { tier: 1, won, too_easy: false };
      if (won) json.progression.rewards = [...json.progression.rewards, { id: 'sandales_hermes', kind: 'gear', name: "Sandales d'Hermès" }];
      await route.fulfill({ response: res, json });
    });
    await page.goto(`/#/p/${w.profileId}/play/${w.texts[key]}?encounter=eris`);
    await expectBattle(page, 'victory');
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-backdrop', 'lair');
    await expect(page.getByTestId('reveal-boss')).toBeVisible();
    await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', pose);
    await combatantsSettled(page);
    await sheetSettled(page);
    await shot(w, name);
    await noRed(w, name);
    await page.unrouteAll({ behavior: 'wait' });
  }
}

// FACES (Ruling C10): the dragon at each stage faces its opponent. The camp's answer is intercepted
// to set the stage; each stage meets another opponent on its own ground.
async function facesSection(w: Walk) {
  const { page } = w;
  for (const [stage, encounter, name] of [
    ['egg', 'protee', 'c24-faces-egg-protee'],
    ['hatchling', 'chimere', 'c25-faces-hatchling-chimere'],
    ['young', 'echo', 'c26-faces-young-echo'],
    ['adult', 'eris', 'c27-faces-adult-eris'],
  ] as const) {
    await page.route('**/api/profiles/*/camp', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.dragon = { ...json.dragon, stage };
      await route.fulfill({ response: res, json });
    });
    await page.goto(`/#/p/${w.profileId}/play/${w.texts.grimoire}?encounter=${encounter}`);
    await page.reload();
    await expectBattle(page, 'muster');
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-opponent', encounter);
    await combatantsSettled(page);
    w.notes.push(`faces ${stage} vs ${encounter}: ${JSON.stringify(await facing(page))}`);
    await shot(w, name);
    await page.unrouteAll({ behavior: 'wait' });
  }
}

async function nudgeSection(w: Walk) {
  const { page } = w;
  // The break nudge on a victory sheet: 26 minutes of play already on the clock (read at page load).
  await page.addInitScript(
    (seed) => sessionStorage.setItem(seed.key, seed.value),
    { key: 'discorde.playClock', value: JSON.stringify({ activeMs: 26 * 60000, running: false, lastTick: null, lastStop: Date.now() }) },
  );
  await page.goto(`/#/p/${w.profileId}/play/${w.texts.rout}`);
  await page.reload();
  await expectBattle(page, 'victory');
  await expect(page.getByTestId('break-nudge')).toBeVisible();
  // The reckoning has ended (the title names the outcome) and the sheet has come in.
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'defeat');
  await expect(page.getByTestId('victory-title')).toHaveText('Victoire !');
  await sheetSettled(page);
  await shot(w, 'c19-victory-break-nudge');
}

async function wideSection(w: Walk) {
  const { page } = w;
  for (const [size, name] of [
    [{ width: 1440, height: 900 }, 'c20-laptop-1440x900-proof'],
    [{ width: 2560, height: 1080 }, 'c21-ultrawide-2560x1080-proof'],
    [{ width: 1180, height: 480 }, 'c22-short-window-compact-proof'],
  ] as const) {
    await page.setViewportSize(size);
    await page.goto(`/#/p/${w.profileId}/play/${w.texts.long}?help=4`);
    await expectBattle(page);
    if (await page.getByTestId('battle-resume').count()) await resumeSeeded(page);
    await expectBattle(page, 'proofreading');
    await shot(w, name);
  }
  await page.setViewportSize({ width: 1180, height: 820 });
}

const SECTIONS: { name: string; run: (w: Walk) => Promise<void> }[] = [
  { name: 'muster', run: musterSection },
  { name: 'dictation', run: dictationSection },
  { name: 'proofreading', run: proofSection },
  { name: 'victory', run: victorySection },
  { name: 'boss', run: bossSection },
  { name: 'faces', run: facesSection },
  { name: 'wide', run: wideSection },
  // Last: its clock seed is read at every later page load.
  { name: 'nudge', run: nudgeSection },
];

const isoDay = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

test('UI4 battle walk', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const project = testInfo.project.name;
  const w: Walk = { page, project, profileId: 0, notes: [], texts: {} as Record<TextKey, number> };
  const origins = new Set<string>();
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
  });
  await installKeyboardSim(page);
  await stubSpeech(page);
  // Leftovers of an earlier run that failed (or was killed) before its cleanup.
  await clearEarlierWalk(page.request);
  try {
    w.profileId = await createProfileApi(page.request, BATTLE_HERO, '10H');
    if (project === 'ipad-portrait') {
      await page.goto(`/#/p/${w.profileId}/eris`);
      await expect(page.getByTestId('rotate-screen')).toBeVisible();
      // The still shows the tablet mid-turn: paused at 60 % of its 2.4 s turn (the UI3 walk's c01).
      await page.locator('.rotate-icon').evaluate((e) => {
        const a = e.getAnimations()[0];
        a.pause();
        a.currentTime = 0.6 * 2400;
      });
      await shot(w, 'c23-rotate-battle');
      return;
    }
    const body: Record<TextKey, [string, string]> = {
      short: [T_SHORT, SHORT],
      long: [T_LONG, LONG_REF],
      grimoire: [T_GRIMOIRE, SHORT],
      rout: [T_ROUT, SHORT],
      standoff: [T_STANDOFF, SHORT],
      bossWon: [T_BOSS_WON, SHORT],
      bossLost: [T_BOSS_LOST, SHORT],
    };
    for (const [key, [title, text]] of Object.entries(body) as [TextKey, [string, string]][]) {
      w.texts[key] = (await createText(page.request, { title, body: text, level: '10H' })).id;
    }
    const pid = w.profileId;
    await seedPlay(page, { profileId: pid, textId: w.texts.long, phase: 'proofreading', draft: LONG_DRAFT, opponent: 'chimere' });
    await seedPlay(page, { profileId: pid, textId: w.texts.rout, phase: 'results', draft: SHORT_DRAFT, current: SHORT, opponent: 'protee' });
    await seedPlay(page, { profileId: pid, textId: w.texts.standoff, phase: 'results', draft: SHORT_DRAFT, current: SHORT_DRAFT, opponent: 'echo' });
    await seedPlay(page, { profileId: pid, textId: w.texts.bossWon, phase: 'results', draft: SHORT_DRAFT, current: SHORT, opponent: 'eris' });
    await seedPlay(page, { profileId: pid, textId: w.texts.bossLost, phase: 'results', draft: SHORT_DRAFT, current: SHORT_HALF, opponent: 'eris' });
    for (const day of [isoDay(2), isoDay(1)]) {
      await postSession(page.request, { profileId: pid, textId: w.texts.rout, day, result: makeResult({ draft: 5, caught: 5, category: 'agreement:verb' }) });
    }
    for (const s of SECTIONS) {
      w.notes.push(`section ${s.name}`);
      await s.run(w);
    }
  } finally {
    // The walk's texts leave with it, even when a section failed; the hero stays for a look until
    // the next walk clears it. A failed delete is noted, never allowed to hide the walk's own failure.
    try {
      await deleteTexts(page.request, TITLES);
    } catch (e) {
      w.notes.push(`cleanup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    w.notes.push(`request origins: ${JSON.stringify([...origins])}`);
    console.log(`\n===== NOTES ${project} =====\n${w.notes.join('\n')}\n`);
  }
  // Spec §2.7: no runtime third-party request (fonts, CDNs...).
  expect([...origins]).toEqual([new URL(String(testInfo.project.use.baseURL)).origin]);
});
