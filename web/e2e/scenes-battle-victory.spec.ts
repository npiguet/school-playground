import { test, expect } from './crashGuard';
import {
  closeOverlay,
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  expectOverlayClearsScene,
  expectOverlayTapTargets,
  LEGACY_UI,
  redScan,
  seedPlay,
  stubSpeech,
  tap,
  uniqueName,
} from './helpers';

// UI4 lane V (spec §3 "Results -> Victory overlay", §5): the reckoning on the stage, the victory
// sheet (laurels, XP, the dragon's words), « Revoir », the break nudge, and Éris's lair.
const REF = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const DRAFT = 'Les fées danse dans la clairière. Elles chante et les oiseaux les écoutent.';
const HALF = 'Les fées dansent dans la clairière. Elles chante et les oiseaux les écoutent.';

test.beforeEach(async ({ page }) => stubSpeech(page));

async function victory(page: import('@playwright/test').Page, request: import('@playwright/test').APIRequestContext, name: string, current: string, opponent = 'hydre') {
  const id = await createProfileApi(request, uniqueName(name));
  const text = await createText(request, { title: uniqueName('Victoire'), body: REF, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'results', draft: DRAFT, current, opponent });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  return { id, text };
}

test('the reckoning strikes once per trap caught, then the lieutenant falls back', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic-${testInfo.project.name}`, HALF);
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '50');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-hits', '1');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'retreat');
  await expect(page.getByTestId('battle-dragon')).toHaveAttribute('data-reaction', 'cheer');
  await expect(page.getByTestId('victory-title')).toHaveText("L'Hydre recule !");
  await expect(page.getByTestId('victory-laurel')).toBeVisible();
  await expect(page.getByTestId('results-catch-rate')).toContainText('1 sur 2');
  // A narrow no-break space before « % » (rateText), read from the DOM as happy-path does.
  expect(await page.getByTestId('results-catch-rate').textContent()).toContain('50 %');
});

test('the sheet: spoils, then « Continuer » lets Éris and the dragon speak; the actions are there throughout', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic2-${testInfo.project.name}`, HALF);
  const sheet = page.getByTestId('victory');
  await expect(sheet.getByTestId('reveal-xp')).toBeVisible();
  await expect(sheet.getByTestId('victory-xp')).toHaveAttribute('role', 'progressbar');
  await expect(sheet.getByTestId('victory-actions').getByTestId('btn-back-camp')).toBeVisible();
  await expect(sheet.locator(LEGACY_UI)).toHaveCount(0);
  await expectOverlayTapTargets(page, 'battle-parchment');
  expect(await redScan(page)).toEqual([]);
  await tap(sheet.getByTestId('reveal-continue'), testInfo);
  await expect(sheet.getByTestId('reveal-xp')).toHaveCount(0);
  const box = page.getByTestId('dialogue-box');
  await expect(box).toContainText('Éris');
  await page.getByTestId('dialogue-advance').click(); // finish typing
  await page.getByTestId('dialogue-advance').click(); // next line
  await expect(page.getByTestId('dialogue-text')).toContainText('Tu as déjoué 1 piège sur 2.');
});

test('« Revoir » opens the review scroll: each trap explained on tap; Back and reload keep it honest', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic3-${testInfo.project.name}`, HALF);
  await tap(page.getByTestId('battle-revoir'), testInfo);
  await expect(page).toHaveURL(/panel=revoir/);
  // expectInWorldOverlay's parts, minus its 48 px sweep: the scroll's words are inline targets.
  const scroll = page.getByTestId('overlay-revoir');
  await expect(scroll).toHaveAttribute('data-variant', 'scroll');
  await expectOverlayClearsScene(page, 'overlay-revoir', 'battle', true);
  await expect(scroll.locator(LEGACY_UI)).toHaveCount(0);
  await expect(scroll.getByTestId('overlay-voice')).toHaveCount(0);
  await expect(scroll.getByTestId('overlay-close')).toBeVisible();
  expect(await redScan(page)).toEqual([]);
  await expect(scroll.getByRole('heading', { name: "Ce qu'Éris a tenté" })).toBeVisible();
  await tap(scroll.getByRole('button', { name: 'chante', exact: true }), testInfo);
  await expect(scroll.getByTestId('revoir-popover')).toContainText('Attendu : « chantent »');
  await page.reload();
  await expect(page.getByTestId('overlay-revoir')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('overlay-revoir')).toHaveCount(0);
  await expect(page).not.toHaveURL(/panel=revoir/);
  await tap(page.getByTestId('battle-revoir'), testInfo);
  await closeOverlay(page);
  await expect(page.getByTestId('battle-revoir')).toBeFocused();
});

test('every trap caught routs the lieutenant; a perfect dictation too', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic4-${testInfo.project.name}`, REF);
  await expect(page.getByTestId('victory-title')).toHaveText('Victoire !');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'defeat');
});

