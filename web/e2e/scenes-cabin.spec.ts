import { test, expect } from './crashGuard';
import type { Page, TestInfo } from '@playwright/test';
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
  expectPiecesClear,
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

test('the trophy shelf: a won tint is an egg painted in its tint, with no filter', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // This hero owns the écume tint (the shelf only draws it; winning it is pinned by pytest).
  await page.route(`**/api/profiles/${id}/rewards`, (route) =>
    route.fulfill({ json: [{ id: 'tint:ecume', kind: 'tint', name: 'Écume', desc: '', source: '', granted_at: '2026-09-30T10:00:00', equipped: false }] }),
  );
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  const ecume = page.getByTestId('overlay-trophies').getByTestId('cabin-reward-tint:ecume');
  await expect(ecume).toHaveAttribute('data-owned', 'true');
  // The egg's baked écume picture (amended 2026-10-03, baked tints); a won egg carries no CSS filter.
  await expect(ecume.locator('.tint-egg img')).toHaveAttribute('data-tint', 'ecume');
  await expect(ecume.locator('.tint-egg img')).toHaveAttribute('src', '/art/dragon/dragon_egg_ecume.webp');
  await expect(ecume.locator('.tint-egg img')).toHaveCSS('filter', 'none');
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
  // One column, so a child reads the list top to bottom, never in a zig-zag (Task 5 review minor 1).
  await expect(shelf.getByTestId('cabin-trophy-close-echo').locator('ul.to-win')).toHaveCSS('flex-direction', 'column');
  await tap(shelf.getByTestId('cabin-trophy-open-hydre'), testInfo);
  const close = shelf.getByTestId('cabin-trophy-close-hydre');
  await expect(close).toContainText("Aussi sur l'étagère");
  await expect(close.getByTestId('cabin-trophy-towin-hydre-2')).toHaveCount(0);
  await expect(close.getByTestId('cabin-trophy-towin-hydre-3')).toContainText(frenchSpacing("Au sceau d'argent : défends encore des textes où l'Hydre se cache."));
  // A trophy still to win is a dark silhouette, never the lit trophy as if owned.
  await expect(close.getByTestId('cabin-trophy-towin-hydre-3').locator('img.silhouette')).toHaveCSS('filter', /brightness\(0\)/);
  await expect(shelf.getByTestId('cabin-reward-sandales_hermes')).toContainText('Gagne le prochain combat contre Éris pour les gagner.');
  await expect(shelf.getByTestId('cabin-reward-egide')).toContainText('Bats Éris une deuxième fois pour la gagner.');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

// R13: only an awake lieutenant's plinth opens; a sleeping one says when it wakes, with no button.
test("a sleeping lieutenant's plinth has no close view to open", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name), '5H');
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  const shelf = page.getByTestId('overlay-trophies');
  const protee = shelf.getByTestId('cabin-trophy-protee');
  await expect(protee).toContainText('Protée dort encore.');
  await expect(protee.getByTestId('cabin-trophy-open-protee')).toHaveCount(0);
  await expect(shelf.getByTestId('cabin-trophy-open-hydre')).toBeVisible();
});

test('overlay-trophies: an in-world table, clear of the HUD, 48 px targets, kit classes only', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  await expectInWorldOverlay(page, 'overlay-trophies', 'cabin', true, 'table', 'dragon');
});

test('places and labels sit in the safe zone, labels never cover another place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let house = 'cabin';
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), house } });
  });
  // Controller ruling H8, 2026-10-03: in the three house rooms only, the « Tes trésors » plaque may
  // sit in the dialogue dock. The cupboard (spec 2026-10-02 house treasures) reaches the dock's top
  // edge (y 80), so its plaque below can go nowhere else; the dialogue is transient and the plaque
  // shows again when it closes. Its other checks, and every other plaque's, stay as strict.
  const H8_IN_DOCK = ['cabin-trophies'];
  for (const h of ['cabin', 'villa', 'palais']) {
    house = h;
    // A fresh page load, so the room asks the camp again (the camp is kept between hash changes).
    await page.goto('about:blank');
    for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }, { width: 1024, height: 640 }]) {
      await page.setViewportSize(size);
      await openCabin(page, id);
      await expect(page.locator('[data-testid="scene-cabin"] .art-bg')).toHaveAttribute('src', `/art/scenes/${h}.webp`);
      await expectInSafeZone(page, 'cabin', PLACES, [], H8_IN_DOCK);
      expect(await labelOverlaps(page, 'cabin'), `${h} ${size.width}x${size.height}`).toEqual([]);
    }
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

