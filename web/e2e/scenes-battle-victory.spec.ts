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

async function victory(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  name: string,
  current: string,
  opponent = 'hydre',
  draft = DRAFT,
) {
  const id = await createProfileApi(request, uniqueName(name));
  const text = await createText(request, { title: uniqueName('Victoire'), body: REF, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'results', draft, current, opponent });
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
  // Final review M8: the stage's plaque, the opponent's name, is the battle's one h1.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("L'Hydre");
  // Ruling C6: the sheet unrolls over the dimmed battlefield; the combatants stay lit.
  await expect(page.locator('.battle-backdrop')).toHaveCSS('filter', /brightness\(0\.6\)/);
  await expect(page.getByTestId('battle-opponent').locator('img')).toHaveCSS('filter', 'none');
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
  // A full stop never opens a line: it shares its word's unbreakable run (Task 8 walk).
  const loose = await scroll.locator('.tok.punct').evaluateAll((els) =>
    els.filter((t) => !t.previousElementSibling || getComputedStyle(t.parentElement!).whiteSpace !== 'nowrap').map((t) => t.textContent),
  );
  expect(loose).toEqual([]);
  // Final review M10: a trap says what it is in words, and whether its explanation is open; the
  // other words are text, not buttons that do nothing.
  const trap = scroll.getByRole('button', { name: 'chante : piège, touche pour voir' });
  await expect(trap).toHaveAttribute('aria-expanded', 'false');
  await expect(scroll.getByRole('button', { name: 'fées', exact: true })).toHaveCount(0);
  await expect(scroll.locator('.tokens')).toContainText('Les fées dansent');
  await tap(trap, testInfo);
  await expect(trap).toHaveAttribute('aria-expanded', 'true');
  await expect(scroll.getByTestId('revoir-popover')).toContainText('Attendu : « chantent »');
  await page.reload();
  await expect(page.getByTestId('overlay-revoir')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('overlay-revoir')).toHaveCount(0);
  await expect(page).not.toHaveURL(/panel=revoir/);
  await tap(page.getByTestId('battle-revoir'), testInfo);
  // The scroll opens on the route change, after the tap: wait for it (closeOverlay samples once).
  await expect(page.getByTestId('overlay-revoir')).toBeVisible();
  await closeOverlay(page);
  await expect(page.getByTestId('battle-revoir')).toBeFocused();
});

