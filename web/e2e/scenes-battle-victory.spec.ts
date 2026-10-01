import { test, expect } from './crashGuard';
import {
  closeOverlay,
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  expectLineOf,
  expectOverlayClearsScene,
  expectOverlayTapTargets,
  installKeyboardSim,
  LEGACY_UI,
  makeResult,
  nextLine,
  postSession,
  redScan,
  seedPlay,
  setKeyboard,
  swissDay,
  tap,
  uniqueName,
} from './helpers';

// UI4 lane V (spec §3 "Results -> Victory overlay", §5): the reckoning on the stage, the victory
// sheet (laurels, XP, the dragon's words), « Revoir », the break nudge, and Éris's lair.
const REF = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const DRAFT = 'Les fées danse dans la clairière. Elles chante et les oiseaux les écoutent.';
const HALF = 'Les fées dansent dans la clairière. Elles chante et les oiseaux les écoutent.';

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
  await expect(page.getByTestId('victory-title')).toHaveText("L'Hydre recule\u202f!");
  await expect(page.getByTestId('victory-laurel')).toBeVisible();
  // Final review M8: the stage's plaque, the opponent's name, is the battle's one h1.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("L'Hydre");
  // Ruling C6: the sheet unrolls over the dimmed battlefield; the combatants stay lit.
  await expect(page.locator('.battle-backdrop')).toHaveCSS('filter', /brightness\(0\.6\)/);
  await expect(page.getByTestId('battle-opponent').locator('img')).toHaveCSS('filter', 'none');
  // UI4 playability #1: the tally in the game's words - no percentage (the rate as rateText wrote
  // it, narrow no-break space and all), no « Score », no « x / y ».
  await expect(page.getByTestId('results-catch-rate')).toHaveText('Pièges déjoués\u202f: 1 sur 2');
  await expect(page.getByTestId('results-copy')).toHaveText('Ta copie\u202f: 1 faute sur 13 mots. Une copie correcte.');
  await expect(page.getByTestId('victory')).toContainText('12 mots sur 13 tiennent bon');
  await expect(page.getByTestId('victory')).not.toContainText(/Score|%|\d\s*\/\s*\d/);
  expect(await page.getByTestId('results-catch-rate').textContent()).not.toContain('50\u202f%');
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
  // UI4 playability #7: one trap left is « le dernier ».
  await expect(page.getByTestId('dialogue-text')).toContainText('Le dernier se cache encore\u202f: on le débusquera ensemble.');
});

// UI4 playability #2, #3, #21: the headline is everything she earned; the laurel is ink on the
// parchment; the actions stay quiet while the spoils and the dialogue lead, then « Revoir » leads.
test('the XP headline is her whole gain, the laurel sits on the paper, and « Revoir » leads once the dragon points to it', async ({ page, request }, testInfo) => {
  const { id, text } = await victory(page, request, `Vic12-${testInfo.project.name}`, HALF);
  const sheet = page.getByTestId('victory');
  await expect(sheet.getByTestId('reveal-xp')).toBeVisible();
  const xp = await page.evaluate(
    ([pid, tid]) => JSON.parse(localStorage.getItem(`discorde.play.${pid}.${tid}`)!).progression.xp,
    [id, text.id] as const,
  );
  await expect(sheet.getByTestId('reveal-xp-gain')).toHaveText(`+${xp.total_after - xp.total_before} XP`);
  const laurel = sheet.getByTestId('victory-xp');
  await expect(laurel).toHaveAttribute('data-surface', 'parchment');
  await expect(laurel).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(laurel).toHaveCSS('box-shadow', 'none');
  const revoir = sheet.getByTestId('battle-revoir');
  await expect(revoir).toHaveClass(/is-quiet/);
  await tap(sheet.getByTestId('reveal-continue'), testInfo);
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await expect(revoir).toHaveClass(/is-quiet/);
  await tap(page.getByTestId('dialogue-skip'), testInfo);
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
  await expect(revoir).not.toHaveClass(/is-quiet/);
});

