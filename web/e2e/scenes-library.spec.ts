import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import {
  chooseLevel,
  closeOverlay,
  createProfileApi,
  createText,
  expectCamp,
  expectExitClearOfDialogueDock,
  expectInSafeZone,
  expectOverlayTapTargets,
  expectScene,
  labelOverlaps,
  makeResult,
  postSession,
  redScan,
  tap,
  uniqueName,
} from './helpers';

// UI3a Task 9 (scenes spec §3 Library, §10): the library tent as a place. desktop + ipad.

const PLACES = ['library-shelves', 'library-desk', 'library-lens', 'library-portal'];
const heroName = (project: string) => uniqueName(`Tente-${project}`);

async function openTent(page: Page, id: number) {
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

test('the hub leads into the tent; its plaque echoes the hub label; the exit sign leads back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page.getByTestId('camp-parchemins'), testInfo);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expectScene(page, 'library');
  await expect(page.locator('.stage-plaque')).toHaveText('La tente des parchemins');
  await expect(page.getByTestId('dialogue-text')).toContainText('Hou !');
  await page.getByTestId('dialogue-skip').click();
  for (const p of PLACES) await expect(page.getByTestId(p)).toBeVisible();
  await expect(page.getByTestId('library-desk')).toContainText('Écrire un nouveau parchemin');
  await expect(page.getByTestId('library-desk').locator('img.hotspot-icon')).toHaveAttribute('src', '/art/icons/add-text.webp');
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
  await page.goBack();
  await expectScene(page, 'library');
  await page.goBack();
  await expectCamp(page);
});

// Task S: `history.back()` is asynchronous, so a second close before the first Back has landed
// (a held Escape repeating, the seal then Escape) used to step back twice - out of the tent, to the
// camp. The test holds every `history.back()` the page makes until both Escapes are in (two
// separate tasks, like a key repeat), then lets them traverse one after the other: the window is
// there however fast the host. (WebKit merges two `back()` calls made in the same task, which is
// why the Escapes are not sent together.)
test('two quick Escapes close the shelves once and stay in the tent', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page.getByTestId('camp-parchemins'), testInfo);
  await expectScene(page, 'library');
  await tap(page.getByTestId('library-shelves'), testInfo);
  const shelves = page.getByTestId('overlay-shelves');
  await expect(shelves.getByRole('heading', { name: 'Tes parchemins' })).toBeVisible();
  const hashes = await page.evaluate(async () => {
    const realBack = history.back.bind(history);
    const held: (() => void)[] = [];
    history.back = () => held.push(realBack);
    const escape = () => dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    escape();
    await new Promise((r) => setTimeout(r, 0));
    escape();
    const seen: string[] = [];
    addEventListener('hashchange', () => seen.push(location.hash));
    for (const back of held) await new Promise((r) => (addEventListener('hashchange', r, { once: true }), back()));
    return seen;
  });
  expect(hashes).toEqual([`#/p/${id}/tente-parchemins`]);
  await expect(shelves).toHaveCount(0);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expectScene(page, 'library');
});