// Spec 2026-10-02 house treasures: each piece on display at its own place, at three screen sizes
// (Review Focus 3: the plaques are pixel-sized while the art scales).
test('the pieces on display stand at their places, clear of every plaque and of each other, not tappable', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // Five pieces on display: intercepted, so no quest has to be won first.
  const decor = ['decor:lanterne', 'decor:tapis', 'decor:bibliotheque', 'decor:trophee', 'decor:fresque'];
  await page.route(`**/api/profiles/${id}/rewards`, (route) =>
    route.fulfill({
      json: decor.map((rid) => ({ id: rid, kind: 'decor', name: rid, desc: '', source: '', granted_at: '2026-09-21T12:00:00+00:00', equipped: true })),
    }),
  );
  for (const size of [{ width: 1280, height: 720 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }, { width: 1024, height: 640 }]) {
    await page.setViewportSize(size);
    await openCabin(page, id);
    for (const rid of decor) await expect(page.getByTestId(`cabin-piece-${rid}`)).toBeVisible();
    await expectPiecesClear(page, size);
  }
  expect(await page.getByTestId('cabin-piece-decor:tapis').evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none');
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

// Spec 2026-10-02 house treasures: no display limit; the shelf only ever says what the server says.
test('a fifth piece goes on display; a refusal from the server is said word for word', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const row = (rid: string, equipped: boolean) => ({ id: rid, kind: 'decor', name: rid, desc: '', source: '', granted_at: '2026-09-21T12:00:00+00:00', equipped });
  const state = new Map<string, boolean>([
    ['decor:lanterne', true], ['decor:tapis', true], ['decor:bibliotheque', true], ['decor:trophee', true],
    ['decor:fresque', false], ['decor:amphore', false],
  ]);
  let refuse = false;
  const patches: string[] = [];
  await page.route(`**/api/profiles/${id}/rewards**`, (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      patches.push(req.url());
      if (refuse) return route.fulfill({ status: 409, json: { detail: "Ta maison n'est pas un objet à exposer." } });
      const rid = decodeURIComponent(req.url().split('/rewards/')[1]);
      state.set(rid, (req.postDataJSON() as { equipped: boolean }).equipped);
      return route.fulfill({ json: row(rid, state.get(rid)!) });
    }
    return route.fulfill({ json: [...state].map(([rid, on]) => row(rid, on)) });
  });
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  const shelf = page.getByTestId('overlay-trophies');
  const fresque = shelf.getByTestId('cabin-equip-decor:fresque');
  await expect(fresque).toHaveText('Exposer');
  await tap(fresque, testInfo);
  await expect(fresque).toHaveText('Ranger');
  refuse = true;
  const amphore = shelf.getByTestId('cabin-equip-decor:amphore');
  await tap(amphore, testInfo);
  await expect(shelf.getByRole('alert')).toHaveText("Ta maison n'est pas un objet à exposer.");
  await expect(amphore).toHaveText('Exposer');
  expect(patches, 'both asked the server').toHaveLength(2);
  expect(await redScan(page)).toEqual([]);
});

/** The room at rest: the first visit's tour or the greeting skipped (no tour zoom), the art filling
 *  the 1280-wide frame. Never with ?debug, which neither tours nor greets (PlaceScene). */
async function restedRoom(page: Page, testInfo: TestInfo) {
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await tap(page.getByTestId('dialogue-skip'), testInfo);
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
  await expect.poll(() => page.locator('[data-testid="scene-cabin"] .art-bg').evaluate((e) => Math.round(e.getBoundingClientRect().width))).toBe(1280);
}

// Spec 2026-10-02 house treasures: real seals from posted sessions (the test clock): three days win
// the Hydra's wooden seal, four more days after it the bronze one.
test("a seal won puts its trophy at the lieutenant's place, full size; the next seal replaces it there", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Trophée ${testInfo.project.name}`), body: 'Les fées dansent dans la clairière.', level: '10H' });
  const days = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'];
  const play = async (list: string[]) => {
    for (const day of list) await postSession(request, { profileId: id, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }) });
  };
  await play(days.slice(0, 3));
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/#/p/${id}/cabane`);
  await expectScene(page, 'cabin');
  await restedRoom(page, testInfo);
  const hydre = page.getByTestId('cabin-piece-hydre');
  await expect(hydre).toHaveAttribute('data-level', '1');
  await expect(hydre.locator('img')).toHaveAttribute('src', '/art/trophies/large/trophy-hydre-1.webp');
  // Named for screen readers with its seal's title.
  await expect(hydre.locator('img')).toHaveAttribute('alt', "Sceau de bois de l'Hydre");
  // Full size: the large trophy (512 px), never the shelf's small one.
  await expect.poll(() => hydre.locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(512);
  await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(1);
  expect(await hydre.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none');
  const foot = async () => {
    const b = await hydre.boundingBox();
    return b && [Math.round(b.x), Math.round(b.y + b.height), Math.round(b.width)];
  };
  const before = await foot();
  expect(before, 'the wooden trophy is laid out').not.toBeNull();
  await play(days.slice(3));
  await page.reload();
  await expectScene(page, 'cabin');
  await restedRoom(page, testInfo);
  await expect(hydre).toHaveAttribute('data-level', '2');
  await expect(hydre.locator('img')).toHaveAttribute('src', '/art/trophies/large/trophy-hydre-2.webp');
  await expect(hydre.locator('img')).toHaveAttribute('alt', "Sceau de bronze de l'Hydre");
  await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(1);
  // The bronze trophy stands where the wooden one stood: same left edge, same foot, same width.
  await expect.poll(foot).toEqual(before);
});