// UI4 playability #1: a standoff never reads « 0 sur 2 ».
test('nothing caught: the tally says her traps hid, never « 0 sur »', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic13-${testInfo.project.name}`, DRAFT, 'echo');
  await expect(page.getByTestId('results-catch-rate')).toHaveText('Ses pièges se sont bien cachés cette fois');
  await expect(page.getByTestId('victory')).not.toContainText(/0 sur|%/);
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
  // UI4 playability #18: « déjoué » under a wax seal, no tick; her text on grained paper, no white field.
  await expect(scroll.getByTestId('revoir-foiled')).toHaveText('déjoué');
  await expect(scroll.getByTestId('revoir-foiled').locator('.kit-seal')).toBeVisible();
  await expect(scroll.getByTestId('revoir-foiled').locator('svg')).toHaveCount(0);
  await expect(scroll.locator('.review-text')).toHaveCSS('background-image', /url/);
  // A full stop never opens a line: it shares its word's unbreakable run (Task 8 walk).
  const loose = await scroll.locator('.tok.punct').evaluateAll((els) =>
    els.filter((t) => !t.previousElementSibling || getComputedStyle(t.parentElement!).whiteSpace !== 'nowrap').map((t) => t.textContent),
  );
  expect(loose).toEqual([]);
  // Final review M10: a trap says what it is in words, and whether its explanation is open; the
  // other words are text, not buttons that do nothing.
  const trap = scroll.getByRole('button', { name: 'chante\u202f: piège, touche pour voir' });
  await expect(trap).toHaveAttribute('aria-expanded', 'false');
  await expect(scroll.getByRole('button', { name: 'fées', exact: true })).toHaveCount(0);
  await expect(scroll.locator('.tokens')).toContainText('Les fées dansent');
  await tap(trap, testInfo);
  await expect(trap).toHaveAttribute('aria-expanded', 'true');
  // UI4 playability #18: the word it needed, not the corrector's « Attendu ».
  await expect(scroll.getByTestId('revoir-popover')).toContainText('Il fallait\u202f: «\u202fchantent\u202f»');
  await page.reload();
  await expect(page.getByTestId('overlay-revoir')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('overlay-revoir')).toHaveCount(0);
  await expect(page).not.toHaveURL(/panel=revoir/);
  await tap(page.getByTestId('battle-revoir'), testInfo);
  // The scroll opens on the route change, after the tap: closeOverlay waits for it.
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
  await expect(page.getByTestId('victory-title')).toHaveText('Victoire\u202f!');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'defeat');
  await expect(page.getByTestId('results-catch-rate')).toContainText('2 sur 2');
});

test('a perfect dictation routs the lieutenant too: nothing to catch, one strike', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic4b-${testInfo.project.name}`, REF, 'hydre', REF);
  await expect(page.getByTestId('results-catch-rate')).toHaveText('Texte parfait dès la dictée\u202f!');
  await expect(page.getByTestId('victory-title')).toHaveText('Victoire\u202f!');
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

