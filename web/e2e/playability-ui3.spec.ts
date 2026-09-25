import { test, expect, type Page } from '@playwright/test';
import {
  closeOverlay,
  createText,
  enterTitle,
  expectCamp,
  expectScene,
  redScan,
  skipOnboarding,
  stubSpeech,
  uniqueName,
  waitForSceneSettled,
} from './helpers';

// UI3 playability walk (scenes spec §10): iPad-size screenshots of every place and overlay into
// docs/reviews/ui3/<project>-<id>-<name>.png for the Opus playability/immersion review ("does
// anything still look like a school form?"), then one `?debug` screenshot per scene to check the
// hand-authored hotspots against their landmarks (docs/art/scenes.md). UI3a: title, library tent,
// Delphi. UI3b appends its sections to SECTIONS and DEBUG_SHOTS.
// Run: scripts/playwright.sh --config playwright.playability.config.ts playability-ui3

const OUT = '/work/docs/reviews/ui3';

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
// paint, plus a short fixed pad: expect.poll below resolves the instant document.fonts.ready and
// every <img>.complete become true, one JS tick before the browser necessarily *paints* that state
// - page.screenshot() doesn't itself wait for a paint boundary, so a small fixed pad (not tied to
// any specific animation) covers that one frame with margin.
async function waitForImagesAndFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => Array.from(document.images).every((img) => img.complete))).toBe(true);
}

async function shot(w: Walk, name: string, pad = 120) {
  await waitForImagesAndFonts(w.page);
  await w.page.waitForTimeout(pad);
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
  await page.getByLabel('Ton prénom').fill(w.heroName);
  // The avatar label text is `avatarLabel('lyre')` = « Lyre » (HeroForm.svelte: capitalised key).
  await page.getByTestId('overlay-hero-new').locator('label.avatar-choice', { hasText: 'Lyre' }).click();
  await page.getByLabel('Ton niveau').selectOption('10H');
  await shot(w, 'a03-title-naming-ritual');
  await noRed(w, 'naming ritual');
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expectCamp(page);
  w.profileId = Number(page.url().match(/#\/p\/(\d+)\//)?.[1]);
  expect(w.profileId).toBeGreaterThan(0);
  await skipOnboarding(page);
  await skipGreeting(w, 'camp');

  // A protected hero's sealed parchment. `w.heroName` is already unique (uniqueName); appending a
  // fixed suffix (no second uniqueName wrap - profile.name has a 30-char server limit, and stacking
  // two random suffixes overflowed it, so the create 422'd and left `locked` undefined).
  const res = await page.request.post('/api/profiles', {
    data: { name: `${w.heroName}-code`, avatar: 'trident', level: '10H', pin: '4321' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const locked = (await res.json()).id as number;
  await page.goto(`/#/p/${locked}/camp`);
  await expect(page.getByTestId('pin-gate')).toBeVisible();
  await shot(w, 'a04-title-pin-seal');
  await noRed(w, 'pin seal');
}

async function librarySection(w: Walk) {
  const { page } = w;
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
  await page.getByTestId('library-shelves').click();
  await waitForOverlaySettled(page, 'overlay-shelves');
  await shot(w, 'a07-library-shelves');
  await noRed(w, 'shelves');
  await closeOverlay(page);
  await page.getByTestId('library-desk').click();
  await waitForOverlaySettled(page, 'overlay-desk');
  await page.getByLabel('Titre').fill(uniqueName('Les fées de la clairière'));
  await page.getByLabel('Texte').fill('Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.');
  await shot(w, 'a08-library-desk');
  await noRed(w, 'desk');
  await closeOverlay(page);
  await page.getByTestId('library-lens').click();
  await waitForOverlaySettled(page, 'overlay-lens');
  await shot(w, 'a09-library-lens');
  await closeOverlay(page);
  await page.getByTestId('library-portal').click();
  await waitForOverlaySettled(page, 'overlay-portal');
  await shot(w, 'a10-library-portal');
  await page.getByTestId('overlay-portal').getByTestId('work-card').first().click();
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
  const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await createText(page.request, {
    title: uniqueName('La dictée du jeudi'),
    body: 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.',
    level: '10H',
    due_date: due,
  });
  await page.goto(`/#/p/${w.profileId}/camp`);
  await expectCamp(page);
  await page.getByTestId('camp-oracle').click();
  await expectScene(page, 'delphi');
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await settleDialogue(page);
  await shot(w, 'a12-delphi-pythia-greeting');
  await skipGreeting(w, 'delphi');
  await shot(w, 'a13-delphi-temple');
  await noRed(w, 'delphi');
  await page.getByTestId('delphi-pythia').click();
  await waitForOverlaySettled(page, 'overlay-pythia');
  await shot(w, 'a14-delphi-pythia-scrolls');
  await page.getByTestId('scroll-ecole').getByTestId('scroll-open').click();
  await expect(page.getByTestId('oracle-monster-hydre')).toBeVisible();
  await shot(w, 'a15-delphi-ecole-picker');
  await page.getByTestId('oracle-cancel').click();
  await closeOverlay(page);
  await page.getByTestId('delphi-tablets').click();
  await waitForOverlaySettled(page, 'overlay-tablets');
  await shot(w, 'a16-delphi-tablets');
  await noRed(w, 'tablets');
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
  // Task 13 controller ruling 3: a unique hero name, not a bare `Ariane-${project}` - avoids a 409
  // from profile.name's UNIQUE constraint on a rerun (uniqueName's own doc comment in helpers.ts).
  const w: Walk = { page, project, profileId: 0, heroName: uniqueName('Ariane'), notes: [] };
  const origins = new Set<string>();
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(url.origin);
  });
  await stubSpeech(page);
  try {
    if (project === 'ipad-portrait') {
      await page.goto('/');
      await expect(page.getByTestId('rotate-screen')).toBeVisible();
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
    w.notes.push(`request origins: ${JSON.stringify([...origins])}`);
    console.log(`\n===== NOTES ${project} =====\n${w.notes.join('\n')}\n`);
  }
  // Spec §2.7: no runtime third-party request (fonts, CDNs...).
  expect([...origins]).toEqual([new URL(String(testInfo.project.use.baseURL)).origin]);
});