test('the shelves open « Tes parchemins » as an overlay; seal, Escape and Back close it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('library-shelves'), testInfo);
  await expect(page).toHaveURL(/\/parchemins$/);
  const shelves = page.getByTestId('overlay-shelves');
  await expect(shelves.getByRole('heading', { name: 'Tes parchemins' })).toBeVisible();
  await expect(page.getByTestId('scene-library')).toHaveAttribute('inert', '');
  await expect(shelves.getByRole('heading', { name: 'Pour toi' })).toBeVisible();
  await expect(shelves.locator('[data-testid="text-card"]').first()).toBeVisible();
  // Playability #2: no school metadata on the shelves - no grade pills, no word counts.
  await expect(shelves.getByText(/≈|\bmots\b|Jamais joué|\b10H\b/)).toHaveCount(0);
  await expect(shelves.getByTestId('shelf-levels')).toHaveCount(0);
  // Parity: every level is still one toggle away.
  await shelves.getByRole('button', { name: 'Autres niveaux' }).click();
  await chooseLevel(shelves.getByTestId('shelf-levels'), '9H');
  await expect(shelves.getByRole('heading', { name: 'Classe 9H' })).toBeVisible();
  await chooseLevel(shelves.getByTestId('shelf-levels'), 'Tous');
  await expect(shelves.getByRole('heading', { name: 'Autres parchemins' })).toBeVisible();
  // Each scroll on one shelf only: her own class behind the toggle repeats nothing of « Pour toi ».
  await chooseLevel(shelves.getByTestId('shelf-levels'), '10H');
  await expect(shelves.locator('#other-levels [data-testid="text-card"]')).toHaveCount(0);
  await expect(shelves.locator('#other-levels')).toContainText('sous « Pour toi »');
  await expectOverlayTapTargets(page, 'overlay-shelves');
  await shelves.getByTestId('overlay-close').click();
  await expect(shelves).toHaveCount(0);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expect(page.getByTestId('library-shelves')).toBeFocused();

  // The one-tap guard was released: the next object still opens (UI3 Ruling A6).
  await tap(page.getByTestId('library-shelves'), testInfo);
  await expect(shelves).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(shelves).toHaveCount(0);
  await tap(page.getByTestId('library-shelves'), testInfo);
  await expect(shelves).toBeVisible();
  await page.goBack();
  await expect(shelves).toHaveCount(0);
  await expect(page).toHaveURL(/\/tente-parchemins$/);

  // A deep link reopens it; its seal replaces the entry with the bare scene.
  await page.goto(`/#/p/${id}/parchemins`);
  await expect(shelves).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});

test('a text card on the shelves starts the dictation; a prophecy wears its ribbon', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const title = uniqueName(`Prophétie tente ${testInfo.project.name}`);
  await createText(request, { title, body: 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.', level: '10H', due_date: '2099-01-01' });
  await page.goto(`/#/p/${id}/parchemins`);
  const card = page.getByTestId('overlay-shelves').locator('[data-testid="text-card"]', { hasText: title });
  await expect(card.getByTestId('chip-prophecy')).toContainText('jeudi 1er janvier 2099');
  await expect(card).toHaveAttribute('data-length', 'court');
  await expect(card).toContainText('Jamais défendu');
  // A prophecy is not repeated under its class behind « Autres niveaux ».
  await page.getByTestId('overlay-shelves').getByRole('button', { name: 'Autres niveaux' }).click();
  await chooseLevel(page.getByTestId('overlay-shelves').getByTestId('shelf-levels'), '10H');
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(page).toHaveURL(/\/play\/\d+$/);
});

test('a defended text wears a broken seal and a laurel; a new one keeps its seal whole', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const fresh = uniqueName('Sceau intact');
  const defended = uniqueName('Sceau brisé');
  const body = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
  await createText(request, { title: fresh, body, level: '10H' });
  const t = await createText(request, { title: defended, body, level: '10H' });
  await postSession(request, { profileId: id, textId: t.id, day: new Date().toISOString().slice(0, 10), result: makeResult({ draft: 2, caught: 1 }) });
  await page.goto(`/#/p/${id}/parchemins`);
  const shelves = page.getByTestId('overlay-shelves');
  const whole = shelves.locator('[data-testid="text-card"]', { hasText: fresh });
  const broken = shelves.locator('[data-testid="text-card"]', { hasText: defended });
  await expect(whole.locator('.kit-seal')).not.toHaveClass(/is-broken/);
  await expect(broken.locator('.kit-seal')).toHaveClass(/is-broken/);
  await expect(broken.locator('.seal-laurel')).toBeVisible();
  await expect(broken).toContainText('Défendu 1 fois · 50 % des pièges déjoués');
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openTent(page, id);
    await expectInSafeZone(page, 'library', [...PLACES, 'library-owl'], ['library-owl']);
    expect(await labelOverlaps(page, 'library'), `${size.width}x${size.height}`).toEqual([]);
  }
});