// Final review I1 (spec 2026-09-29: the copy is what counts): the lieutenant answers the copy's
// verdict, never the catch rate. One mistake left on 13 words, nothing caught: 7.7 per 100, a copie
// correcte, so it is pushed back (not still standing).
test('the copy decides: a copie correcte with nothing caught pushes the lieutenant back', async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic5b-${testInfo.project.name}`, HALF, 'hydre', HALF);
  await expect(page.getByTestId('results-copy')).toHaveText('Ta copie\u202f: 1 faute sur 13 mots. Une copie correcte.');
  await expect(page.getByTestId('victory-title')).toHaveText("L'Hydre recule\u202f!");
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '75');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'retreat');
});

// One mistake left on 52 words, nothing caught: 1.9 per 100, a belle copie: the lieutenant is routed.
const LONG = [REF, REF, REF, REF].join(' ');
const LONG_ONE = [REF, REF, REF, HALF].join(' ');
test('the copy decides: a belle copie routs the lieutenant even with nothing caught', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Vic5c-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Belle'), body: LONG, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'results', draft: LONG_ONE, current: LONG_ONE, opponent: 'chimere' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  await expect(page.getByTestId('results-copy')).toHaveText('Ta copie\u202f: 1 faute sur 52 mots. Une belle copie.');
  await expect(page.getByTestId('victory-title')).toHaveText('Victoire\u202f!');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'defeat');
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
  // UI4 playability #16: the egg speaks for itself, and the way home says what it does.
  await expect(nudge).toContainText("(L'œuf frémit.) Vingt-cinq minutes qu'on chasse les pièges… On souffle un peu\u202f?");
  await expect(page.getByTestId('break-pause')).toHaveText('On rentre souffler');
  await tap(page.getByTestId('break-continue'), testInfo);
  await expect(nudge).toHaveCount(0);
  await tap(page.getByTestId('btn-back-camp'), testInfo);
  await expectCamp(page);
});

// Final review I3 (sub-project 3): the victory that shows the egg hatching records it as seen (with
// the session, on the server), so the camp has no « hatched while you were away » to reveal after it.
test('a real hatch on the victory, then the camp: no second reveal', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Vic18-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Éclosion'), body: REF, level: '10H' });
  // 290 words, nothing to catch: 10 + 29 + 58 = 97 XP, still an egg; the battle below hatches it.
  const before = await postSession(request, { profileId: id, textId: text.id, day: '2026-08-03', result: makeResult({ words: 290 }) });
  expect(before.progression.dragon.stage_after).toBe('egg');
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'results', draft: DRAFT, current: HALF, opponent: 'hydre' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  await expect(page.getByTestId('victory').getByTestId('reveal-dragon')).toContainText("L'œuf éclôt\u202f!");
  await tap(page.getByTestId('btn-back-camp'), testInfo);
  await expectCamp(page);
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await expect(page.getByTestId('camp-dragon-reveal')).toHaveCount(0);
  expect((await (await request.get(`/api/profiles/${id}`)).json()).settings.dragon_seen_stage).toBe('hatchling');
  await page.reload();
  await expectCamp(page);
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await expect(page.getByTestId('camp-dragon-reveal')).toHaveCount(0);
});

// The egg hatches: the dragon's block and the gauge's stages agree, as the server's always do.
const HATCH = {
  xp: { session: 51, bonuses: [], total_before: 60, total_after: 111, stage_before: 'egg', stage_after: 'hatchling', floor: 100, next: 1200 },
  dragon: { stage_before: 'egg', stage_after: 'hatchling', needs_name: true },
};

// A victory the Muses have already counted (the play state keeps its progression), so the spoils
// show exactly this one: a boss won or lost, a hatch, a stage change, a seal.
function progression(o: Record<string, unknown> = {}) {
  return {
    xp: { session: 51, bonuses: [], total_before: 487, total_after: 538, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 },
    quests: [],
    levels: [],
    rewards: [],
    dragon: { stage_before: 'hatchling', stage_after: 'hatchling', needs_name: false },
    weekly: { target: 5, done: 1, reached_now: false },
    boss: null,
    encounter: null,
    drachmes: { earned: 12, parts: [{ reason: 'session', amount: 12 }], balance: 40 },
    ...o,
  };
}

async function counted(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  name: string,
  p: object,
  boss = false,
  current = boss ? REF : HALF,
) {
  const id = await createProfileApi(request, uniqueName(name));
  const text = await createText(request, { title: uniqueName('Compté'), body: REF, level: '10H' });
  await seedPlay(page, {
    profileId: id,
    textId: text.id,
    phase: 'results',
    draft: DRAFT,
    current,
    opponent: boss ? 'eris' : 'hydre',
    encounter: boss ? 'eris' : null,
    progression: p,
  });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  return page.getByTestId('victory');
}

// Spec 2026-09-29 drachmes §1 (R15): the victory's chips add the drachmes; a saved victory has none.
test('the victory adds « +12 drachmes » after the XP chips', async ({ page, request }, testInfo) => {
  const sheet = await counted(page, request, `Vic40-${testInfo.project.name}`, progression({}));
  await expect(sheet.getByTestId('drachme-chip')).toHaveText('+12 drachmes');
  await expect(sheet.getByTestId('drachme-chip').locator('img')).toHaveAttribute('src', '/art/icons/drachme.webp');
  const [lastXp, coin] = [await sheet.getByTestId('xp-chip').last().boundingBox(), await sheet.getByTestId('drachme-chip').boundingBox()];
  expect(coin!.x > lastXp!.x || coin!.y > lastXp!.y).toBe(true);
});

test('a victory saved before the drachmes shows no drachme chip', async ({ page, request }, testInfo) => {
  const sheet = await counted(page, request, `Vic41-${testInfo.project.name}`, progression({ drachmes: undefined }));
  await expect(sheet.getByTestId('xp-chip').first()).toBeVisible();
  await expect(sheet.getByTestId('drachme-chip')).toHaveCount(0);
  await expect(sheet).not.toContainText('undefined');
});

// Spec 2026-09-29 §4: the session XP broken down, then the quest's.
test('the XP chips break the session down: text, pace, aids, prophecy, then the quest', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic20-${testInfo.project.name}`,
    progression({
      xp: { session: 94, parts: { text: 57, pace: 8, aids: 13, prophecy: 16 }, bonuses: [{ reason: 'board', amount: 60 }], total_before: 487, total_after: 641, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 },
      quests: [{ id: 3, kind: 'board', target: 'hydre', counted: true, progress: 3, goal: 3, completed: true, reward_id: null }],
    }),
  );
  await expect(sheet.getByTestId('xp-chip')).toHaveText(['Texte +57', 'Rythme +8', 'Sans aides +13', 'Prophétie +16', 'Quête +60']);
});

