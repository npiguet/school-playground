import { test, expect } from './crashGuard';
import type { Page } from '@playwright/test';
import {
  closeOverlay,
  createProfileApi,
  createText,
  makeResult,
  postSession,
  swissDay,
  uniqueName,
  expectCamp,
  expectInSafeZone,
  expectInWorldOverlay,
  expectLineOf,
  expectScene,
  labelOverlaps,
  redScan,
  tap,
  heroNamer,
} from './helpers';
import { frenchSpacing } from '../src/lib/text/french';

// UI3b Tasks 5-6 (scenes spec §3 Cabin, §10). desktop + ipad.

const PLACES = ['cabin-trophies', 'cabin-journal', 'cabin-lyre'];
const heroName = heroNamer('Cabane');

async function openCabin(page: Page, id: number) {
  await page.goto(`/#/p/${id}/cabane`);
  await expectScene(page, 'cabin');
  await expect(page.getByTestId('hud-xp')).toBeVisible();
}

test('the cabin: its own room, three places, the exit', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await expect(page.locator('[data-testid="scene-cabin"] .stage-plaque')).toHaveText('Ta cabane');
  await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', '/art/scenes/cabin.webp');
  for (const p of PLACES) await expect(page.getByTestId(p)).toBeVisible();
  await expect(page.getByTestId('cabin-trophies')).toContainText('Aucun trésor encore');
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

test('the trophy shelf shows every reward, each known in advance', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await tap(page.getByTestId('cabin-trophies'), testInfo);
  await expect(page).toHaveURL(/\/cabane\?panel=tresors$/);
  const shelf = page.getByTestId('overlay-trophies');
  await expect(shelf.getByRole('heading', { name: 'Tes trésors', level: 2 })).toBeVisible();
  for (const section of ['Trophées', 'Armes et armures divines', 'Objets de la cabane', 'Teintes']) {
    await expect(shelf.getByRole('heading', { name: section, level: 3 })).toBeVisible();
  }
  const sandals = shelf.getByTestId('cabin-reward-sandales_hermes');
  await expect(sandals).toHaveAttribute('data-owned', 'false');
  // UI3b playability #13: how to win it, said to the player; the gear's dark silhouette, not a « ? ».
  // Spec 2026-09-29 explanations §4 (R13): the sandals are the next fight's, and say so.
  await expect(sandals).toContainText('Gagne le prochain combat contre Éris pour les gagner.');
  await expect(sandals).not.toContainText("Comment l'obtenir");
  await expect(sandals.locator('.medallion')).toHaveAttribute('aria-label', 'Récompense à découvrir');
  await expect(sandals.locator('.medallion img.silhouette')).toHaveCSS('filter', /brightness\(0\)/);
  // UI3b playability #7: the dragon speaks from the shelf's plate (no seal won yet).
  await expect(shelf.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', 'dragon');
  await expect(shelf.getByTestId('overlay-voice')).toContainText("Chaque sceau que tu gagnes pose un trophée sur l'étagère. Le premier sera en bois\u202f!");
  // Fix round 1: a tint still to win is a grey egg; the filter is on the egg, not on its ring.
  const ecume = shelf.getByTestId('cabin-reward-tint:ecume');
  await expect(ecume.locator('.tint-egg')).toHaveCSS('filter', 'none');
  await expect(ecume.locator('.tint-egg img')).toHaveCSS('filter', /grayscale\(1\)/);
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/cabane$/);
  await expect(page.getByTestId('cabin-trophies')).toBeFocused();
});