test('the owl is a speaker you can tap: she replays one of her hints', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
  const owl = page.getByTestId('library-owl');
  await expect(owl).toHaveAccessibleName("La chouette d'Athéna");
  await expect(owl.locator('.hotspot-label')).toHaveCount(0);
  await tap(owl, testInfo);
  await expect(page.getByTestId('dialogue-text')).toContainText('Hou !');
  // The other places still open (one-tap guard released for a null target).
  await page.getByTestId('dialogue-skip').click();
  await tap(page.getByTestId('library-shelves'), testInfo);
  await expect(page.getByTestId('overlay-shelves')).toBeVisible();
});

test('the exit sign never overlaps the dialogue dock', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size);
    await openTent(page, id);
    await expectExitClearOfDialogueDock(page, 'library');
  }
});

test('opening and closing a panel never remounts the tent: no replayed entry zoom', async ({ page, request }, testInfo) => {
  // Controller ruling 5: LibraryTent must stay the same mounted instance across `library-tent` <->
  // `library` (App.svelte's `view?.place === 'library'` branch, not one branch per route.name), so
  // an overlay never replays SceneTransition's entry zoom. Proved two ways: the settled element is
  // the exact same DOM node throughout, and it is never seen "unsettled" again after the round trip.
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  const stage = page.locator('[data-testid="scene-library"] .scene-transition');
  await expect(stage).toHaveAttribute('data-settled', 'true');
  const before = await stage.elementHandle();
  await tap(page.getByTestId('library-shelves'), testInfo);
  await expect(page).toHaveURL(/\/parchemins$/);
  // A remount would recreate the node at `data-settled="false"` before its own zoom finished; a
  // node that stayed mounted was never anything but settled.
  await expect(stage).toHaveAttribute('data-settled', 'true');
  const afterOpen = await stage.elementHandle();
  expect(await page.evaluate(([a, b]) => a === b, [before, afterOpen])).toBe(true);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expect(stage).toHaveAttribute('data-settled', 'true');
  const afterClose = await stage.elementHandle();
  expect(await page.evaluate(([a, b]) => a === b, [before, afterClose])).toBe(true);
});

test('library: ?debug outlines the four objects and the owl; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins?debug`);
  await expectScene(page, 'library');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(5);
  expect(await redScan(page)).toEqual([]);
  await page.goto(`/#/p/${id}/parchemins`);
  await expect(page.getByTestId('overlay-shelves')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});

// UI3a Task 10: the desk and the lens open the write/paste and scan forms as in-world overlays
// (Ruling A3), instead of the legacy full screens. Ruling A2: saving replaces the tagged
// text-new/text-scan history entry rather than pushing a new one, so Back never reopens the form.
test('the desk writes a new parchment; saving lands on the shelves and Back never reopens the form', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('library-desk'), testInfo);
  await expect(page).toHaveURL(/\/texts\/new$/);
  const desk = page.getByTestId('overlay-desk');
  await expect(desk.getByRole('heading', { name: 'Le pupitre' })).toBeVisible();
  await expect(desk.getByTestId('overlay-voice')).toContainText('Entre 80 et 200 mots');
  await expect(desk.getByText('Entre quatre-vingts')).toHaveCount(0);
  const title = uniqueName(`Pupitre ${testInfo.project.name}`);
  await desk.getByLabel('Titre').fill(title);
  await desk.getByLabel('Texte').fill('Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.');
  await expect(desk.getByTestId('desk-gauge')).toContainText('13 mots · il en faut au moins 80');
  // A text to defend is set in Literata (Ruling A8).
  expect(await desk.getByLabel('Texte').evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Literata');
  await expect(desk.getByRole('group', { name: 'Classe' })).toBeVisible();
  await expect(desk.locator('select')).toHaveCount(0);
  // Parity: author, work and translator are one tap away.
  await desk.getByText("Qui l'a écrit ?").click();
  for (const label of ['Auteur', 'Œuvre', 'Traducteur']) await expect(desk.getByLabel(label)).toBeVisible();
  // Playability #5: the way to finish is visible without scrolling on the iPad.
  const submit = desk.getByRole('button', { name: "Poser sur l'étagère" });
  if (testInfo.project.name === 'ipad') {
    const [s, body] = await Promise.all([submit.boundingBox(), desk.locator('.overlay-body').boundingBox()]);
    expect(s!.y + s!.height, 'submit visible without scrolling').toBeLessThanOrEqual(body!.y + body!.height);
  }
  await expectOverlayTapTargets(page, 'overlay-desk');
  expect(await redScan(page)).toEqual([]);
  await submit.click();
  await expect(page).toHaveURL(/\/parchemins$/);
  await expect(page.getByTestId('overlay-shelves').locator('[data-testid="text-card"]', { hasText: title })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});