// One seeded battle per test: seedPlay's init script runs on a new document only, and a second
// page.goto that changes only the hash would open the second battle unseeded (at its muster).
// Final review minor 9: a quest's text that does not count says why, in the camp's voice.
test("a quest's text that does not count says why: too many of its traps left in the copy", async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic23-${testInfo.project.name}`,
    progression({ quests: [{ id: 5, kind: 'board', target: 'hydre', counted: false, reason: 'copy', progress: 1, goal: 3, completed: false, reward_id: null }] }),
  );
  const quest = sheet.getByTestId('reveal-quest-5');
  await expect(quest.getByTestId('quest-reason')).toHaveText("Trop de pièges de l'Hydre restent dans ta copie\u202f: ce texte ne compte pas pour la quête.");
  await expect(quest).toContainText('Ta quête\u202f: 1 / 3');
  await expect(quest).not.toContainText(/raté|manqué|perdu/i);
});

test('a bonus part at zero shows no chip', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic21-${testInfo.project.name}`,
    progression({ xp: { session: 70, parts: { text: 57, pace: 0, aids: 13, prophecy: 0 }, bonuses: [], total_before: 487, total_after: 557, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 } }),
  );
  await expect(sheet.getByTestId('xp-chip')).toHaveText(['Texte +57', 'Sans aides +13']);
});

