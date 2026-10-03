import { test, expect } from './crashGuard';
import type { APIRequestContext, Page } from '@playwright/test';
import { posix } from 'node:path';
import {
  closeOverlay,
  createProfileApi,
  createText,
  expectBattle,
  installFastPauses,
  installKeyboardSim,
  makeResult,
  postSession,
  swissDay,
  redScan,
  resumeSeeded,
  seedPlay,
  setSavedAids,
  setKeyboard,
} from './helpers';

// UI4 battle walk (scenes spec §10): iPad-size screenshots of the battle stage in every phase and
// layout, <project>-<id>-<name>.jpg, for the Opus playability review ("does anything still look like
// a school form?") and the legibility check of a long proofreading text. It also shows the dragon at
// each of its stages facing its opponent (FACES, Ruling C10) and Éris's two boss poses.
//
// Where the shots go - WALK_OUT, a path relative to the repo root (or absolute in the container):
// - unset: web/test-results/walk-ui4, a scratch dir (git-ignored), so a walk run to look at the
//   battle never dirties the tracked review baseline:
//     scripts/playwright.sh --config playwright.playability.config.ts playability-ui4
// - docs/reviews/ui4: deliberately refreshes the review baseline (tracked JPEGs; the Task 8 PNGs are
//   the first baseline's, `git rm` them when the baseline is refreshed), for a re-review:
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
// The faces' musters are dictations: a dictation's own title (the playability review's open item 6).
const T_FACES = 'La ronde des fées';
const TITLES = [T_SHORT, T_LONG, T_GRIMOIRE, T_ROUT, T_STANDOFF, T_BOSS_WON, T_BOSS_LOST, T_FACES];
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

type TextKey = 'short' | 'long' | 'grimoire' | 'rout' | 'standoff' | 'bossWon' | 'bossLost' | 'faces';

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
  // JPEG at 85 (final review M23): a walk's ~30 shots weighed ~24 MB as PNG in git; the review reads
  // them by eye, where 85 loses nothing it looks for.
  await w.page.screenshot({ path: `${OUT}/${w.project}-${name}.jpg`, type: 'jpeg', quality: 85 });
}

// Overlay.svelte's fly-in registers as Web Animations on the panel itself: drained, it has landed.
async function waitForOverlaySettled(page: Page, testId: string) {
  const panel = page.getByTestId(testId);
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((el) => el.getAnimations().length)).toBe(0);
}