// Task 8: the scroll is rendered next to the stage (BattleStage's `overlay` snippet), not inside its
// inert <main>: it takes the focus, keeps Tab inside, closes on Escape and hands the focus back, and
// leaves nothing behind when the battle goes.
test('« Revoir » is a real modal: focus inside, Tab trapped, Escape closes, nothing left behind', async ({ page, request }, testInfo) => {
  const { id } = await victory(page, request, `Vic3b-${testInfo.project.name}`, HALF);
  await page.getByTestId('battle-revoir').click();
  const scroll = page.getByTestId('overlay-revoir');
  await expect(scroll).toBeVisible();
  // Outside the stage: the stage is inert, the scroll is not inside it.
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('inert', '');
  expect(await scroll.evaluate((el) => !!el.closest('[data-testid="scene-battle"]'))).toBe(false);
  await expect.poll(() => scroll.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await scroll.evaluate((el) => el.contains(document.activeElement)), `Tab ${i + 1} stays in the scroll`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(scroll).toHaveCount(0);
  await expect(page).not.toHaveURL(/panel=revoir/);
  await expect(page.getByTestId('scene-battle')).not.toHaveAttribute('inert', '');
  await expect(page.getByTestId('battle-revoir')).toBeFocused();
  // Leaving the battle with the scroll open takes the scroll along: the camp is not left inert.
  await page.getByTestId('battle-revoir').click();
  await expect(scroll).toBeVisible();
  await page.evaluate((pid) => (location.hash = `#/p/${pid}/camp`), id);
  await expectCamp(page);
  await expect(page.locator('.overlay-panel')).toHaveCount(0);
  await expect(page.locator('.overlay-backdrop')).toHaveCount(0);
  await expect(page.getByTestId('scene-camp')).not.toHaveAttribute('inert', '');
});

// Final review I2: « Rejouer ce texte » is the same battle again: the same opponent, fresh combatants
// (no held end pose, no hit burst left over) and a full hold.
test('« Rejouer ce texte » replays the same battle: the same opponent, fresh combatants, a full hold', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic9-${testInfo.project.name}`, REF, 'sirenes');
  const stage = page.getByTestId('scene-battle');
  const opponent = page.getByTestId('battle-opponent');
  await expect(opponent).toHaveAttribute('data-reaction', 'defeat');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '0');
  await expect(opponent).toHaveAttribute('data-hits', '2');
  await tap(page.getByTestId('victory-actions').getByRole('button', { name: 'Rejouer ce texte' }), testInfo);
  await expectBattle(page, 'muster');
  await expect(stage).toHaveAttribute('data-opponent', 'sirenes');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '100');
  await expect(opponent).toHaveAttribute('data-reaction', 'taunt');
  await expect(opponent).toHaveAttribute('data-hits', '0');
  await expect(page.locator('.hit-burst')).toHaveCount(0);
  await expect(page.getByTestId('battle-resume')).toHaveCount(0);
  await expect(page.getByTestId('battle-parchment').getByTestId('pace-option-1')).toBeVisible();
});

test('« Recommencer » on the resume ribbon starts the same battle afresh, the draft gone', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Vic10-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Recommencer'), body: REF, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'proofreading', draft: DRAFT, opponent: 'protee' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const opponent = page.getByTestId('battle-opponent');
  await tap(page.getByTestId('battle-resume-restart'), testInfo);
  await expect(page.getByTestId('battle-resume')).toHaveCount(0);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-opponent', 'protee');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '100');
  await expect(opponent).toHaveAttribute('data-reaction', 'taunt');
  await expect(opponent).toHaveAttribute('data-hits', '0');
  const sheet = page.getByTestId('battle-parchment');
  await tap(sheet.getByTestId('pace-option-1'), testInfo);
  await tap(sheet.getByRole('button', { name: 'Commencer la dictée' }), testInfo);
  await expectBattle(page, 'dictation');
  await expect(page.getByTestId('dictation-textarea')).toHaveValue('');
});

// Final review M2: both ways home from the victory leave the battle behind; opening the text again
// never lands on the old sheet.
test('« Le camp » from the victory leaves the battle behind, as « Retour au camp » does', async ({ page, request }, testInfo) => {
  const { id, text } = await victory(page, request, `Vic11-${testInfo.project.name}`, HALF);
  await expect(page.getByTestId('btn-back-camp')).toBeVisible();
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
  await page.evaluate(([pid, tid]) => (location.hash = `#/p/${pid}/play/${tid}`), [id, text.id] as const);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('victory-title')).toHaveCount(0);
  await expect(page.getByTestId('battle-parchment').getByTestId('pace-option-1')).toBeVisible();
});

test('every trap caught routs the lieutenant', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic4-${testInfo.project.name}`, REF);
  await expect(page.getByTestId('victory-title')).toHaveText('Victoire !');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'defeat');
  await expect(page.getByTestId('results-catch-rate')).toContainText('2 sur 2');
});

test('a perfect dictation routs the lieutenant too: nothing to catch, one strike', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic4b-${testInfo.project.name}`, REF, 'hydre', REF);
  await expect(page.getByTestId('results-catch-rate')).toHaveText('Texte parfait dès la dictée !');
  await expect(page.getByTestId('victory-title')).toHaveText('Victoire !');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-hits', '1');
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

test('a failed submission can be sent again from the sheet; the dialogue survives the retry and speaks again after it', async ({ page, request }, testInfo) => {
  let failed = false;
  // The retry is held until the test lets it through, to see the sheet while it is in flight.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/sessions', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    if (!failed) {
      failed = true;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Serveur fatigué' }) });
      return;
    }
    await held;
    await route.continue();
  });
  await victory(page, request, `Vic7-${testInfo.project.name}`, HALF);
  await expect(page.getByTestId('victory')).toContainText("Les Muses n'ont pas pu noter cette partie (Serveur fatigué).");
  // Nothing is pending once the submission failed: Éris and the dragon already speak.
  await expect(page.getByTestId('dialogue-box')).toContainText('Éris');
  await tap(page.getByRole('button', { name: 'Réessayer' }), testInfo);
  // In flight: the Muses count again, and the dialogue stays where it was.
  await expect(page.getByTestId('battle-status')).toBeVisible();
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  release();
  await expect(page.getByTestId('reveal-xp')).toBeVisible();
  await tap(page.getByTestId('reveal-continue'), testInfo);
  // After the spoils the dialogue plays again from Éris's line, with the tally after it.
  await expect(page.getByTestId('dialogue-box')).toContainText('Éris');
  await page.getByTestId('dialogue-advance').click(); // finish typing
  await page.getByTestId('dialogue-advance').click(); // next line
  await expect(page.getByTestId('dialogue-text')).toContainText('Tu as déjoué 1 piège sur 2.');
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