// Spec 2026-09-29 dragon growth §2: the old stage fills, then the new one shows, « Ton dragon grandit ! ».
test('the dragon grows on the victory: the laurel ends on the new stage, « Ton dragon grandit ! »', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic24-${testInfo.project.name}`,
    progression({
      xp: { session: 51, bonuses: [{ reason: 'board', amount: 60 }], total_before: 1100, total_after: 1211, stage_before: 'hatchling', stage_after: 'young', floor: 1200, next: 5000 },
      dragon: { stage_before: 'hatchling', stage_after: 'young', needs_name: false },
    }),
  );
  const laurel = sheet.getByTestId('victory-xp');
  await expect(laurel).toHaveAttribute('aria-label', 'Jeune dragon');
  await expect(laurel).toHaveAttribute('aria-valuenow', '11');
  await expect(laurel).toHaveAttribute('aria-valuemax', '3800');
  await expect(laurel).toContainText('Ton dragon grandit\u202f!');
  await expect(sheet.getByTestId('reveal-xp-gain')).toHaveText('+111 XP');
  await expect(sheet.getByTestId('reveal-dragon')).toContainText('grandit\u202f: Jeune dragon');
  await expect(sheet).not.toContainText('Nouveau rang');
});

// Reduced motion (UI4 global constraints): the laurel shows the new stage, its values and the note at
// once, with nothing left animating on it.
test('the dragon grows on the victory under reduced motion: the new stage at once, nothing animating', async ({ page, request }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const sheet = await counted(
    page,
    request,
    `Vic26-${testInfo.project.name}`,
    progression({
      xp: { session: 51, bonuses: [{ reason: 'board', amount: 60 }], total_before: 1100, total_after: 1211, stage_before: 'hatchling', stage_after: 'young', floor: 1200, next: 5000 },
      dragon: { stage_before: 'hatchling', stage_after: 'young', needs_name: false },
    }),
  );
  const laurel = sheet.getByTestId('victory-xp');
  await expect(laurel).toBeVisible();
  // Read once, no polling: the final state is there from the first frame the laurel shows.
  const first = await laurel.evaluate((el) => ({
    label: el.getAttribute('aria-label'),
    now: el.getAttribute('aria-valuenow'),
    max: el.getAttribute('aria-valuemax'),
    text: el.textContent ?? '',
    running: el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
  }));
  expect(first).toEqual({ label: 'Jeune dragon', now: '11', max: '3800', text: expect.stringContaining('Ton dragon grandit\u202f!'), running: 0 });
  await expect(sheet.getByTestId('reveal-dragon')).toContainText('grandit\u202f: Jeune dragon');
});

// Review focus 5: a play state saved before the change carries rank fields and no stage fields.
test('a victory saved before the stages resumes on the dragon\'s scale', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic25-${testInfo.project.name}`,
    progression({ xp: { session: 51, bonuses: [], total_before: 487, total_after: 538, rank_before: 3, rank_after: 3, title_after: 'Sentinelle des textes' } }),
  );
  const laurel = sheet.getByTestId('victory-xp');
  await expect(laurel).toHaveAttribute('aria-label', 'Dragonnet');
  await expect(laurel).toHaveAttribute('aria-valuenow', '438');
  await expect(laurel).toHaveAttribute('aria-valuemax', '1100');
  await expect(sheet).not.toContainText(/Sentinelle|undefined|Nouveau rang/);
});

test('a victory saved before the parts keeps its one text chip', async ({ page, request }, testInfo) => {
  const old = await counted(page, request, `Vic22-${testInfo.project.name}`, progression());
  await expect(old.getByTestId('xp-chip')).toHaveText(['Texte +51']);
});