// Final review I1: the shelves that replace the saved form keep its history tag (replacePanel), so
// closing them with the seal steps back onto the tent's own entry. Before the fix the seal took the
// untagged branch and replaced instead, leaving [camp, tent, tent]: the next Back stayed on the tent
// (a dead press) and only a second one reached the camp. WebKit happens to keep the tag across a
// fragment `location.replace()`; Chromium drops it, as the spec says, so this test also runs in the
// `chromium` project (playwright.config.ts), where it fails without the re-tag.
test('after saving from the desk, closing the shelves then Back leaves the tent in one press', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await tap(page.getByTestId('camp-parchemins'), testInfo);
  await expectScene(page, 'library');
  await page.getByTestId('dialogue-skip').click();
  await tap(page.getByTestId('library-desk'), testInfo);
  const desk = page.getByTestId('overlay-desk');
  await expect(desk).toBeVisible();
  const title = uniqueName(`Retour ${testInfo.project.name}`);
  await desk.getByLabel('Titre').fill(title);
  await desk.getByLabel('Texte').fill('Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.');
  await desk.getByRole('button', { name: "Poser sur l'étagère" }).click();
  const shelves = page.getByTestId('overlay-shelves');
  await expect(shelves.locator('[data-testid="text-card"]', { hasText: title })).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expectScene(page, 'library');
  await page.goBack();
  await expect(page).toHaveURL(/\/camp$/);
  await expectCamp(page);
});

test('the lens opens the three-step scan as a wide overlay', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('library-lens'), testInfo);
  await expect(page).toHaveURL(/\/texts\/scan$/);
  const lens = page.getByTestId('overlay-lens');
  await expect(lens.getByRole('heading', { name: 'La lentille de bronze' })).toBeVisible();
  await expect(lens.getByTestId('overlay-voice')).toContainText('une photo par page');
  await expect(lens.getByText(/scanner/i)).toHaveCount(0);
  await expect(page.getByTestId('scan-input')).toBeAttached();
  // Playability #6: no grey disabled button before a photo exists; the lens shows its glass.
  await expect(page.getByTestId('btn-scan-read')).toHaveCount(0);
  await expect(lens.locator('.lens-frame img.lens-glass')).toHaveAttribute('src', '/art/icons/add-scan.webp');
  await expect(lens.getByText('Prendre une photo')).toBeVisible();
  await expect(lens.getByText('Choisir une photo')).toBeVisible();
  await page.getByTestId('scan-input').setInputFiles('/work/server/tests/fixtures/scan/handout.png');
  await expect(page.getByTestId('btn-scan-read')).toHaveText('Déchiffrer');
  await expect(lens.locator('.lens-frame img')).toBeVisible();
  await expect(lens.locator('.lens-frame img.lens-glass')).toHaveCount(0);
  await expectOverlayTapTargets(page, 'overlay-lens');
  const box = await lens.boundingBox();
  expect(box!.width, 'wide overlay').toBeGreaterThan(700);
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
});