// Spec 2026-10-02 house treasures: gear stands in the room only when exposed (ruling R8), decor leaves
// it when put away, and the piece the shelf did not touch stays.
test('« Exposer » puts a piece at its place in the room, « Ranger » takes it away', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const kinds: Record<string, string> = { egide: 'gear', 'decor:tapis': 'decor', 'decor:chouette': 'decor' };
  const state = new Map<string, boolean>([['egide', false], ['decor:tapis', true], ['decor:chouette', true]]);
  const row = (rid: string) => ({ id: rid, kind: kinds[rid], name: rid, desc: '', source: '', granted_at: '2026-09-21T12:00:00+00:00', equipped: state.get(rid) });
  await page.route(`**/api/profiles/${id}/rewards**`, (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const rid = decodeURIComponent(req.url().split('/rewards/')[1]);
      state.set(rid, (req.postDataJSON() as { equipped: boolean }).equipped);
      return route.fulfill({ json: row(rid) });
    }
    return route.fulfill({ json: [...state.keys()].map(row) });
  });
  await openCabin(page, id);
  await tap(page.getByTestId('dialogue-skip'), testInfo);
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
  await expect(page.getByTestId('cabin-piece-decor:tapis')).toBeVisible();
  await expect(page.getByTestId('cabin-piece-decor:chouette')).toBeVisible();
  await expect(page.getByTestId('cabin-piece-egide')).toHaveCount(0);
  await tap(page.getByTestId('cabin-trophies'), testInfo);
  const shelf = page.getByTestId('overlay-trophies');
  await expect(shelf.getByTestId('cabin-equip-egide')).toHaveText('Exposer');
  await tap(shelf.getByTestId('cabin-equip-egide'), testInfo);
  await expect(shelf.getByTestId('cabin-equip-egide')).toHaveText('Ranger');
  await expect(shelf.getByTestId('cabin-equip-decor:tapis')).toHaveText('Ranger');
  await tap(shelf.getByTestId('cabin-equip-decor:tapis'), testInfo);
  await expect(shelf.getByTestId('cabin-equip-decor:tapis')).toHaveText('Exposer');
  await closeOverlay(page);
  await expect(page.getByTestId('cabin-piece-egide')).toBeVisible();
  await expect(page.getByTestId('cabin-piece-egide').locator('img')).toHaveAttribute('src', '/art/treasures/egide.webp');
  await expect(page.getByTestId('cabin-piece-decor:tapis')).toHaveCount(0);
  await expect(page.getByTestId('cabin-piece-decor:chouette')).toBeVisible();
  await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(2);
});

// Review Focus 2: the rewards out of reach leave the fixtures empty and the shelf says why. Ruling H5:
// api.ts's handleResponse throws ApiError(status, body.detail) when the detail is a string, and
// CabinRoom hands that detail to the shelf as its loadError: the shelf says the server's own words,
// and not the empty house's line.
test('the rewards failing leave the room empty, the shelf says why', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.route(`**/api/profiles/${id}/rewards`, (route) => route.fulfill({ status: 500, json: { detail: 'Les trésors sont introuvables.' } }));
  await page.goto(`/#/p/${id}/cabane?debug`);
  await expectScene(page, 'cabin');
  // The painted fixtures stay (every place's debug line, owned or not), with no piece on them.
  await expect(page.locator('[data-testid^="cabin-place-"]')).toHaveCount(18);
  await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(0);
  await page.goto(`/#/p/${id}/cabane?panel=tresors`);
  const shelf = page.getByTestId('overlay-trophies');
  await expect(shelf.locator('.panel-trophies > .kit-note')).toHaveText(['Les trésors sont introuvables.']);
  await expect(page.locator('[data-testid^="cabin-piece-"]')).toHaveCount(0);
  expect(await redScan(page)).toEqual([]);
});
