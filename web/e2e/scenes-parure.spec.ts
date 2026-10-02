// Spec 2026-09-29 drachmes §4, §6: earn → buy → wear → see it in the camp; the tint never touches the
// pieces; the egg keeps its pieces without showing them. desktop + ipad.
import { test, expect } from './crashGuard';
import {
  createProfileApi, createText, expectBattle, expectCamp, expectOverlayTapTargets, expectScene, heroNamer, makeResult, postSession, redScan, seedPlay,
  tap, uniqueName,
} from './helpers';

const heroName = heroNamer('Parure');
// Seven days against the Hydra: the wooden seal on the third, the bronze one on the seventh (four days,
// 40 chances after it); 1 000 words a session make a young dragon and about 250 drachmes.
const DAYS = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09'];
const BODY = 'Les fées dansent dans la clairière.';

test('earn, buy the Hydra\'s collar, wear it: the dragon wears it in the camp, untinted', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName(`Parure ${testInfo.project.name}`), body: BODY, level: '10H' });
  let last: any = null;
  for (const day of DAYS) {
    last = await postSession(request, { profileId: id, textId: text.id, day, result: makeResult({ words: 1000, draft: 4, caught: 4, category: 'agreement:verb' }) });
  }
  expect(last.progression.levels).toContainEqual({ lieutenant: 'hydre', level: 2, reward_id: 'trophy:hydre:2' });
  expect(['young', 'adult']).toContain(last.progression.dragon.stage_after);
  // The stall: the collar is on sale, the ring waits for the silver seal.
  await page.goto(`/#/p/${id}/camp?panel=etal`);
  const stall = page.getByTestId('overlay-stall');
  await expect(stall.getByTestId('stall-item-accessory:hydre-queue')).toContainText("Au sceau d'argent de l'Hydre");
  const collar = stall.getByTestId('stall-item-accessory:hydre-cou');
  await expect(collar.locator('img.stall-pic')).toHaveAttribute('src', /\/art\/dragon\/accessories\/hydre-cou_/);
  await tap(collar.getByTestId('stall-buy-accessory:hydre-cou'), testInfo);
  await expect(collar).toContainText("Acheter le collier d'écailles vertes pour 40 drachmes\u202f?");
  await tap(collar.getByTestId('stall-confirm'), testInfo);
  await expect(collar).toHaveAttribute('data-state', 'owned');
  // The nest: put it on.
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  const care = page.getByTestId('overlay-care');
  await expect(care.getByTestId('parure-cou-rien')).toHaveAttribute('aria-checked', 'true');
  await tap(care.getByTestId('parure-hydre-cou'), testInfo);
  await expect(care.getByTestId('parure-hydre-cou')).toHaveAttribute('aria-checked', 'true');
  await expectOverlayTapTargets(page, 'overlay-care');
  await expect.poll(async () => (await request.get(`/api/profiles/${id}/camp`).then((r) => r.json())).dragon.worn).toEqual(['hydre-cou']);
  // The camp: the collar over the dragon, no filter on it.
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  const layer = page.getByTestId('camp-dragon-layer');
  const overlay = layer.locator('img.dragon-overlay[data-item="hydre-cou"]');
  await expect(overlay).toHaveAttribute('src', /\/art\/dragon\/accessories\/hydre-cou_(young|adult)\.webp$/);
  await expect(overlay).toHaveCSS('filter', 'none');
  const [base, piece] = [await layer.locator('img.dragon-base').boundingBox(), await overlay.boundingBox()];
  expect(piece!.x).toBeGreaterThanOrEqual(base!.x - 1);
  expect(piece!.x + piece!.width).toBeLessThanOrEqual(base!.x + base!.width + 1);
  expect(await redScan(page)).toEqual([]);
  // The victory's dragon card wears it too (R19): a counted victory where the dragon grows.
  await seedPlay(page, {
    profileId: id,
    textId: text.id,
    phase: 'results',
    draft: BODY,
    current: BODY,
    opponent: 'hydre',
    encounter: null,
    progression: {
      xp: { session: 51, bonuses: [], total_before: 1160, total_after: 1211, stage_before: 'hatchling', stage_after: 'young', floor: 1200, next: 5000 },
      quests: [],
      levels: [],
      rewards: [],
      dragon: { stage_before: 'hatchling', stage_after: 'young', needs_name: false },
      weekly: { target: 5, done: 1, reached_now: false },
      boss: null,
      encounter: null,
      drachmes: { earned: 5, parts: [{ reason: 'session', amount: 5 }], balance: 200 },
    },
  });
  // A new document, so the seed's init script runs (a hash change alone keeps the page).
  await page.goto('about:blank');
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  const card = page.getByTestId('victory').getByTestId('reveal-dragon');
  await expect(card.locator('img.dragon-overlay[data-item="hydre-cou"]')).toHaveAttribute('src', /hydre-cou_young\.webp$/);
  await expect(card.locator('img.dragon-overlay')).toHaveCount(1);
  // « Rien » takes it off.
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  await tap(page.getByTestId('parure-cou-rien'), testInfo);
  await expect(page.getByTestId('parure-cou-rien')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await request.get(`/api/profiles/${id}/camp`).then((r) => r.json())).dragon.worn).toEqual([]);
  await page.goto(`/#/p/${id}/dragon`);
  await expect(page.getByTestId('nest-dragon-layer').locator('img.dragon-base')).toBeVisible();
  await expect(page.getByTestId('nest-dragon-layer').locator('img.dragon-overlay')).toHaveCount(0);
});