// Spec 2026-09-29 lieutenant levels §5: real seals from posted sessions (the test clock): three days
// win the Hydra's wooden seal, four more days after it the bronze one.
test('the shelf: each lieutenant its highest trophy, the lower ones in its close view, an empty plinth says the first seal', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Étagère ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  for (const day of ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09']) {
    await postSession(request, { profileId: id, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }) });
  }
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  const shelf = page.getByTestId('overlay-trophies');
  await expect(shelf.getByRole('heading', { name: 'Trophées', level: 3 })).toBeVisible();
  const hydre = shelf.getByTestId('cabin-trophy-hydre');
  await expect(hydre).toHaveAttribute('data-level', '2');
  await expect(hydre.locator('img')).toHaveAttribute('src', '/art/trophies/trophy-hydre-2.webp');
  await expect(hydre).toContainText('Sceau de bronze');
  const echo = shelf.getByTestId('cabin-trophy-echo');
  await expect(echo).toHaveAttribute('data-level', '0');
  await expect(echo).toContainText("Premier sceau\u202f: défends des textes où Écho se cache.");
  await expect(echo).toContainText('3 jours de garde et 12 pièges, dont 85\u202f% déjoués.');
  const open = hydre.getByRole('button', { name: "Écaille de l'Hydre en bronze" });
  await tap(open, testInfo);
  await expect(open).toHaveAttribute('aria-expanded', 'true');
  const close = shelf.getByTestId('cabin-trophy-close-hydre');
  // The sheet opens under the whole row: it takes the focus (and its plinth points at it).
  await expect(close).toBeFocused();
  await expect(open).toHaveAttribute('aria-controls', 'trophy-close-hydre');
  await expect(close.locator('img.close-art')).toHaveAttribute('src', '/art/trophies/large/trophy-hydre-2.webp');
  await expect(close).toContainText("Écaille de l'Hydre en bois");
  await expect(close.locator('img[src="/art/trophies/trophy-hydre-1.webp"]')).toBeVisible();
  await expect(shelf.getByTestId('overlay-voice')).toContainText('Il en reste 28 à gagner');
  await tap(open, testInfo);
  await expect(close).toHaveCount(0);
  await expect(open).toBeFocused();
  await expect(open).not.toHaveAttribute('aria-controls');
  expect(await redScan(page)).toEqual([]);
});

// Spec 2026-09-29 explanations §4 (R13; review focus 5): nothing on the shelf is hidden, each thing says how.
test('the shelf says how to win every trophy, and the next fight names its gear', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.route(`**/api/profiles/${id}/rewards`, async (route) => {
    const list = await (await route.fetch()).json();
    const trophy = (level: number, material: string) => ({
      id: `trophy:hydre:${level}`, kind: 'trophy', name: `Écaille de l'Hydre en ${material}`, desc: '',
      source: "Sceau de l'Hydre", granted_at: '2026-09-20T12:00:00+00:00', equipped: false,
    });
    await route.fulfill({ json: [...list, trophy(1, 'bois'), trophy(2, 'bronze')] });
  });
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  const shelf = page.getByTestId('overlay-trophies');
  await expect(shelf.getByTestId('cabin-trophy-echo')).toContainText(frenchSpacing("Premier sceau : défends des textes où Écho se cache."));
  await expect(shelf.getByTestId('cabin-trophy-echo')).toContainText('3 jours de garde et 12 pièges, dont 85\u202f% déjoués.');
  await tap(shelf.getByTestId('cabin-trophy-open-echo'), testInfo);
  for (const level of [1, 2, 3, 4, 5]) await expect(shelf.getByTestId(`cabin-trophy-towin-echo-${level}`)).toBeVisible();
  await tap(shelf.getByTestId('cabin-trophy-open-hydre'), testInfo);
  const close = shelf.getByTestId('cabin-trophy-close-hydre');
  await expect(close).toContainText("Aussi sur l'étagère");
  await expect(close.getByTestId('cabin-trophy-towin-hydre-2')).toHaveCount(0);
  await expect(close.getByTestId('cabin-trophy-towin-hydre-3')).toContainText(frenchSpacing("Au sceau d'argent : défends encore des textes où l'Hydre se cache."));
  await expect(shelf.getByTestId('cabin-reward-sandales_hermes')).toContainText('Gagne le prochain combat contre Éris pour les gagner.');
  await expect(shelf.getByTestId('cabin-reward-egide')).toContainText('Bats Éris une deuxième fois pour la gagner.');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('overlay-trophies: an in-world table, clear of the HUD, 48 px targets, kit classes only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  await expectInWorldOverlay(page, 'overlay-trophies', 'cabin', true, 'table', 'dragon');
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openCabin(page, id);
    await expectInSafeZone(page, 'cabin', PLACES);
    expect(await labelOverlaps(page, 'cabin'), `${size.width}x${size.height}`).toEqual([]);
  }
});