test('nothing caught: still standing, still laurels, never a loss', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic5-${testInfo.project.name}`, DRAFT, 'sirenes');
  await expect(page.getByTestId('victory-title')).toHaveText('Le combat continue');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'taunt');
  await expect(page.getByTestId('victory-laurel')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/manqué|raté|perdu/i);
});

test('reduced motion: the hold and the laurels land at once', async ({ page, request }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await victory(page, request, `Vic6-${testInfo.project.name}`, HALF);
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '50');
  await expect.poll(() => page.getByTestId('victory-laurel').evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length)).toBe(0);
});

test('a failed submission can be sent again from the sheet', async ({ page, request }, testInfo) => {
  let failed = false;
  await page.route('**/api/sessions', async (route) => {
    if (!failed && route.request().method() === 'POST') {
      failed = true;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Serveur fatigué' }) });
    } else await route.continue();
  });
  await victory(page, request, `Vic7-${testInfo.project.name}`, HALF);
  await expect(page.getByTestId('victory')).toContainText("Les Muses n'ont pas pu noter cette partie (Serveur fatigué).");
  await tap(page.getByRole('button', { name: 'Réessayer' }), testInfo);
  await expect(page.getByTestId('reveal-xp')).toBeVisible();
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('after twenty-five minutes the dragon suggests a pause, on the sheet', async ({ page, request }, testInfo) => {
  await page.addInitScript(
    (seed) => sessionStorage.setItem(seed.key, seed.value),
    { key: 'discorde.playClock', value: JSON.stringify({ activeMs: 26 * 60000, running: false, lastTick: null, lastStop: Date.now() }) },
  );
  await victory(page, request, `Vic8-${testInfo.project.name}`, HALF);
  const nudge = page.getByTestId('break-nudge');
  await expect(nudge).toContainText("ça fait vingt-cinq minutes qu'on chasse les pièges");
  await tap(page.getByTestId('break-continue'), testInfo);
  await expect(nudge).toHaveCount(0);
  await tap(page.getByTestId('btn-back-camp'), testInfo);
  await expectCamp(page);
});

test("Éris's lair: her challenge, the fight's stakes and the rules on the parchment", async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Lair-${testInfo.project.name}`));
  await page.goto(`/#/p/${id}/eris`);
  await expectBattle(page, 'muster');
  const stage = page.getByTestId('scene-battle');
  await expect(stage).toHaveAttribute('data-backdrop', 'lair');
  await expect(stage).toHaveAttribute('data-opponent', 'eris');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByTestId('battle-voice')).toHaveAttribute('data-speaker', 'eris');
  await expect(sheet.getByTestId('battle-voice')).toContainText('Voyons si mes pièges tiennent');
  await expect(sheet.getByTestId('boss-tier')).toHaveText('Combat I');
  await expect(sheet.getByTestId('boss-reward')).toContainText('Récompense si tu gagnes');
  await expect(sheet.getByTestId('boss-start')).toHaveText('Affronter Éris');
  await expect(sheet.locator(LEGACY_UI)).toHaveCount(0);
  await expectOverlayTapTargets(page, 'battle-parchment');
  expect(await redScan(page)).toEqual([]);
});

test('a fight Éris refuses says why, in her colour, and nothing is lost', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Lair2-${testInfo.project.name}`));
  await page.goto(`/#/p/${id}/eris`);
  await expectBattle(page, 'muster');
  await tap(page.getByTestId('boss-start'), testInfo);
  const refusal = page.getByTestId('battle-parchment').locator('.kit-note[data-tone="eris"][role="alert"]');
  await expect(refusal).toBeVisible();
  // A fresh hero has no tier open: the server's 409 (routers/world.py BOSS_MESSAGE), word for word.
  await expect(refusal).toHaveText("Éris ne se montre pas encore. Neutralise d'abord ses lieutenants.");
  await expect(page).toHaveURL(/\/eris$/);
});