// UI3a Task 11: the portal opens Alexandria's works, a work opens its scrolls, both as overlays
// over the tent. Controller ruling U3: a portail <-> oeuvre switch is this same `{#if}` chain's own
// branch toggling (not an ancestor unmounting it), so Overlay's local `out:leave` still plays - the
// outgoing overlay stays in the DOM for its 160ms fade, and a page-wide `overlay-close` locator
// would match two seals - every close click below is scoped to the overlay it targets.
test('the portal opens the works, a work opens its scrolls, « Toutes les œuvres » and the seal step back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openTent(page, id);
  await tap(page.getByTestId('library-portal'), testInfo);
  await expect(page).toHaveURL(/\/alexandria$/);
  const portal = page.getByTestId('overlay-portal');
  await expect(portal).toHaveAttribute('data-variant', 'codex');
  await expect(portal.getByRole('heading', { name: "Le portail d'Alexandrie" })).toBeVisible();
  await expect(portal.locator('.codex-page')).toHaveCount(2);
  await expect(portal.getByTestId('work-card').first()).toBeVisible();
  // Playability #24: the byline never repeats the title; the level is a medallion.
  const perrault = portal.locator('[data-testid="work-card"]', { hasText: 'Contes de Perrault' });
  await expect(perrault.locator('.entry-by')).toHaveText('Charles Perrault');
  await expect(portal.getByText(/niveau \d/)).toHaveCount(0);
  expect(await portal.getByTestId('work-card').count()).toBeGreaterThanOrEqual(10);
  const workId = await portal.getByTestId('work-card').first().getAttribute('data-work-id');
  await portal.getByTestId('work-card').first().click();
  await expect(page).toHaveURL(/\/alexandria\/[^/]+$/);
  const work = page.getByTestId('overlay-portal-work');
  await expect(work.getByTestId('btn-refresh-work')).toBeVisible();
  await expect(work).not.toContainText('domaine public');
  // Playability #7: a never-copied work points at the scribes, with no filter to filter nothing. The
  // shared database may already hold copies of this work (alexandria.spec.ts covers that branch).
  if ((await portal.getByTestId('work-card').first().getAttribute('data-status')) === 'never') {
    await expect(work.getByTestId('scribes-empty')).toContainText("Les scribes n'ont encore rien recopié de ce livre. Demande-leur !");
    await expect(work.getByTestId('work-levels')).toHaveCount(0);
    await expect(work.getByTestId('btn-refresh-work')).toHaveText('Demander aux scribes');
  }
  const back = work.getByTestId('portal-back');
  await expect(back).toContainText('Toutes les œuvres');
  // Measured once the panel has settled (expectOverlayTapTargets waits out its fly-in): read
  // during it, the 48 px control once came out at 47.99998 (Task S measurement runs).
  await expectOverlayTapTargets(page, 'overlay-portal-work');
  expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await back.click();
  await expect(page).toHaveURL(/\/alexandria$/);
  await expect(portal).toBeVisible();
  await portal.getByTestId('work-card').first().click();
  await expect(work).toBeVisible();
  await work.getByTestId('overlay-close').click(); // steps back one overlay (Ruling A2)
  await expect(portal).toBeVisible();
  // Fix round 2 finding 1: focus lands on the card the player opened, not the (inert)
  // library-portal hotspot - deterministic even though the portal remounts fresh and re-fetches its
  // works list (PortalPanel focuses it itself once `works` has actually rendered, not a fixed delay
  // timed against the work overlay's own 160ms close).
  await expect(portal.locator(`[data-work-id="${workId}"]`)).toBeFocused();
  await portal.getByTestId('overlay-close').click();
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  expect(await redScan(page)).toEqual([]);
});