// One tap on `.advance` completes the current line; its name flips to « Suite » once it shows whole.
async function settleDialogue(page: Page) {
  // Every caller has just opened a dialogue: wait for it, never sample the page once (UI4 wave B).
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
  // Spec 2026-09-29 §3: the same seeded proofreading, re-opened with Argus's passes, then with
  // Palamède's count (Argus left at the camp).
  for (const [aids, name] of [
    [['argus', 'ariane', 'persee', 'athena'], 'c06-proof-argus-long'],
    [['ariane', 'persee', 'athena', 'palamede'], 'c07-proof-palamede-notched-hold'],
  ] as const) {
    await setSavedAids(page, w.profileId, w.texts.long, [...aids]);
    await page.goto(`/#/p/${w.profileId}/play/${w.texts.long}?encounter=chimere`);
    await expectBattle(page, 'muster');
    // The seeded proofreading waits behind the resume ribbon each time (it saves itself as it goes);
    // never sampled once (final review M16).
    await resumeSeeded(page);
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
  // A lived-in victory: two days of the Hydra already foiled, so today's live session can win its wooden seal.
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
  // Wait for whichever comes, the confirm or the victory, never sample it once (final review M16).
  const confirm = page.getByRole('button', { name: 'Oui, valider' });
  await expect(confirm.or(page.getByTestId('victory-title'))).toBeVisible();
  if (await confirm.isVisible()) await confirm.click();
  await expectBattle(page, 'victory');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', /retreat|defeat/);
  await expect(page.getByTestId('reveal-xp')).toBeVisible();
  if ((await page.locator('[data-testid^="reveal-level-"]').count()) === 0) {
    w.notes.push("c11/c12: the Hydra's wooden seal does not come with this session (the server wants more); the spoils show without it");
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
  await page.getByTestId('overlay-revoir').getByRole('button', { name: 'chante\u202f: piège, touche pour voir' }).click();
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
    // Closing item 2: a lost boss fight is a standoff (never the "push" half-victory), so her pose
    // is a taunt (she keeps her apple, defiant), not a retreat.
    ['bossLost', false, 'taunt', 'c18c-boss-lost'],
  ] as const) {
    await page.route('**/api/sessions', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const res = await route.fetch();
      const json = await res.json();
      json.progression.boss = { tier: 1, won };
      if (won) json.progression.rewards = [...json.progression.rewards, { id: 'sandales_hermes', kind: 'gear', name: "Sandales d'Hermès" }];
      await route.fulfill({ response: res, json });
    });
    await page.goto(`/#/p/${w.profileId}/play/${w.texts[key]}?encounter=eris`);
    await expectBattle(page, 'victory');
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-backdrop', 'lair');
    await expect(page.getByTestId('reveal-boss')).toBeVisible();
    await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', pose);
    // UI4 Task A: her defeat swaps in the flustered pose (a sore loser caught off guard); a taunt
    // (she keeps her apple, defiant) keeps her standing card.
    await expect(page.getByTestId('battle-opponent').locator('.dragon-base')).toHaveAttribute(
      'data-src',
      pose === 'defeat' ? '/art/characters/eris_flustered_cut.webp' : '/art/characters/eris_cut.webp',
    );
    await combatantsSettled(page);
    await sheetSettled(page);
    // UI4 playability #4: the boss's block scrolls itself into the sheet's view as it is revealed.
    await expect
      .poll(() =>
        page.getByTestId('reveal-boss').evaluate((el) => {
          const body = el.closest('.sheet-body')!.getBoundingClientRect();
          const r = el.getBoundingClientRect();
          return r.top >= body.top - 1 && r.bottom <= body.bottom + 1;
        }),
      )
      .toBe(true);
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
    ['illustre', 'hydre', 'c28-faces-illustre-hydre'],
    ['ancestral', 'lethe', 'c29-faces-ancestral-lethe'],
  ] as const) {
    await page.route('**/api/profiles/*/camp', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      json.dragon = { ...json.dragon, stage };
      await route.fulfill({ response: res, json });
    });
    await page.goto(`/#/p/${w.profileId}/play/${w.texts.faces}?encounter=${encounter}`);
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
  await expect(page.getByTestId('victory-title')).toHaveText('Victoire\u202f!');
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
    // No aid at all (spec 2026-09-29 §3): the text alone and « Modifier tout le texte ».
    await setSavedAids(page, w.profileId, w.texts.long, []);
    await page.goto(`/#/p/${w.profileId}/play/${w.texts.long}`);
    await expectBattle(page, 'muster');
    // The seeded proofreading waits behind the resume ribbon each time (it saves itself as it goes);
    // never sampled once (final review M16).
    await resumeSeeded(page);
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

const isoDay = (daysAgo: number) => swissDay(daysAgo);

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
  // The pace redesign's pauses (each group read twice before « Suivant ») at a fraction of their length.
  await installFastPauses(page);
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
      faces: [T_FACES, SHORT],
    };
    for (const [key, [title, text]] of Object.entries(body) as [TextKey, [string, string]][]) {
      w.texts[key] = (await createText(page.request, { title, body: text, level: '10H' })).id;
    }
    const pid = w.profileId;
    // Ruling C2c: a battle resumes only under the encounter it was started with (the walk's links carry
    // theirs: `encounter=chimere` for the long text, `encounter=eris` for the boss verdicts).
    await seedPlay(page, { profileId: pid, textId: w.texts.long, phase: 'proofreading', draft: LONG_DRAFT, opponent: 'chimere', encounter: 'chimere' });
    await seedPlay(page, { profileId: pid, textId: w.texts.rout, phase: 'results', draft: SHORT_DRAFT, current: SHORT, opponent: 'protee' });
    await seedPlay(page, { profileId: pid, textId: w.texts.standoff, phase: 'results', draft: SHORT_DRAFT, current: SHORT_DRAFT, opponent: 'echo' });
    await seedPlay(page, { profileId: pid, textId: w.texts.bossWon, phase: 'results', draft: SHORT_DRAFT, current: SHORT, opponent: 'eris', encounter: 'eris' });
    await seedPlay(page, { profileId: pid, textId: w.texts.bossLost, phase: 'results', draft: SHORT_DRAFT, current: SHORT_HALF, opponent: 'eris', encounter: 'eris' });
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