test('cabin: ?debug outlines three places; no red; rotate screen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  await expect(page.getByTestId('hotspot-debug').locator('svg.outline')).toHaveCount(3);
  expect(await redScan(page)).toEqual([]);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
});

test('the journal opens as a codex: the aids taken last, the tricks, the words, the defences', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await tap(page.getByTestId('cabin-journal'), testInfo);
  await expect(page).toHaveURL(/\/stats$/);
  const journal = page.getByTestId('overlay-journal');
  await expect(journal.getByRole('heading', { name: 'Ton journal', level: 2 })).toBeVisible();
  await expect(journal.getByRole('heading', { name: 'Tes aides' })).toBeVisible();
  // Spec 2026-09-29 §3: the aids taken last (all five for a new hero) and what one left is worth, in
  // words, no numbered steps to tap (UI3b playability #2).
  await expect(journal.getByTestId('journal-aids')).toContainText('Tu emportes toutes les aides.');
  await expect(journal.getByTestId('journal-aids')).toContainText('Chaque aide laissée au camp\u202f: +20\u202f% de gloire.');
  await expect(journal.getByTestId('journal-aids').locator('li, .kit-medallion')).toHaveCount(0);
  for (const h of ["Les ruses d'Éris, une à une", 'Mots-pièges', 'Tes dernières défenses', 'Depuis le début']) {
    await expect(journal.getByRole('heading', { name: h })).toBeVisible();
  }
  // Playability #1, #14: no gradebook table, no points.
  await expect(journal.locator('table')).toHaveCount(0);
  await expect(journal.getByTestId('journal-totals')).toHaveText('0 texte défendu · 0 piège déjoué');
  await expect(journal).not.toContainText(/niveau|partie|point|réussite/i);
  await expect(journal.getByTestId('overlay-voice')).toHaveText(/Ton journal se souvient de chaque texte défendu\./);
  await closeOverlay(page);
  await expect(page.getByTestId('cabin-journal')).toBeFocused();
});

// Final review minor 2: a null remembered choice (a hand-edited setting) reads as no choice yet.
test('the journal reads a null remembered choice of aids as none yet', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.route('**/api/profiles/*/stats', async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.profile.settings = { ...json.profile.settings, aids: null };
    await route.fulfill({ response: res, json });
  });
  await page.goto(`/#/p/${id}/stats`);
  await expect(page.getByTestId('overlay-journal').getByTestId('journal-aids')).toContainText('Tu emportes toutes les aides.');
});

