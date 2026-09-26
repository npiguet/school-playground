import { test, expect } from './crashGuard';
import type { APIRequestContext, Page } from '@playwright/test';
import { posix } from 'node:path';
import {
  chooseLevel,
  closeOverlay,
  createText,
  enterTitle,
  expectCamp,
  expectScene,
  makeResult,
  postSession,
  redScan,
  skipOnboarding,
  stubSpeech,
  waitForSceneSettled,
} from './helpers';

// UI3 playability walk (scenes spec §10): iPad-size screenshots of every place and overlay,
// <project>-<id>-<name>.png, for the Opus playability/immersion review ("does anything still look
// like a school form?"), then one `?debug` screenshot per scene to check the hand-authored hotspots
// against their landmarks (docs/art/scenes.md). UI3a: title, library tent, Delphi. UI3b appends its
// sections to SECTIONS and DEBUG_SHOTS.
//
// Where the shots go - WALK_OUT, a path relative to the repo root (or absolute in the container):
// - unset: web/test-results/walk-ui3, a scratch dir (git-ignored), so a walk run to look at the
//   places never dirties the tracked review baseline:
//     scripts/playwright.sh --config playwright.playability.config.ts playability-ui3
// - docs/reviews/ui3: deliberately refreshes the review baseline (tracked PNGs), for a re-review:
//     WALK_OUT=docs/reviews/ui3 scripts/playwright.sh --config playwright.playability.config.ts playability-ui3
// compose.e2e.yaml passes WALK_OUT into the Playwright container.
const OUT = posix.resolve('/work', process.env.WALK_OUT || 'web/test-results/walk-ui3');

// Playability #26: a real long accented name shows real truncation. The playability config runs
// one worker and only ipad-landscape walks the scenes (Ruling W12), so fixed names are safe - but
// an earlier walk's copies are deleted first so the ritual never meets « Ce nom est déjà pris. ».
const HERO = 'Anne-Charlotte';
const LOCKED = 'Élise-Marguerite';
const PROPHECY_TITLE = 'La dictée du jeudi';
const DESK_TITLE = 'Les fées de la clairière';
// Re-review N15: the states the first walk skipped. A defended scroll (broken seal, laurel), and
// five more heroes so the gate shows « Tous les héros » (seven in all, with HERO and LOCKED).
const DEFENDED_TITLE = 'Le chant des sirènes';
const MORE_HEROES = ['Achille', 'Pénélope', 'Nausicaa', 'Télémaque', 'Hélène'];
const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
// 100 words: the desk's gauge at « parfait » (a08b).
const BODY_100 = Array.from({ length: 10 }, () => 'La chouette veille sur les parchemins du camp quand la nuit tombe doucement.').join(' ').split(' ').slice(0, 100).join(' ');

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
  await deleteHeroes(request, [HERO, LOCKED, ...MORE_HEROES]);
  await deleteTexts(request, [PROPHECY_TITLE, DESK_TITLE, DEFENDED_TITLE]);
}

interface Walk {
  page: Page;
  project: string;
  profileId: number;
  heroName: string;
  notes: string[];
}

// Task 13 controller ruling 2: screenshots wait on real state, never a fixed animation delay.
// Every scene entry is already settled by expectScene/waitForSceneSettled before its section calls
// shot(); every overlay's fly-in is settled by waitForOverlaySettled below; every dialogue line is
// settled by settleDialogue below. What's left here is fonts and images actually finishing to
// paint: expect.poll below resolves the instant document.fonts.ready and every <img>.complete
// become true, one JS tick before the browser necessarily *paints* that state. page.screenshot()
// doesn't itself wait for a paint boundary, so the shot waits for two animation frames instead of
// a fixed pad (final review M11): the second frame only starts once the first one has painted.
async function waitForImagesAndFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => Array.from(document.images).every((img) => img.complete))).toBe(true);
}

async function shot(w: Walk, name: string) {
  await waitForImagesAndFonts(w.page);
  await w.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await w.page.screenshot({ path: `${OUT}/${w.project}-${name}.png` });
}

// Overlay.svelte's `in:fly` (scenes UI spec §4, Overlay.svelte) has no `data-settled` flag of its
// own (unlike SceneStage's `.scene-transition`), but the same getAnimations()-draining technique
// works read directly off the panel: Svelte transitions register as real Web Animations on the
// element they're attached to (getAnimations() with no `subtree` option only reports the element
// itself, so an unrelated looping CSS animation elsewhere on the page - e.g. DialogueBox's bobbing
// "more" caret - never keeps this poll from resolving).
async function waitForOverlaySettled(page: Page, testId: string) {
  const panel = page.getByTestId(testId);
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((el) => el.getAnimations().length)).toBe(0);
}