// UI3a Task 11 fix round 1 #3: the portal's two untagged deep links - a bare reload has no history
// entry behind it (Ruling A2), so closing must replace, never leaving a Back trap that reopens the
// work (already proved for the shelves in the deep-link case above; this is the two-overlay chain's
// own version of it).
test('a deep link into a work: the seal and « Toutes les œuvres » replace, never a Back trap', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const work = page.getByTestId('overlay-portal-work');

  // Final review M9: the seal steps back one overlay, onto the works, exactly like « Toutes les
  // œuvres »: on a deep link it replaces the work entry with the works list. Not just the URL right
  // after closing (fix round 2 finding 3): Back must not resurrect the replaced work either.
  await page.goto(`/#/p/${id}/alexandria/verne-vingt-mille-lieues`);
  await expect(work.getByTestId('btn-refresh-work')).toBeVisible();
  await work.getByTestId('overlay-close').click();
  await expect(page).toHaveURL(/\/alexandria$/);
  await expect(page.getByTestId('overlay-portal')).toBeVisible();
  await expect(work).toHaveCount(0);
  await page.goBack();
  await expect(page).not.toHaveURL(/alexandria\/verne/);

  // « Toutes les œuvres » replaces it with the works list instead; Back from there leaves for
  // wherever came before the deep link (the tent, opened first here) rather than reopening the work.
  await openTent(page, id);
  await page.goto(`/#/p/${id}/alexandria/verne-vingt-mille-lieues`);
  await expect(work).toBeVisible();
  await work.getByTestId('portal-back').click();
  await expect(page).toHaveURL(/\/alexandria$/);
  await expect(page.getByTestId('overlay-portal')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  await expect(work).toHaveCount(0);
});

// B3 fix round 1: an unknown work still offers a way on from its right page.
test('an unknown work says so on its right page and leads back to the works', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/alexandria/pas-une-oeuvre`);
  const work = page.getByTestId('overlay-portal-work');
  await expect(work.getByTestId('work-missing')).toContainText("Les scribes ne trouvent pas ce livre sur les rayons d'Alexandrie.");
  await expectOverlayTapTargets(page, 'overlay-portal-work');
  await work.locator('.page-right').getByRole('button', { name: 'Toutes les œuvres' }).click();
  await expect(page).toHaveURL(/\/alexandria$/);
  await expect(page.getByTestId('overlay-portal')).toBeVisible();
});

// Final review M17: two quick level taps start two chunk requests; the one answered last must not
// win if it was asked first. The first level's answer is held until the second one has rendered
// (no timing window), then released: the list must still show the second level's scrolls.
test("a slow answer for an earlier level never replaces the later level's scrolls", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const chunk = (seq: number, level: string, preview: string) => ({ id: 900000 + seq, seq, level, word_count: 120, score: 20, preview, text_id: null });
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  await page.route('**/api/alexandria/works/*/chunks*', async (route) => {
    const level = new URL(route.request().url()).searchParams.get('level');
    if (level === '9H') {
      await held;
      await route.fulfill({ json: [chunk(1, '9H', 'Rouleau du neuvième degré')] });
    } else if (level === '10H') {
      await route.fulfill({ json: [chunk(2, '10H', 'Rouleau du dixième degré')] });
    } else {
      // « Tous »: one scroll, so the level medallions show (they hide while there is nothing to filter).
      await route.fulfill({ json: [chunk(3, '8H', 'Rouleau de tous les degrés')] });
    }
  });
  await page.goto(`/#/p/${id}/alexandria/verne-vingt-mille-lieues`);
  const work = page.getByTestId('overlay-portal-work');
  await expect(work.getByTestId('btn-refresh-work')).toBeVisible();
  const levels = work.getByTestId('work-levels');
  await expect(work.getByTestId('chunk-card')).toContainText('Rouleau de tous les degrés');
  const slow = page.waitForRequest((r) => r.url().includes('/chunks?level=9H'));
  await chooseLevel(levels, '9H');
  await slow;
  await chooseLevel(levels, '10H');
  const cards = work.getByTestId('chunk-card');
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('Rouleau du dixième degré');
  const late = page.waitForResponse((r) => r.url().includes('/chunks?level=9H'));
  release();
  await late;
  // One frame for Svelte to apply whatever the late answer would change.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('Rouleau du dixième degré');
  await expect(levels.getByRole('radio', { name: '10H', exact: true })).toBeChecked();
});
