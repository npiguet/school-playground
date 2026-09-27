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
  LEGACY_UI,
  nextLine,
  redScan,
  seedPlay,
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
  await expect(page.getByTestId('results-score')).toHaveText(/^Gloire gagnée\u202f: \d+$/);
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

// A victory the Muses have already counted (the play state keeps its progression), so the spoils
// show exactly this one: a boss won or lost, a hatch, a rank-up.
function progression(o: Record<string, unknown> = {}) {
  return {
    xp: { session: 51, bonuses: [], total_before: 487, total_after: 538, rank_before: 3, rank_after: 3, title_after: 'Sentinelle des textes' },
    quests: [],
    neutralised: [],
    rewards: [],
    dragon: { stage_before: 'egg', stage_after: 'egg', needs_name: false },
    weekly: { target: 5, done: 1, reached_now: false },
    boss: null,
    encounter: null,
    ...o,
  };
}

async function counted(page: import('@playwright/test').Page, request: import('@playwright/test').APIRequestContext, name: string, p: object, boss = false) {
  const id = await createProfileApi(request, uniqueName(name));
  const text = await createText(request, { title: uniqueName('Compté'), body: REF, level: '10H' });
  await seedPlay(page, {
    profileId: id,
    textId: text.id,
    phase: 'results',
    draft: DRAFT,
    current: boss ? REF : HALF,
    opponent: boss ? 'eris' : 'hydre',
    encounter: boss ? 'eris' : null,
    progression: p,
  });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  return page.getByTestId('victory');
}

// UI4 playability #4: the biggest win of the game - Éris's defeat line, her treasure once, on the
// scroll's own paper, brought into view as it is revealed.
test('beating Éris: her defeat line and her treasure, once, in the parchment style, in view', async ({ page, request }, testInfo) => {
  const sheet = await counted(
    page,
    request,
    `Vic14-${testInfo.project.name}`,
    progression({
      xp: { session: 51, bonuses: [{ reason: 'boss', amount: 300 }], total_before: 487, total_after: 838, rank_before: 3, rank_after: 4, title_after: 'Garde des Parchemins' },
      quests: [{ id: 9, kind: 'boss', target: 'eris', counted: true, progress: 1, goal: 1, completed: true, reward_id: 'sandales_hermes' }],
      rewards: [{ id: 'sandales_hermes', kind: 'gear', name: "Sandales d'Hermès" }],
      boss: { tier: 1, won: true, too_easy: false },
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
  // The whole gain in the headline (+300 for Éris included); the new rank's leaves grow back.
  await expect(sheet.getByTestId('reveal-xp-gain')).toHaveText('+351 XP');
  await expect(sheet.getByTestId('victory-xp')).toContainText('Les feuilles repoussent');
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

test('Éris escaping speaks for herself, on her plate', async ({ page, request }, testInfo) => {
  const sheet = await counted(page, request, `Vic15-${testInfo.project.name}`, progression({ boss: { tier: 1, won: false, too_easy: false }, encounter: 'eris' }), true);
  const boss = sheet.getByTestId('reveal-boss');
  await expect(boss.getByTestId('boss-voice')).toHaveAttribute('data-speaker', 'eris');
  await expect(boss).toContainText("Ha\u202f! Je garde ma pomme… pour cette fois. Le combat reste ouvert\u202f: reviens m'affronter quand tu veux.");
  await expect(sheet.locator('.kit-note[data-tone="eris"]')).toHaveCount(0);
});

// UI4 playability #9: naming the dragon is a question, answered on the parchment's line.
test('the egg hatches: « Comment vas-tu l\'appeler ? », and her answer is inked on a line', async ({ page, request }, testInfo) => {
  const sheet = await counted(page, request, `Vic16-${testInfo.project.name}`, progression({ dragon: { stage_before: 'egg', stage_after: 'hatchling', needs_name: true } }));
  await expect(sheet.getByTestId('reveal-dragon')).toContainText("Comment vas-tu l'appeler\u202f?");
  const field = sheet.getByTestId('reveal-name-input');
  await expect(field).toHaveAttribute('placeholder', 'Son nom…');
  await expect(field).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(field).toHaveCSS('border-top-width', '0px');
  expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(48);
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
  await expect(sheet).toContainText("Un long texte, sans les Yeux d'Argus. Chaque piège que tu trouves reste acquis\u202f: si Éris s'enfuit, tu pourras revenir l'affronter.");
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
  await expect(refusal).toHaveText("Éris ne se montre pas encore. Neutralise d'abord ses lieutenants.");
  await expect(page).toHaveURL(/\/eris$/);
});

// UI5 Ruling E14: four traps in the draft, one caught (the plural of « fées »): 25 %, so Éris answers
// with battle.caught. Then the tally, then the first trap still standing in text order, « dansent ».
const FOUR = 'Les fée danse dans la clairiere. Elles chante et les oiseaux les écoutent.';
const ONE_CAUGHT = 'Les fées danse dans la clairiere. Elles chante et les oiseaux les écoutent.';

test("Éris answers the reckoning from her lines, then the dragon explains a trap still standing (Ruling E14)", async ({ page, request }, testInfo) => {
  await victory(page, request, `Vic14-${testInfo.project.name}`, ONE_CAUGHT, 'hydre', FOUR);
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