// Spec 2026-09-29 lieutenant levels §5: the seal on the victory, its trophy, its chip.
test('a seal on the victory: « Sceau de bronze ! », its trophy, its chip', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic25-${testInfo.project.name}`,
    progression({
      levels: [{ lieutenant: 'hydre', level: 2, reward_id: 'trophy:hydre:2' }],
      rewards: [{ id: 'trophy:hydre:2', kind: 'trophy', name: "Écaille de l'Hydre en bronze" }],
      xp: { session: 51, bonuses: [{ reason: 'level', amount: 200, lieutenant: 'hydre', level: 2 }], total_before: 487, total_after: 738, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 },
    }),
  );
  const card = sheet.getByTestId('reveal-level-hydre');
  await expect(card).toContainText('Sceau de bronze\u202f!');
  await expect(card).toContainText("Tu poses le sceau de bronze sur l'Hydre. Son trophée t'attend dans ta cabane.");
  await expect(card.getByTestId('reveal-level-trophy')).toHaveAttribute('src', '/art/trophies/trophy-hydre-2.webp');
  await expect(sheet.getByTestId('xp-chip')).toContainText(["Sceau de bronze\u202f: l'Hydre +200"]);
  await expect(sheet.getByTestId('reveal-reward-trophy:hydre:2')).toHaveCount(0); // never twice as « Nouveau trésor »
});

// Two seals won in one victory (two lieutenants, one level each): both cards, both chips.
test('two seals in one victory: both cards and both chips', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic27-${testInfo.project.name}`,
    progression({
      levels: [
        { lieutenant: 'hydre', level: 2, reward_id: 'trophy:hydre:2' },
        { lieutenant: 'echo', level: 1, reward_id: 'trophy:echo:1' },
      ],
      rewards: [
        { id: 'trophy:hydre:2', kind: 'trophy', name: "Écaille de l'Hydre en bronze" },
        { id: 'trophy:echo:1', kind: 'trophy', name: "Voix d'Écho en bois" },
      ],
      xp: {
        session: 51,
        bonuses: [
          { reason: 'level', amount: 200, lieutenant: 'hydre', level: 2 },
          { reason: 'level', amount: 100, lieutenant: 'echo', level: 1 },
        ],
        total_before: 487,
        total_after: 938,
        stage_before: 'hatchling',
        stage_after: 'hatchling',
        floor: 100,
        next: 1200,
      },
    }),
  );
  await expect(sheet.getByTestId('reveal-level-hydre')).toContainText('Sceau de bronze\u202f!');
  await expect(sheet.getByTestId('reveal-level-echo')).toContainText('Sceau de bois\u202f!');
  await expect(sheet.getByTestId('reveal-level-hydre').getByTestId('reveal-level-trophy')).toHaveAttribute('src', '/art/trophies/trophy-hydre-2.webp');
  await expect(sheet.getByTestId('reveal-level-echo').getByTestId('reveal-level-trophy')).toHaveAttribute('src', '/art/trophies/trophy-echo-1.webp');
  await expect(sheet.getByTestId('xp-chip')).toContainText(["Sceau de bronze\u202f: l'Hydre +200", 'Sceau de bois\u202f: Écho +100']);
});

// Review focus 5: a play state saved before the change.
test('a victory saved before the seals shows the first seal', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic26-${testInfo.project.name}`,
    progression({ levels: undefined, neutralised: ['echo'], xp: { session: 51, bonuses: [{ reason: 'mastery', amount: 200 }], total_before: 487, total_after: 738, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 } }),
  );
  await expect(sheet.getByTestId('reveal-level-echo')).toContainText('Sceau de bois\u202f!');
  await expect(sheet.getByTestId('xp-chip')).toContainText(['Premier sceau +200']);
  await expect(sheet).not.toContainText(/undefined|Ruse neutralisée|neutralisée/);
});

// Spec §6: a real seal from seeded stats. Two days of guard against the Hydra before today (the API,
// with the test clock); today's victory, posted by the sheet, is the third.
test('a real seal on the victory, from seeded stats: « Sceau de bois ! » and its chip', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Sceau-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Veille'), body: REF, level: '10H' });
  for (const daysAgo of [2, 1]) {
    await postSession(request, { profileId: id, textId: text.id, day: swissDay(daysAgo), result: makeResult({ draft: 4, caught: 4, category: 'agreement:verb' }) });
  }
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'results', draft: DRAFT, current: REF, opponent: 'hydre' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  const card = page.getByTestId('reveal-level-hydre');
  await expect(card).toContainText('Sceau de bois\u202f!', { timeout: 15_000 });
  await expect(card.getByTestId('reveal-level-trophy')).toHaveAttribute('src', '/art/trophies/trophy-hydre-1.webp');
  await expect(page.getByTestId('xp-chip').filter({ hasText: 'Sceau de bois' })).toHaveText("Sceau de bois\u202f: l'Hydre +100");
});

// UI4 playability #4: the biggest win of the game - Éris's defeat line, her treasure once, on the
// scroll's own paper, brought into view as it is revealed.
test('beating Éris: her defeat line and her treasure, once, in the parchment style, in view', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic14-${testInfo.project.name}`,
    progression({
      xp: { session: 51, bonuses: [{ reason: 'boss', amount: 300 }], total_before: 487, total_after: 838, stage_before: 'hatchling', stage_after: 'hatchling', floor: 100, next: 1200 },
      quests: [{ id: 9, kind: 'boss', target: 'eris', counted: true, progress: 1, goal: 1, completed: true, reward_id: 'sandales_hermes' }],
      rewards: [{ id: 'sandales_hermes', kind: 'gear', name: "Sandales d'Hermès" }],
      boss: { tier: 1, won: true },
      encounter: 'eris',
    }),
    true,
  );
  // UI4 Task A: the painted chest crowns the sheet in place of the laurel wreath once a reward waits.
  await expect(sheet.getByTestId('victory-chest')).toBeVisible();
  const boss = sheet.getByTestId('reveal-boss');
  await expect(boss).toBeVisible();
  await expect(boss.getByTestId('boss-voice')).toContainText('Impossible\u202f! Garde ta pomme');
  await expect(boss.getByTestId('reveal-boss-reward')).toHaveText("Ta récompense\u202f: Sandales d'Hermès\u202f!");
  expect(((await sheet.textContent()) ?? '').split("Sandales d'Hermès").length - 1, 'the treasure is named once').toBe(1);
  await expect(sheet.getByTestId('reveal-reward-sandales_hermes')).toHaveCount(0);
  await expect(sheet.locator('.kit-cubby')).toHaveCount(0);
  await expect(boss).toHaveClass(/kit-sheet/);
  // The whole gain in the headline (+300 for Éris included).
  await expect(sheet.getByTestId('reveal-xp-gain')).toHaveText('+351 XP');
  // The climax is not left below the fold: the block scrolls into the sheet's view.
  await expect
    .poll(() =>
      boss.evaluate((el) => {
        const body = el.closest('.sheet-body')!.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return r.top >= body.top - 1 && r.bottom <= body.bottom + 1;
      }),
    )
    .toBe(true);
});

