import { test, expect } from './crashGuard';
import type { APIRequestContext, Page } from '@playwright/test';
import { posix } from 'node:path';
import {
  chooseLevel,
  closeOverlay,
  createText,
  enterTitle,
  expectCamp,
  expectLineOf,
  expectScene,
  makeResult,
  postSession,
  redScan,
  waitForSceneSettled,
} from './helpers';

// UI3 playability walk (scenes spec §10): iPad-size screenshots of every place and overlay,
// <project>-<id>-<name>.png, for the Opus playability/immersion review ("does anything still look
// like a school form?"), then one `?debug` screenshot per scene to check the hand-authored hotspots
// against their landmarks (docs/art/scenes.md). UI3a: title, library tent, Delphi. UI3b: hub, war
// tent, nest, cabin, wide viewports.
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
// UI3b carry #16 / M9: a 7H hero, for whom Protée still sleeps (the war tent's locked sheet).
const YOUNG = 'Ismène';
// The hub's lived-in camp: two lieutenants foiled over three days, one text a day (UI3b playability
// #25: three titles, so the journal groups its defences by text).
const VEILLEE_TITLE = 'La veillée des héros';
const BERGER_TITLE = 'Le chant du berger';
const ULYSSE_TITLE = "La lettre d'Ulysse";
const LIVED_IN_TITLES = [VEILLEE_TITLE, BERGER_TITLE, ULYSSE_TITLE];
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
  await deleteHeroes(request, [HERO, LOCKED, YOUNG, ...MORE_HEROES]);
  await deleteTexts(request, [PROPHECY_TITLE, DESK_TITLE, DEFENDED_TITLE, ...LIVED_IN_TITLES]);
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
  // defended scroll - one finished defence posted through the API - shows its broken seal (a07; UI3b
  // playability #24: it is already in view there, so a07c, the same frame again, is gone).
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
  await expect(defendedCubby).toBeInViewport({ ratio: 1 });
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
  // UI3b playability #24: the fill's width transition (.kit-gauge-fill) has finished, so the shot
  // shows where the gauge lands, not a frame on its way.
  await expect.poll(() => page.getByTestId('desk-gauge').locator('.kit-gauge-fill').evaluate((e) => e.getAnimations().length)).toBe(0);
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
  // The works load after the portal opens: wait for them before choosing (UI4 wave B, no one-shot).
  await expect(portal.getByTestId('work-card').first()).toBeVisible();
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
  // The greeting is one of its key's variants, picked at random (UI5 Ruling E11): not always « Approche. ».
  await expectLineOf(page.getByTestId('dialogue-box'), 'delphi.enter.sealed');
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

async function hubSection(w: Walk) {
  const { page } = w;
  // The camp greets once per hero per page load, and it already greeted this hero in the title
  // section (a hash-only goto keeps the document): a reload is the hero's return to the camp.
  await page.goto(`/#/p/${w.profileId}/camp`);
  await page.reload();
  await expectCamp(page);
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await settleDialogue(page);
  await shot(w, 'b01-hub-greeting');
  await skipGreeting(w, 'camp');
  await shot(w, 'b02-hub');
  await noRed(w, 'hub');
  // Carry #16 / M9: the locked path to battle, explained by the dragon.
  await page.getByTestId('camp-boss').click();
  await expect(page.getByTestId('dialogue-text')).toContainText('Éris se cache encore');
  await settleDialogue(page);
  await shot(w, 'b03-hub-locked-battle-path');
  await page.getByTestId('dialogue-skip').click();
  // A lived-in camp: two lieutenants foiled over three days, a quest on the wall, the battle open.
  // UI3b playability #25: the three days end before today's defence (the library's), so every date
  // the walk shows follows the story: 5, 4 and 3 days ago, one text a day.
  for (const [i, title] of LIVED_IN_TITLES.entries()) {
    const text = await createText(page.request, { title, body: BODY, level: '10H' });
    const day = new Date(Date.now() - (5 - i) * 86_400_000).toISOString().slice(0, 10);
    for (const category of ['agreement:verb', 'homophone']) {
      await postSession(page.request, { profileId: w.profileId, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category }) });
    }
  }
  const quest = await page.request.post(`/api/profiles/${w.profileId}/quests`, { data: { target: 'chimere' } });
  expect(quest.ok(), await quest.text()).toBeTruthy();
  // The reload greets again (once per page load): skipped, so the shot shows the whole camp.
  await page.reload();
  await skipGreeting(w, 'camp');
  await expect(page.getByTestId('camp-boss')).not.toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('camp-boss').locator('img.hotspot-lock')).toHaveCount(0);
  await shot(w, 'b04-hub-lived-in');
  await noRed(w, 'hub lived-in');
  // Ruling B9: the walk's prophecy (due in 3 days) comes first, so the oracle glows above. Without a
  // prophecy the open battle is the next step: /camp's prophecies are emptied for this shot only.
  await page.route('**/api/profiles/*/camp', async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.prophecies = [];
    await route.fulfill({ response: res, json });
  });
  await page.reload();
  await skipGreeting(w, 'camp');
  await expect(page.getByTestId('camp-boss')).toHaveClass(/is-new/);
  await shot(w, 'b04b-hub-battle-glow');
  await page.unrouteAll({ behavior: 'wait' });
}