// UI3b playability #1, #14: Éris's tricks told by their monster with laurels, and the defences one
// line per text (the journal is the one place for the counts, playability #3).
test("the journal tells Éris's tricks by their monster, and each text once", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const title = uniqueName('La veillée');
  const text = await createText(request, { title, body: 'Les fées dansent dans la clairière.', level: '10H' });
  const today = swissDay();
  const before = swissDay(1);
  await postSession(request, { profileId: id, textId: text.id, day: before, result: makeResult({ draft: 4, caught: 3, category: 'agreement:verb' }) });
  await postSession(request, { profileId: id, textId: text.id, day: today, result: makeResult({ draft: 2, caught: 0, category: 'homophone' }) });
  await page.goto(`/#/p/${id}/stats`);
  const journal = page.getByTestId('overlay-journal');
  const hydre = journal.getByTestId('journal-ruse-hydre');
  await expect(hydre).toContainText("L'Hydre — tu as déjoué 3 de ses 4 pièges");
  await expect(hydre).toContainText("l'accord du verbe avec son sujet");
  await expect(hydre.getByRole('img', { name: '4 feuilles de laurier sur 5' })).toBeVisible();
  await expect(hydre.locator('img[src="/art/icons/lt-hydre.webp"]')).toBeAttached();
  await expect(journal.getByTestId('journal-ruse-echo')).toContainText("Écho — tu n'as encore déjoué aucun de ses 2 pièges");
  await expect(journal.locator('table')).toHaveCount(0);
  await expect(journal.getByTestId('journal-defence')).toHaveCount(1);
  await expect(journal.getByTestId('journal-defence')).toContainText(title);
  await expect(journal.getByTestId('journal-defence')).toContainText(/^.*2 défenses, la dernière le \S+ \d/);
  await expect(journal.getByTestId('journal-totals')).toHaveText('2 textes défendus · 3 pièges déjoués');
  await expect(journal).not.toContainText(/point|réussite/i);
  // No « Réussite » percentage on the tricks, the words or the defences; the one « % » of the journal is
  // the aids' rule, what an aid left at the camp is worth (spec 2026-09-29 §3).
  for (const part of [journal.locator('.ruses'), journal.locator('.page-right')]) await expect(part).not.toContainText('%');
  await expect(journal.getByTestId('journal-aids')).toContainText('%');
  expect(await redScan(page)).toEqual([]);
});

test('the lyre holds the settings, the three sound channels, the goal as medallions, the credits and the build',async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  await tap(page.getByTestId('cabin-lyre'), testInfo);
  await expect(page).toHaveURL(/\/settings$/);
  const lyre = page.getByTestId('overlay-lyre');
  await expect(lyre.getByRole('heading', { name: 'La lyre', level: 2 })).toBeVisible();
  await expect(lyre.getByRole('group', { name: 'Ta classe' })).toBeVisible();
  await expect(lyre.getByLabel('Tes quatre chiffres')).toBeVisible();
  // The camp's sounds are three channels (UI5, spec §7): a slider and a « Sourdine » toggle each,
  // never a bare checkbox, and no longer a radio pair.
  await expect(lyre.locator('input[type="checkbox"]')).toHaveCount(0);
  // The voice is the server's (Kokoro plan Ruling K10): a trial to hear, nothing to choose.
  await expect(lyre.getByTestId('lyre-try-voice')).toBeVisible();
  await expect(lyre.locator('select')).toHaveCount(0);
  for (const ch of ['music', 'sfx', 'voice']) await expect(lyre.getByTestId(`lyre-channel-${ch}`)).toBeVisible();
  await expect(lyre.getByRole('radiogroup', { name: 'Les sons du camp' })).toHaveCount(0);
  await expect(lyre.getByRole('group', { name: 'Les sons du camp' })).toHaveCount(0);
  const muteMusic = lyre.getByTestId('lyre-mute-music');
  await expect(muteMusic).toHaveAttribute('aria-pressed', 'false');
  await muteMusic.click();
  await expect(muteMusic).toHaveAttribute('aria-pressed', 'true');
  await expect(lyre.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', 'dragon');
  await lyre.getByRole('group', { name: 'Textes par semaine' }).getByRole('radio', { name: '4' }).check();
  await lyre.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(lyre.getByRole('status')).toHaveText("C'est noté.");
  await lyre.getByTestId('lyre-credits').locator('summary').click();
  await expect(lyre.getByTestId('lyre-credits')).toContainText('Wikisource');
  await expect(lyre.getByTestId('lyre-credits')).toContainText('Kokoro');
  // The build stamp (scripts/lib.sh passes GIT_COMMIT and BUILD_DATE to the image build): the
  // credits' last line names the build the server says it runs.
  const { build } = await (await request.get('/api/health')).json();
  expect(build.commit).toMatch(/^[0-9a-f]{7,}$/);
  expect(build.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const [y, m, d] = build.date.split('-').map(Number);
  const month = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][m - 1];
  await expect(lyre.getByTestId('lyre-build')).toHaveText(`version ${build.commit} · ${d === 1 ? '1er' : d} ${month} ${y}`);
  expect(await redScan(page)).toEqual([]);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/cabane$/);
});