// Final review I1: the fight is won or lost by the server's verdict on the copy, and the hold agrees
// with it: a won fight with nothing caught still empties the bar, and Éris takes the defeat pose.
test('a won fight against Éris empties her hold even with nothing caught', async ({ page, request }, testInfo) => {
  const sheet = await counted(page, request, `Vic15b-${testInfo.project.name}`, progression({ boss: { tier: 1, won: true }, encounter: 'eris' }), true, DRAFT);
  await expect(sheet.getByTestId('results-catch-rate')).toHaveText('Ses pièges se sont bien cachés cette fois');
  await expect(page.getByTestId('victory-title')).toHaveText('Victoire\u202f!');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'defeat');
});

test('Éris escaping speaks for herself, on her plate', async ({ page, request }, testInfo) => {
  const sheet = await counted(page, request, `Vic15-${testInfo.project.name}`, progression({ boss: { tier: 1, won: false }, encounter: 'eris' }), true);
  // Final review I1: a lost fight keeps her hold above zero, even with every trap caught.
  await expect(page.getByTestId('victory-title')).toHaveText('Le combat continue');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'taunt');
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '25');
  const boss = sheet.getByTestId('reveal-boss');
  await expect(boss.getByTestId('boss-voice')).toHaveAttribute('data-speaker', 'eris');
  await expect(boss).toContainText("Ha\u202f! Je garde ma pomme… pour cette fois. Le combat reste ouvert\u202f: reviens m'affronter quand tu veux.");
  await expect(sheet.locator('.kit-note[data-tone="eris"]')).toHaveCount(0);
});

// UI4 playability #9: naming the dragon is a question, answered on the parchment's line.
test('the egg hatches: « Comment vas-tu l\'appeler ? », and her answer is inked on a line', async ({ page, request }, testInfo) => {
  const sheet = await counted(page, request, `Vic16-${testInfo.project.name}`, progression(HATCH));
  await expect(sheet.getByTestId('reveal-dragon')).toContainText("Comment vas-tu l'appeler\u202f?");
  const field = sheet.getByTestId('reveal-name-input');
  await expect(field).toHaveAttribute('placeholder', 'Son nom…');
  await expect(field).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(field).toHaveCSS('border-top-width', '0px');
  expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(48);
});