async function warSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-dossier').click();
  await expectScene(page, 'war');
  await shot(w, 'b05-war-tent');
  await noRed(w, 'war tent');
  await page.getByTestId('war-hydre').click();
  await waitForOverlaySettled(page, 'overlay-portrait');
  await shot(w, 'b06-war-portrait-hydre');
  await closeOverlay(page);
  await page.getByTestId('war-dossier').click();
  await waitForOverlaySettled(page, 'overlay-dossier');
  await shot(w, 'b07-war-dossier');
  await noRed(w, 'dossier');
  await closeOverlay(page);
  await page.getByTestId('war-bestiary').click();
  await waitForOverlaySettled(page, 'overlay-codex');
  await shot(w, 'b08-war-codex');
  await page.getByTestId('bestiary-card-hydre').click();
  await waitForOverlaySettled(page, 'overlay-codex-page');
  await shot(w, 'b09-war-codex-page');
  await closeOverlay(page);
  await closeOverlay(page);
  // Carry #16 / M9 again: a lieutenant asleep at a 7H hero's class.
  const r = await page.request.post('/api/profiles', { data: { name: YOUNG, avatar: 'lyre', level: '7H' } });
  expect(r.ok()).toBeTruthy();
  const young = (await r.json()).id as number;
  await page.goto(`/#/p/${young}/tente-de-guerre`);
  await expectScene(page, 'war');
  await page.getByTestId('war-protee').click();
  await expect(page.getByTestId('dialogue-text')).toContainText('Protée dort encore');
  await settleDialogue(page);
  await shot(w, 'b10-war-sleeping-lieutenant');
}

async function nestSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-dragon').click();
  await expectScene(page, 'nest');
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await settleDialogue(page);
  await shot(w, 'b11-nest-greeting');
  await skipGreeting(w, 'nest');
  await shot(w, 'b12-nest');
  await noRed(w, 'nest');
  await page.getByTestId('nest-dragon').click();
  await waitForOverlaySettled(page, 'overlay-care');
  await shot(w, 'b13-nest-care');
  await closeOverlay(page);
}