// DialogueBox types at TYPE_CPS (45 chars/s, typewriter.ts): a fixed delay either cuts a long line
// off mid-type or wastes time on a short one. A single tap on `.advance` completes the *current*
// line without moving to the next one (typewriter.ts's advance()); its accessible name flips from
// « Tout afficher » to « Suite » only once the full line is showing, which is what this waits on.
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

// waitForSceneSettled (helpers.ts) takes the scene id it waits on - Task 8-12's own specs always
// scope it, since an unscoped `.scene-transition` locator can hit a strict-mode violation during a
// place hand-off (two scenes briefly in the DOM at once).
// Every call site below is this hero's *first* visit to that place, so its greeting always fires -
// but only once `camp` has loaded (Camp/LibraryTent/Delphi's own greeting effect all gate on it,
// e.g. Camp.svelte's `if (!camp || ...) return`), which races the earlier navigation. A synchronous
// `dialogue-skip` count check (0 either way, too early or genuinely absent) used to fire this skip
// no-op and then time out waiting for a dialogue box that showed up a moment later - waiting for
// the box itself first removes that race.
async function skipGreeting(w: Walk, sceneId: string) {
  await waitForSceneSettled(w.page, sceneId);
  await expect(w.page.getByTestId('dialogue-box')).toBeVisible();
  await w.page.getByTestId('dialogue-skip').click();
  await expect(w.page.getByTestId('dialogue-box')).toHaveCount(0);
}