// iPad report 2026-09-28: no text box of the game lies under the on-screen keyboard; the dragon's
// name is written on the victory sheet, which folds with the stage (Ruling C4).
test('the egg hatches under the keyboard: her dragon\'s name line stays above it', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  const sheet = await counted(page, request, `Vic17-${testInfo.project.name}`, progression(HATCH));
  const field = sheet.getByTestId('reveal-name-input');
  await field.click();
  const band = await setKeyboard(page, Math.round((await page.evaluate(() => window.innerHeight)) * 0.45));
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await expect
    .poll(async () => {
      const b = (await field.boundingBox())!;
      return b.y >= band.top - 1 && b.y + b.height <= band.bottom + 1;
    }, 'the name line above the keyboard')
    .toBe(true);
  await expect(field).toBeFocused();
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
  await expect(sheet).toContainText("Un long texte. Si ta copie garde 4 fautes au plus pour 100 mots, Éris s'enfuit\u202f; sinon, tu pourras revenir l'affronter.");
  // UI4 playability #14: the « Combat I » banner above her plate, and the parchment hugs its content,
  // centred, so her lair shows around it.
  const tierBox = (await sheet.getByTestId('boss-tier').boundingBox())!;
  const voiceBox = (await sheet.getByTestId('battle-voice').boundingBox())!;
  expect(tierBox.y + tierBox.height).toBeLessThanOrEqual(voiceBox.y + 1);
  expect(parseFloat(await sheet.getByTestId('boss-tier').evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(28);
  const hug = await sheet.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const stage = el.closest('[data-testid="scene-battle"]')!.getBoundingClientRect();
    const muster = el.firstElementChild as HTMLElement;
    return { h: r.height, stage: stage.height, fits: muster.scrollHeight <= muster.clientHeight + 1 };
  });
  expect(hug.fits, 'nothing scrolls: the parchment holds its content').toBe(true);
  expect(hug.h, 'the parchment is no taller than its content').toBeLessThan(hug.stage * 0.8);
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
  await expect(refusal).toHaveText("Éris ne se montre pas encore. Gagne d'abord d'autres sceaux sur ses lieutenants.");
  await expect(page).toHaveURL(/\/eris$/);
});

// UI5 Ruling E14: four traps in the draft, one caught (the plural of « fées »): three left on 13
// words is a copie à reprendre, and with one caught Éris answers with battle.caught. Then the tally, then the first trap still standing in text order, « dansent ».
const FOUR = 'Les fée danse dans la clairiere. Elles chante et les oiseaux les écoutent.';
const ONE_CAUGHT = 'Les fées danse dans la clairiere. Elles chante et les oiseaux les écoutent.';

test("Éris answers the reckoning from her lines, then the dragon explains a trap still standing (Ruling E14)", async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic18-${testInfo.project.name}`, ONE_CAUGHT, 'hydre', FOUR);
  await expect(page.getByTestId('results-catch-rate')).toHaveText('Pièges déjoués\u202f: 1 sur 4');
  await tap(page.getByTestId('reveal-continue'), testInfo);
  const dialogue = page.getByTestId('victory-dialogue');
  await expectLineOf(dialogue.getByTestId('dialogue-box'), 'battle.caught');
  await expect(dialogue.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'eris');
  await nextLine(page); // the tally
  await expect(dialogue.getByTestId('dialogue-text')).toContainText('Tu as déjoué 1 piège sur 4.');
  await nextLine(page);
  await expectLineOf(dialogue.getByTestId('dialogue-box'), 'battle.explain', { word: 'dansent' });
  await expect(dialogue.getByTestId('dialogue-box')).toHaveAttribute('data-speaker', 'dragon');
  await nextLine(page);
  // UI5 playability #4: the same explanation « Revoir » shows on tap, in the dragon's spoken form:
  // whole sentences, never the card's arrows.
  await expect(dialogue.getByTestId('dialogue-text')).toContainText("Le sujet, ici, c'est «\u202fLes fées\u202f». Il est au pluriel");
  await expect(dialogue.getByTestId('dialogue-text')).toContainText('«\u202fdansent\u202f».');
  await expect(dialogue.getByTestId('dialogue-text')).not.toContainText('→');
  await expect(dialogue.getByTestId('dialogue-box')).not.toHaveAttribute('data-key', /./);
});