test('the HUD hero chip opens the hero panel in the cabin from any place; its seal steps back', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/tente-parchemins`);
  await expectScene(page, 'library');
  await page.getByTestId('dialogue-skip').click();
  // UI3b playability #18: the place fades to night, then the cabin rises behind the scroll (seen by
  // an observer, not raced by a poll: the fade lasts 180 ms).
  await page.evaluate(() => {
    const w = window as unknown as { __heroVeil?: boolean };
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="hero-veil"]')) w.__heroVeil = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByTestId('hud-hero').click();
  await expect(page).toHaveURL(/\/cabane\?panel=heros$/);
  expect(await page.evaluate(() => (window as unknown as { __heroVeil?: boolean }).__heroVeil)).toBe(true);
  await expect(page.getByTestId('hero-veil')).toHaveCount(0);
  const panel = page.getByTestId('overlay-heros');
  await expect(panel.getByRole('heading', { name: 'Ton héros', level: 2 })).toBeVisible();
  for (const name of ['La lyre', 'Ton journal', 'Changer de héros']) await expect(panel.getByRole('link', { name })).toBeVisible();
  await expect(page.getByTestId('scene-cabin')).toHaveAttribute('inert', '');
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/tente-parchemins$/);
  // Final review M17: the step back remounts the library (a new chip): focus lands on it there too.
  await expect(page.getByTestId('hud-hero')).toBeFocused();
  await page.getByTestId('hud-hero').click();
  await panel.getByRole('link', { name: 'Ton journal' }).click();
  await expect(page).toHaveURL(/\/stats$/);
  await closeOverlay(page); // steps back to the hero panel it came from
  await expect(panel).toBeVisible();
  await expect(page).toHaveURL(/\/cabane\?panel=heros$/);
  await expect(panel.getByTestId('hero-journal')).toBeFocused();
  // The lyre opened from the panel hands focus back to its medallion too.
  await panel.getByRole('link', { name: 'La lyre' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/cabane\?panel=heros$/);
  await expect(panel.getByTestId('hero-settings')).toBeFocused();
});

// UI3b playability #7: the cabin is home, and the dragon speaks there too.
test('the dragon greets in the cabin, once per page load', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCabin(page, id);
  const box = page.getByTestId('dialogue-box');
  await expect(box).toBeVisible();
  await expectLineOf(box, 'cabin.enter');
  await page.getByTestId('dialogue-skip').click();
  await expect(box).toHaveCount(0);
  await tap(page.getByTestId('cabin-lyre'), testInfo);
  await expect(page.getByTestId('overlay-lyre').getByTestId('overlay-voice')).toContainText('Règle ici la musique, les bruitages et la voix');
  await closeOverlay(page);
  await expect(box).toHaveCount(0);
});

test('a deep link to the hero panel closes onto the cabin, focus on the HUD hero chip', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?panel=heros`);
  await expect(page.getByTestId('overlay-heros')).toBeVisible();
  await closeOverlay(page);
  await expect(page).toHaveURL(/\/cabane$/);
  await expect(page.getByTestId('hud-hero')).toBeFocused();
});