async function titleSection(w: Walk) {
  const { page } = w;
  await page.goto('/');
  await expectScene(page, 'title');
  await shot(w, 'a01-title-gate');
  await noRed(w, 'title');
  await enterTitle(page);
  await shot(w, 'a02-title-shields');
  await page.getByTestId('title-new').click();
  await waitForOverlaySettled(page, 'overlay-hero-new');
  const ritual = page.getByTestId('overlay-hero-new');
  await ritual.getByLabel('Ton prénom').fill(w.heroName);
  // The avatar label text is `avatarLabel('lyre')` = « Lyre » (HeroForm.svelte: capitalised key).
  await ritual.locator('label.avatar-choice', { hasText: 'Lyre' }).click();
  await chooseLevel(ritual, '10H');
  await shot(w, 'a03-title-naming-ritual');
  await noRed(w, 'naming ritual');
  const sealToggle = ritual.getByRole('button', { name: "Protéger ton bouclier d'un sceau" });
  await sealToggle.click();
  await expect(sealToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(ritual.getByLabel('Ton sceau à quatre chiffres')).toBeVisible();
  // The toggle's chevron has finished turning (a CSS transition, listed by getAnimations).
  await expect.poll(() => ritual.evaluate((e) => e.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length)).toBe(0);
  await shot(w, 'a03b-title-ritual-seal-open');
  await sealToggle.click();
  await expect(sealToggle).toHaveAttribute('aria-expanded', 'false');
  await ritual.getByRole('button', { name: 'Accrocher mon bouclier' }).click();
  await expectCamp(page);
  w.profileId = Number(page.url().match(/#\/p\/(\d+)\//)?.[1]);
  expect(w.profileId).toBeGreaterThan(0);
  await skipOnboarding(page);
  await skipGreeting(w, 'camp');

  // A protected hero's wax seal, two digits in: the elision « Le sceau d'Élise-Marguerite ».
  const res = await page.request.post('/api/profiles', {
    data: { name: LOCKED, avatar: 'trident', level: '10H', pin: '4321' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const locked = (await res.json()).id as number;
  await page.goto(`/#/p/${locked}/camp`);
  await expect(page.getByTestId('pin-gate')).toBeVisible();
  await page.getByLabel('Tes quatre chiffres').fill('43');
  await shot(w, 'a04-title-pin-seal');
  await noRed(w, 'pin seal');

  // Playability #26: the two real names on their shields (a02 ran before either existed).
  await page.goto('/');
  await enterTitle(page);
  await expect(page.getByTestId(`title-hero-${w.profileId}`)).toBeVisible();
  await expect(page.getByTestId(`title-hero-${locked}`)).toBeVisible();
  await waitForOverlaySettled(page, 'title-shields');
  await shot(w, 'a04b-title-shields-named');

  // Re-review N15: seven heroes - the gate shows the newest, « Tous les héros » and « Nouveau
  // héros »; « Tous les héros » opens the whole list. The five extra heroes leave afterwards (W12).
  for (const [i, name] of MORE_HEROES.entries()) {
    const r = await page.request.post('/api/profiles', { data: { name, avatar: ['chouette', 'dragon', 'laurier', 'foudre', 'lyre'][i], level: '10H' } });
    expect(r.ok(), await r.text()).toBeTruthy();
  }
  await page.goto('/');
  await enterTitle(page);
  await expect(page.getByTestId('title-all')).toBeVisible();
  await waitForOverlaySettled(page, 'title-shields');
  await shot(w, 'a02b-title-all-shields');
  await page.getByTestId('title-all').click();
  await waitForOverlaySettled(page, 'overlay-heroes');
  await shot(w, 'a02c-title-all-heroes');
  await noRed(w, 'all heroes');
  await closeOverlay(page);
  await deleteHeroes(page.request, MORE_HEROES);
}

async function librarySection(w: Walk) {
  const { page } = w;
  // Re-review N15: the prophecy exists before the shelves (a07 shows it on its own shelf), and a
  // defended scroll - one finished defence posted through the API - shows its broken seal (a07c).
  const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await createText(page.request, { title: PROPHECY_TITLE, body: BODY, level: '10H', due_date: due });
  const defended = await createText(page.request, { title: DEFENDED_TITLE, body: BODY, level: '10H' });
  await postSession(page.request, {
    profileId: w.profileId,
    textId: defended.id,
    day: new Date().toISOString().slice(0, 10),
    result: makeResult({ draft: 4, caught: 3 }),
  });
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-parchemins').click();
  await expectScene(page, 'library');
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await settleDialogue(page);
  await shot(w, 'a05-library-owl-greeting');
  await skipGreeting(w, 'library');
  await shot(w, 'a06-library-tent');
  await noRed(w, 'library tent');
  // Playability #23: the owl is a character - tapped, she gives a hint in the dialogue box.
  await page.getByTestId('library-owl').click();
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await settleDialogue(page);
  await shot(w, 'a06b-library-owl-hint');
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
  await page.getByTestId('library-shelves').click();
  await waitForOverlaySettled(page, 'overlay-shelves');
  await shot(w, 'a07-library-shelves');
  await noRed(w, 'shelves');
  const shelves = page.getByTestId('overlay-shelves');
  const defendedCubby = shelves.locator('[data-testid="text-card"]', { hasText: DEFENDED_TITLE });
  await expect(defendedCubby.locator('.kit-seal')).toHaveClass(/is-broken/);
  await defendedCubby.scrollIntoViewIfNeeded();
  await expect(defendedCubby).toBeInViewport({ ratio: 1 });
  await shot(w, 'a07c-library-shelves-prophecy-defended');
  await shelves.getByRole('button', { name: 'Autres classes' }).click();
  await chooseLevel(shelves, 'Tous');
  const others = shelves.getByRole('heading', { name: 'Autres parchemins' });
  await others.scrollIntoViewIfNeeded();
  await expect(others).toBeInViewport();
  await shot(w, 'a07b-library-shelves-other-levels');
  await closeOverlay(page);
  await page.getByTestId('library-desk').click();
  await waitForOverlaySettled(page, 'overlay-desk');
  await page.getByLabel('Titre').fill(DESK_TITLE);
  // 13 words: the gauge says the ideal (« l'idéal : 80 à 200 »).
  await page.getByLabel('Texte').fill(BODY);
  await shot(w, 'a08-library-desk');
  await noRed(w, 'desk');
  await page.getByLabel('Texte').fill(BODY_100);
  await expect(page.getByTestId('desk-gauge')).toContainText('100 mots · parfait');
  await shot(w, 'a08b-library-desk-perfect');
  await closeOverlay(page);
  await page.getByTestId('library-lens').click();
  await waitForOverlaySettled(page, 'overlay-lens');
  await shot(w, 'a09-library-lens');
  const lens = page.getByTestId('overlay-lens');
  await lens.getByTestId('scan-input').first().setInputFiles('/work/server/tests/fixtures/scan/handout.png');
  await expect(lens.getByTestId('btn-scan-read')).toBeVisible();
  await shot(w, 'a09b-library-lens-photo');
  await closeOverlay(page);
  await page.getByTestId('library-portal').click();
  await waitForOverlaySettled(page, 'overlay-portal');
  await shot(w, 'a10-library-portal');
  // A never-copied work shows the scribes' next step; the shared database may hold copies of all.
  const portal = page.getByTestId('overlay-portal');
  const never = portal.locator('[data-testid="work-card"][data-status="never"]');
  await ((await never.count()) > 0 ? never : portal.getByTestId('work-card')).first().click();
  await waitForOverlaySettled(page, 'overlay-portal-work');
  await shot(w, 'a11-library-portal-work');
  await noRed(w, 'portal');
  await closeOverlay(page); // work -> portal
  await closeOverlay(page); // portal -> bare scene
  await page.getByTestId('scene-exit').click();
  await expectCamp(page);
}

async function delphiSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-oracle').click();
  await expectScene(page, 'delphi');
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await settleDialogue(page);
  await expect(page.getByTestId('dialogue-text')).toContainText('Approche.');
  await shot(w, 'a12-delphi-pythia-greeting');
  await skipGreeting(w, 'delphi');
  await shot(w, 'a13-delphi-temple');
  await noRed(w, 'delphi');
  await page.getByTestId('delphi-pythia').click();
  await waitForOverlaySettled(page, 'overlay-pythia');
  await shot(w, 'a14-delphi-pythia-scrolls');
  const oracle = page.getByTestId('overlay-pythia');
  await oracle.getByTestId('scroll-ecole').getByTestId('scroll-open').click();
  await expect(oracle.getByTestId('oracle-monster-hydre')).toBeVisible();
  // The school scroll has finished unrolling (the same wait as scenes-delphi.spec.ts).
  await expect.poll(() => oracle.evaluate((e) => e.getAnimations({ subtree: true }).length)).toBe(0);
  await shot(w, 'a15-delphi-ecole-picker');
  await page.getByTestId('oracle-cancel').click();
  await closeOverlay(page);
  await page.getByTestId('delphi-tablets').click();
  await waitForOverlaySettled(page, 'overlay-tablets');
  await shot(w, 'a16-delphi-tablets');
  await noRed(w, 'tablets');
  await closeOverlay(page);
  // Re-review N15: the week chosen - the prophecies lead, the opened scroll and its quest follow.
  await page.getByTestId('delphi-pythia').click();
  await waitForOverlaySettled(page, 'overlay-pythia');
  await oracle.getByTestId('scroll-faible').getByTestId('scroll-open').click();
  await expect(oracle.getByTestId('oracle-quest')).toBeVisible();
  // As she finds it on her next visit: reopened, the prophecies lead.
  await closeOverlay(page);
  await page.getByTestId('delphi-pythia').click();
  await waitForOverlaySettled(page, 'overlay-pythia');
  await expect(oracle.getByTestId('overlay-voice')).toContainText('est ouvert');
  // The monster's pop has played (it keeps its end state, fill: both, so it stays listed as
  // finished) and the seal-break sparkles have gone; looping decorations aside.
  await expect
    .poll(() => oracle.evaluate((e) => e.getAnimations({ subtree: true }).filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).length))
    .toBe(0);
  await shot(w, 'a15b-delphi-week-chosen');
  await noRed(w, 'week chosen');
  await closeOverlay(page);
}

const SECTIONS: { name: string; run: (w: Walk) => Promise<void> }[] = [
  { name: 'title', run: titleSection },
  { name: 'library', run: librarySection },
  { name: 'delphi', run: delphiSection },
];

// One `?debug` screenshot per scene: the outlines, the safe zone, the HUD band and the dialogue
// dock over the art (UI1 Ruling 9). A new document each (location.search changes).
const DEBUG_SHOTS: { hash: string; sceneId: string; name: string }[] = [
  { hash: '/', sceneId: 'title', name: 'd01-debug-title' },
  { hash: '/p/{id}/tente-parchemins', sceneId: 'library', name: 'd02-debug-library' },
  { hash: '/p/{id}/temple', sceneId: 'delphi', name: 'd03-debug-delphi' },
];

test('UI3 playability walk', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const project = testInfo.project.name;
  const w: Walk = { page, project, profileId: 0, heroName: HERO, notes: [] };
  const origins = new Set<string>();
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
  });
  await stubSpeech(page);
  await clearEarlierWalk(page.request);
  try {
    if (project === 'ipad-portrait') {
      await page.goto('/');
      await expect(page.getByTestId('rotate-screen')).toBeVisible();
      // The still shows the tablet mid-turn (playability #27): paused at 60 % of its 2.4 s turn.
      await page.locator('.rotate-icon').evaluate((e) => {
        const a = e.getAnimations()[0];
        a.pause();
        a.currentTime = 0.6 * 2400;
      });
      await shot(w, 'a01-rotate-screen');
      return;
    }
    for (const s of SECTIONS) {
      w.notes.push(`section ${s.name}`);
      await s.run(w);
    }
    for (const d of DEBUG_SHOTS) {
      await page.goto(`/?debug#${d.hash.replace('{id}', String(w.profileId))}`);
      await expectScene(page, d.sceneId);
      await expect(page.getByTestId('hotspot-debug')).toBeVisible();
      await shot(w, d.name);
    }
    // Re-review N15: the walk's global fixtures leave with it (a prophecy due in 3 days would be
    // every other hero's next step); the heroes stay for a look until the next walk clears them.
    await deleteTexts(page.request, [PROPHECY_TITLE, DEFENDED_TITLE]);
  } finally {
    w.notes.push(`request origins: ${JSON.stringify([...origins])}`);
    console.log(`\n===== NOTES ${project} =====\n${w.notes.join('\n')}\n`);
  }
  // Spec §2.7: no runtime third-party request (fonts, CDNs...).
  expect([...origins]).toEqual([new URL(String(testInfo.project.use.baseURL)).origin]);
});