test('a tinted dragon keeps its pieces in their own colours; the egg keeps them without showing them', async ({ page, request }) => {
  const id = await createProfileApi(request, heroName(test.info().project.name));
  // This hero's camp says: a braise adult wearing Léthé's crown, then an egg wearing it.
  let stage = 'adult';
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage, tint: 'braise', worn: ['lethe-tete'] };
    await route.fulfill({ response: res, json: camp });
  });
  await page.goto(`/#/p/${id}/dragon`);
  const layer = page.getByTestId('nest-dragon-layer');
  await expect(layer.locator('img.dragon-overlay[data-item="lethe-tete"]')).toHaveCSS('filter', 'none');
  await expect(layer.locator('img.dragon-base')).not.toHaveCSS('filter', 'none');
  stage = 'egg';
  await page.reload();
  await expect(layer.locator('img.dragon-base')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');
  await expect(layer.locator('img.dragon-overlay')).toHaveCount(0);
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  await expect(page.getByTestId('dragon-parure')).toContainText("Il portera sa parure dès qu'il sera un jeune dragon.");
  await expect(page.getByTestId('dragon-parure-how')).toHaveText('Hermès vend des parures à son étal, dans le camp.');
});

// SP4 Task 6 review, minor 4 (ruling): only the dragon's layer is a dressed figure; the Pythia and the
// owl stay plain pictures.
test("only the dragon's layer is a figure; the other scene layers stay plain pictures", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  for (const [route, scene] of [
    ['temple', 'delphi'],
    ['tente-parchemins', 'library'],
  ] as const) {
    await page.goto(`/#/p/${id}/${route}`);
    await expectScene(page, scene);
    const layers = page.getByTestId(`scene-${scene}`).locator('.scene-layer');
    await expect(layers.locator('> img.scene-layer-img')).toHaveCount(1);
    await expect(layers.locator('.dragon-figure')).toHaveCount(0);
  }
  await page.goto(`/#/p/${id}/dragon`);
  await expect(page.getByTestId('nest-dragon-layer').locator('.dragon-figure img.dragon-base')).toBeVisible();
});

// SP4 Task 6 review, minor 3: a change the server refuses puts the previous piece back and says why.
test('a refused change of piece puts the previous one back and says why', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  // This hero owns two collars and wears the Hydra's; the server refuses to change it.
  const piece = (item: string, equipped: boolean) => ({
    id: `accessory:${item}`, kind: 'accessory', name: item, desc: '', source: 'stall', granted_at: '2026-08-03T10:00:00', equipped,
  });
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage: 'adult', name: 'Braise', worn: ['hydre-cou'] };
    await route.fulfill({ response: res, json: camp });
  });
  await page.route(`**/api/profiles/${id}/rewards`, (route) => route.fulfill({ json: [piece('hydre-cou', true), piece('sirenes-cou', false)] }));
  let refused = 0;
  await page.route(`**/api/profiles/${id}/rewards/accessory:sirenes-cou`, async (route) => {
    refused += 1;
    await route.fulfill({ status: 409, json: { detail: 'Hermès garde encore ce collier.' } });
  });
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  const care = page.getByTestId('overlay-care');
  await expect(care.getByTestId('parure-hydre-cou')).toHaveAttribute('aria-checked', 'true');
  await tap(care.getByTestId('parure-sirenes-cou'), testInfo);
  await expect(care.getByRole('alert')).toHaveText('Hermès garde encore ce collier.');
  expect(refused).toBe(1);
  await expect(care.getByTestId('parure-hydre-cou')).toHaveAttribute('aria-checked', 'true');
  await expect(care.getByTestId('parure-sirenes-cou')).toHaveAttribute('aria-checked', 'false');
  // The dragon behind the panel wears the Hydra's collar again, not the refused one.
  const layer = page.getByTestId('nest-dragon-layer');
  await expect(layer.locator('img.dragon-overlay[data-item="hydre-cou"]')).toHaveCount(1);
  await expect(layer.locator('img.dragon-overlay[data-item="sirenes-cou"]')).toHaveCount(0);
});

// SP4 Task 8: the pieces owned could not be read. The parure never guesses « nothing owned » (it would
// send to Hermès a hero who owns a collar): it says so, and « Réessayer » brings the pieces.
test('the parure could not read the pieces owned: it says so, and « Réessayer » brings them', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const piece = { id: 'accessory:hydre-cou', kind: 'accessory', name: "Collier d'écailles vertes", desc: '', source: 'stall', granted_at: '2026-08-03T10:00:00', equipped: false };
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage: 'adult', name: 'Braise', worn: [] };
    await route.fulfill({ response: res, json: camp });
  });
  let calls = 0;
  await page.route(`**/api/profiles/${id}/rewards`, async (route) => {
    calls += 1;
    if (calls === 1) await route.abort('failed');
    else await route.fulfill({ json: [piece] });
  });
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  const care = page.getByTestId('overlay-care');
  await expect(care.getByTestId('parure-error')).toHaveText('Une erreur est survenue.');
  await expect(care.getByTestId('dragon-parure-how')).toHaveCount(0);
  await tap(care.getByTestId('parure-retry'), testInfo);
  await expect(care.getByTestId('parure-hydre-cou')).toContainText("Collier d'écailles vertes");
  await expect(care.getByTestId('parure-error')).toHaveCount(0);
  await expect(care.getByTestId('parure-retry')).toHaveCount(0);
  await expect(care.getByTestId('dragon-parure-how')).toHaveCount(0);
  expect(calls).toBe(2);
  await expect(care.getByTestId('parure-cou-rien')).toBeFocused();
});