test('displayed decor hangs on bare wall, clear of every place and plaque', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // Four pieces on display (the most the walls hold before they cycle): intercepted, so no quest has
  // to be won first.
  const decor = ['decor:lanterne', 'decor:tapis', 'decor:bibliotheque', 'decor:trophee'];
  await page.route(`**/api/profiles/${id}/rewards`, (route) =>
    route.fulfill({
      json: decor.map((rid) => ({ id: rid, kind: 'decor', name: rid, desc: '', source: '', granted_at: '2026-09-21T12:00:00+00:00', equipped: true })),
    }),
  );
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size);
    await openCabin(page, id);
    for (const rid of decor) await expect(page.getByTestId(`cabin-decor-${rid}`)).toBeVisible();
    const boxes = await page.evaluate(() => {
      const r = (el: Element) => el.getBoundingClientRect();
      const stage = document.querySelector('[data-testid="scene-cabin"]')!;
      return {
        decor: [...stage.querySelectorAll('[data-testid^="cabin-decor-"]')].map(r),
        others: [...stage.querySelectorAll('.hotspot-label, .hotspot-leader, .stage-plaque, [data-testid^="cabin-"]:not([data-testid^="cabin-decor-"])')].map(r),
      };
    });
    const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    for (const [i, d] of boxes.decor.entries()) {
      for (const o of boxes.others) expect(overlap(d, o), `${size.width}x${size.height} decor ${i}`).toBe(false);
      for (const e of boxes.decor.slice(i + 1)) expect(overlap(d, e), `${size.width}x${size.height} decor ${i} vs another`).toBe(false);
    }
  }
});

for (const o of [
  // UI3b playability #7: the dragon speaks on the journal and the lyre; the hero panel is a short menu.
  { hash: (id: number) => `/p/${id}/stats`, testId: 'overlay-journal', variant: 'codex', voice: 'dragon' },
  { hash: (id: number) => `/p/${id}/settings`, testId: 'overlay-lyre', variant: 'scroll', voice: 'dragon' },
  { hash: (id: number) => `/p/${id}/cabane?panel=heros`, testId: 'overlay-heros', variant: 'scroll', voice: null },
] as const) {
  test(`${o.testId}: an in-world ${o.variant}, clear of the HUD, 48 px targets, kit classes only`, async ({ page, request }, testInfo) => {
    const id = await createProfileApi(request, heroName(testInfo.project.name));
    await page.goto(`/#${o.hash(id)}`);
    await expectInWorldOverlay(page, o.testId, 'cabin', true, o.variant, o.voice);
  });
}

test('the walls hold four pieces: a fifth « Exposer » says so and hangs nothing', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const row = (rid: string, equipped: boolean) => ({ id: rid, kind: 'decor', name: rid, desc: '', source: '', granted_at: '2026-09-21T12:00:00+00:00', equipped });
  const shown = ['decor:lanterne', 'decor:tapis', 'decor:bibliotheque', 'decor:trophee'];
  const patches: string[] = [];
  await page.route(`**/api/profiles/${id}/rewards**`, (route) => {
    if (route.request().method() === 'PATCH') {
      patches.push(route.request().url());
      return route.fulfill({ status: 409, json: { detail: "Les murs sont pleins\u202f: range d'abord une pièce." } });
    }
    return route.fulfill({ json: [...shown.map((rid) => row(rid, true)), row('decor:fresque', false)] });
  });
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  const shelf = page.getByTestId('overlay-trophies');
  const fresque = shelf.getByTestId('cabin-equip-decor:fresque');
  await expect(fresque).toHaveText('Exposer');
  await expect(fresque).toBeEnabled(); // never disabled without a word
  await expect(shelf.getByTestId('cabin-walls-full')).toHaveCount(0);
  await fresque.click();
  await expect(shelf.getByTestId('cabin-walls-full')).toHaveText("Les murs sont pleins\u202f: range d'abord une pièce.");
  await expect(fresque).toHaveText('Exposer');
  expect(patches, 'the client refuses before asking the server').toEqual([]);
  await closeOverlay(page);
  await expectScene(page, 'cabin');
  for (const rid of shown) await expect(page.getByTestId(`cabin-decor-${rid}`)).toBeVisible();
  await expect(page.getByTestId('cabin-decor-decor:fresque')).toHaveCount(0);
});