async function cabinSection(w: Walk) {
  const { page } = w;
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-cabin').click();
  await expectScene(page, 'cabin');
  // UI3b playability #7: the dragon greets at home too (once per page load).
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await settleDialogue(page);
  await shot(w, 'b14b-cabin-greeting');
  await skipGreeting(w, 'cabin');
  await shot(w, 'b14-cabin');
  await noRed(w, 'cabin');
  for (const [spot, overlay, name] of [
    ['cabin-trophies', 'overlay-trophies', 'b15-cabin-trophies'],
    ['cabin-journal', 'overlay-journal', 'b16-cabin-journal'],
    ['cabin-lyre', 'overlay-lyre', 'b17-cabin-lyre'],
  ] as const) {
    await page.getByTestId(spot).click();
    await waitForOverlaySettled(page, overlay);
    await shot(w, name);
    await noRed(w, overlay);
    await closeOverlay(page);
  }
  // Carry #4: the HUD's hero chip opens the hero panel in the cabin, from any place.
  await page.goto(`/#/p/${w.profileId}/temple`);
  await expectScene(page, 'delphi');
  await page.getByTestId('hud-hero').click();
  await waitForOverlaySettled(page, 'overlay-heros');
  await shot(w, 'b18-cabin-hero-panel');
  await closeOverlay(page);
}

async function wideSection(w: Walk) {
  const { page } = w;
  for (const [size, name] of [
    [{ width: 1440, height: 900 }, 'b19-laptop-1440x900'],
    [{ width: 2560, height: 1080 }, 'b20-ultrawide-2560x1080'],
  ] as const) {
    await page.setViewportSize(size);
    // A reload at each size: the camp greets once per page load, and a greeting that lands a moment
    // after the shot (or not at all, on a hash-only goto) would make the wide shots race it.
    await page.goto(`/#/p/${w.profileId}/camp`);
    await page.reload();
    await skipGreeting(w, 'camp');
    await shot(w, name);
  }
  await page.setViewportSize({ width: 1180, height: 820 });
}

const SECTIONS: { name: string; run: (w: Walk) => Promise<void> }[] = [
  { name: 'title', run: titleSection },
  { name: 'library', run: librarySection },
  { name: 'delphi', run: delphiSection },
  { name: 'hub', run: hubSection },
  { name: 'war', run: warSection },
  { name: 'nest', run: nestSection },
  { name: 'cabin', run: cabinSection },
  { name: 'wide', run: wideSection },
];

// One `?debug` screenshot per scene: the outlines, the safe zone, the HUD band and the dialogue
// dock over the art (UI1 Ruling 9). A new document each (location.search changes).
const DEBUG_SHOTS: { hash: string; sceneId: string; name: string }[] = [
  { hash: '/', sceneId: 'title', name: 'd01-debug-title' },
  { hash: '/p/{id}/tente-parchemins', sceneId: 'library', name: 'd02-debug-library' },
  { hash: '/p/{id}/temple', sceneId: 'delphi', name: 'd03-debug-delphi' },
  { hash: '/p/{id}/camp', sceneId: 'camp', name: 'd04-debug-hub' },
  { hash: '/p/{id}/tente-de-guerre', sceneId: 'war', name: 'd05-debug-war-tent' },
  { hash: '/p/{id}/dragon', sceneId: 'nest', name: 'd06-debug-nest' },
  { hash: '/p/{id}/cabane', sceneId: 'cabin', name: 'd07-debug-cabin' },
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
  // Leftovers of an earlier run that failed (or was killed) before its cleanup (final review I3).
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
  } finally {
    // Re-review N15, final review I3: the walk's global fixtures leave with it, even when a section
    // failed (a prophecy due in 3 days would be every other hero's next step, and the functional
    // suite's glow checks would fail for days); clearEarlierWalk above also removes any a crashed
    // run left. The heroes stay for a look until the next walk clears them. A failed delete is
    // noted, never allowed to hide the walk's own failure.
    try {
      await deleteTexts(page.request, [PROPHECY_TITLE, DEFENDED_TITLE, ...LIVED_IN_TITLES]);
    } catch (e) {
      w.notes.push(`cleanup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    w.notes.push(`request origins: ${JSON.stringify([...origins])}`);
    console.log(`\n===== NOTES ${project} =====\n${w.notes.join('\n')}\n`);
  }
  // Spec §2.7: no runtime third-party request (fonts, CDNs...).
  expect([...origins]).toEqual([new URL(String(testInfo.project.use.baseURL)).origin]);
});
