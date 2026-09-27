import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { test, expect } from './crashGuard';
import {
  audioState,
  battleRects,
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  expectLineOf,
  expectOverlayTapTargets,
  installKeyboardSim,
  LEGACY_UI,
  redScan,
  resumeSeeded,
  seedPlay,
  setKeyboard,
  spokenLines,
  tap,
  uniqueName,
  visibleBand,
} from './helpers';

// UI4 lane P (spec §5): the muster, the dictation and the proofreading on the battle stage, their
// compact layout under the simulated keyboard, and the long text's legibility.
const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';

test('the muster is an order of battle: Éris taunts, four pace medallions, no school metadata', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Muster'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=hydre`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByTestId('battle-voice')).toHaveAttribute('data-speaker', 'eris');
  await expect(sheet.getByTestId('battle-voice')).toContainText('Hydre');
  await expect(sheet.getByTestId('muster-words')).toHaveText('13 mots');
  await expect(sheet).not.toContainText(/\b\d{1,2}H\b|≈/);
  await expect(sheet.getByRole('radio')).toHaveCount(4);
  await expect(sheet.getByTestId('pace-option-3')).toContainText("D'un bon pas");
  await expect(sheet.getByTestId('pace-option-4')).toContainText("D'une traite");
  await expect(sheet.getByText('Plus le rythme est vif, plus la gloire est grande.')).toBeVisible();
  await expect(sheet.locator(LEGACY_UI)).toHaveCount(0);
  await expectOverlayTapTargets(page, 'battle-parchment');
  expect(await redScan(page)).toEqual([]);
  await tap(sheet.getByTestId('pace-option-2'), testInfo);
  await expect(sheet.getByTestId('pace-option-2').locator('input')).toBeChecked();
  await tap(sheet.getByRole('button', { name: 'Commencer la dictée' }), testInfo);
  await expectBattle(page, 'dictation');
});

test('a boss dictation locks the slower paces and says why', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus2-${testInfo.project.name}`), '10H');
  const text = await createText(request, { title: uniqueName('Muster boss'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=eris&quest=1`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByTestId('play-boss-banner')).toHaveText("Combat contre Éris\u202f: les Yeux d'Argus restent éteints.");
  await expect(sheet.getByTestId('play-quest-banner')).toHaveText('Ce texte compte pour ta quête.');
  await expect(sheet.locator('[data-testid^="pace-option-"].disabled').first()).toContainText('Pas pendant un combat');
});

test('a seeded dictation comes back behind the resume ribbon', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus3-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Muster reprise'), body: BODY, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'dictation', draft: 'Les fées' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-resume')).toContainText("Ton brouillon t'attend là où tu l'avais laissé.");
  await resumeSeeded(page);
  await expectBattle(page, 'dictation');
  await expect(page.getByTestId('dictation-textarea')).toHaveValue('Les fées');
});

// Final review M1: the break clock counts the dictation and the proofreading only; a saved one
// waiting behind the resume ribbon is on the muster, and the clock rests.
test('the break clock rests behind the resume ribbon and runs once the dictation is back', async ({ page, request }, testInfo) => {
  await page.clock.install();
  const id = await createProfileApi(request, uniqueName(`Mus6-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Horloge'), body: BODY, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'dictation', draft: 'Les fées' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-resume')).toBeVisible();
  const activeMs = () =>
    page.evaluate(() => {
      const raw = sessionStorage.getItem('discorde.playClock');
      return raw ? (JSON.parse(raw) as { activeMs: number }).activeMs : 0;
    });
  for (let i = 0; i < 3; i++) await page.clock.fastForward(20_000);
  expect(await activeMs(), 'no play time behind the ribbon').toBe(0);
  await resumeSeeded(page);
  await expectBattle(page, 'dictation');
  for (let i = 0; i < 3; i++) await page.clock.fastForward(20_000);
  await expect.poll(activeMs, 'the dictation counts').toBeGreaterThan(0);
});

// Final review M3: « Revoir » lives in the victory; a link to it anywhere else drops the panel
// (keeping the rest of the query), so it never pops open over a later reckoning.
test('a « Revoir » link outside the victory drops its panel', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus7-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Revoir trop tôt'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=hydre&panel=revoir`);
  await expectBattle(page, 'muster');
  await expect(page).not.toHaveURL(/panel=revoir/);
  await expect(page).toHaveURL(/encounter=hydre/);
  await expect(page.getByTestId('overlay-revoir')).toHaveCount(0);
});

// Task 2 fix round 1 #3: a free text's opponent comes from this visit's own /camp answer, never from
// the snapshot the camp left in memory (a lieutenant may have woken or been neutralised since). The
// camp's snapshot here offers Protée only; the fresh answer, held back, offers Léthé only.
test('a free text waits for the fresh camp before choosing its opponent', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus5-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Camp frais'), body: BODY, level: '10H' });
  let only = 'protee';
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let held = false;
  let served = 0;
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    const pick = only;
    for (const l of json.lieutenants) {
      l.available = l.key === pick;
      l.stirring = l.key === pick;
      l.neutralised = false;
    }
    if (pick === 'lethe') {
      held = true;
      await gate;
    }
    await route.fulfill({ response: res, json });
    served += 1;
  });
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect.poll(() => served, 'the camp holds its (stale) snapshot').toBeGreaterThanOrEqual(1);
  only = 'lethe';
  await page.evaluate((hash) => (location.hash = hash), `#/p/${id}/play/${text.id}`);
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByRole('heading', { name: text.title })).toBeVisible();
  await expect.poll(() => held).toBe(true);
  // The muster is up and the fresh camp still on its way: no opponent yet, the stale one never.
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-opponent', '');
  release();
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-opponent', 'lethe');
});

test('the grimoire muster: Éris guards it, and a text too short for her says so', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus4-${testInfo.project.name}`));
  // The server takes 5 words at least; 6 tokens hold at most 2 plants 3 tokens apart (corrupt.py's
  // MIN_GAP), under the 3 Éris needs, so the corruption is always refused.
  const tiny = await createText(request, { title: uniqueName('Oui'), body: 'Oui oui oui oui oui.', level: '10H' });
  await page.goto(`/#/p/${id}/grimoire/${tiny.id}`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByRole('heading', { name: 'Grimoire corrompu' })).toBeVisible();
  // UI5 Ruling E14: one of her battle.start lines, a grimoire one.
  await expectLineOf(sheet.getByTestId('battle-voice'), 'battle.start');
  await tap(sheet.getByTestId('btn-open-grimoire'), testInfo);
  await expect(sheet.locator('.kit-note[data-tone="eris"]')).toBeVisible();
  await expect(sheet.getByTestId('btn-back-library')).toHaveText('Retour aux parchemins');
});

test('Éris opens the muster from her lines, and a replay from her retry lines', async ({ page, request }, testInfo) => {
  // A grimoire muster: battle.start in its grimoire variants (Ruling E14).
  const id = await createProfileApi(request, uniqueName(`Mus5-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Rejouer'), body: BODY, level: '10H' });
  // The same text's free battle, already won (seeded at the first load: the next hop is a hash change).
  const DRAFT = 'Les fées danse dans la clairière. Elles chante et les oiseaux les écoutent.';
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'results', draft: DRAFT, current: BODY, opponent: 'hydre' });
  await page.goto(`/#/p/${id}/grimoire/${text.id}`);
  await expectBattle(page, 'muster');
  await expectLineOf(page.getByTestId('battle-voice'), 'battle.start');
  // That battle's « Rejouer ce texte »: her retry line at the next muster.
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  await tap(page.getByTestId('victory-actions').getByRole('button', { name: 'Rejouer ce texte' }), testInfo);
  await expectBattle(page, 'muster');
  await expectLineOf(page.getByTestId('battle-voice'), 'battle.retry');
  await expect(page.getByTestId('battle-voice')).toHaveAttribute('data-speaker', 'eris');
});

test('the muster says when the voice is muted, and gives it back (Ruling E7)', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus6-${testInfo.project.name}`));
  await request.patch(`/api/profiles/${id}`, {
    data: { settings: { audio: { music: { volume: 0.5, muted: false }, sfx: { volume: 0.7, muted: false }, voice: { volume: 1, muted: true } } } },
  });
  const text = await createText(request, { title: uniqueName('Sourdine'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const note = page.getByTestId('battle-voice-muted');
  await expect(note).toContainText('La voix de la Pythie est en sourdine.');
  // The mixer holds the hero's muted voice (Ruling E10's snapshot)...
  await expect.poll(async () => (await audioState(page))?.settings.voice.muted).toBe(true);
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().endsWith(`/api/profiles/${id}`));
  await tap(page.getByTestId('battle-voice-unmute'), testInfo);
  await expect(note).toHaveCount(0);
  // ...and hears « Rendre la voix ».
  await expect.poll(async () => (await audioState(page))?.settings.voice).toEqual({ volume: 1, muted: false });
  // Saved on the hero, like the lyre's toggle.
  await saved;
  const hero = await (await request.get(`/api/profiles/${id}`)).json();
  expect(hero.settings.audio.voice).toMatchObject({ muted: false, volume: 1 });
});

// ===== Task 4: the dictation =====
const LONG = Array.from({ length: 8 }, () => 'Les fées dansent dans la clairière et les oiseaux les écoutent en silence.').join(' ');

async function startDictation(page: Page, testInfo: TestInfo, pace: 1 | 2 | 3 | 4 = 1) {
  const sheet = page.getByTestId('battle-parchment');
  await tap(sheet.getByTestId(`pace-option-${pace}`), testInfo);
  await tap(sheet.getByRole('button', { name: 'Commencer la dictée' }), testInfo);
  await expectBattle(page, 'dictation');
}

test('the dictation writes on the parchment, in Literata, with bronze controls', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=lethe`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo);
  const ta = page.getByTestId('dictation-textarea');
  await expect(ta).toBeVisible();
  // UI4 playability #11: the battle is the text's (its title), the phase told in the fiction, and the
  // rulings in the parchment's sepia.
  await expect(page.getByTestId('battle-parchment').getByRole('heading', { name: text.title })).toBeVisible();
  // Voice playability #9: the voice is the Pythia's, as the waiting line and Éris's card say.
  await expect(page.getByTestId('battle-parchment')).toContainText('Écris ce que dit la Pythie.');
  await expect(page.getByTestId('battle-parchment').getByRole('heading', { name: 'Dictée', exact: true })).toHaveCount(0);
  await expect(ta).toHaveCSS('background-image', /rgba\(92, 64, 24, 0\.14\)/);
  const font = await ta.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, size: parseFloat(cs.fontSize), line: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) };
  });
  expect(font.family).toContain('Literata');
  expect(font.size).toBeGreaterThanOrEqual(22);
  expect(font.line).toBeGreaterThanOrEqual(1.8);
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.");
  await expect(page.getByTestId('battle-parchment').locator(LEGACY_UI)).toHaveCount(0);
  await expectOverlayTapTargets(page, 'battle-parchment');
  await expect(page.locator('[data-testid="scene-battle"] [data-testid="stage-hud"] *')).toHaveCount(0);
  expect(await redScan(page)).toEqual([]);
  // Final review M14: while she writes, nothing moves behind the text: no particles, no breathing.
  await expect(page.locator('[data-testid="scene-battle"] [data-testid="fx-canvas"]')).toHaveCount(0);
  for (const c of ['battle-dragon', 'battle-opponent']) {
    await expect.poll(() => page.getByTestId(c).evaluate((el) => el.getAnimations({ subtree: true }).length), c).toBe(0);
  }
});

// Voice playability #12: a long title wraps; « Phrase 0 sur 2 » stays on one line beside it.
test('a long title wraps, the progress never does', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic12-${testInfo.project.name}`));
  const title = uniqueName('Le très long voyage du petit renard roux à travers la grande forêt');
  const text = await createText(request, { title, body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo);
  const heading = page.getByTestId('battle-parchment').getByRole('heading', { name: title });
  const progress = page.getByTestId('dictation-progress');
  await expect(progress).toHaveText(/^Phrase \d sur 2$/);
  // The line boxes of the element's text: one client rect per line.
  const lines = (el: HTMLElement | SVGElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set(Array.from(range.getClientRects(), (r) => Math.round(r.top))).size;
  };
  expect(await heading.evaluate(lines)).toBeGreaterThanOrEqual(2);
  expect(await progress.evaluate(lines)).toBe(1);
});

// Parity: « Réécouter » counts down at pace 2; « Pause » and « Reprendre » drive a flowing pace.
test('replay counts down at pace 2; pause and resume a flowing pace', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  const id = await createProfileApi(request, uniqueName(`Dic6-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée rythmes'), body: LONG, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo, 2);
  const replay = page.getByTestId('btn-replay');
  await expect(replay).toBeEnabled();
  await expect(replay).toContainText('(3)');
  const before = (await spokenLines(page)).length;
  await tap(replay, testInfo);
  await expect(replay).toContainText('(2)');
  await expect.poll(async () => (await spokenLines(page)).length).toBeGreaterThan(before);
  const flowing = await createText(request, { title: uniqueName('Dictée pause'), body: LONG, level: '10H' });
  await page.goto(`/#/p/${id}/play/${flowing.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo, 3);
  await expect(page.getByTestId('btn-pause')).toBeEnabled();
  await tap(page.getByTestId('btn-pause'), testInfo);
  await expect(page.getByTestId('dictation-status')).toHaveText('En pause.');
  // Under the keyboard the pause stays in sight, in the compact bar (fix round 1 #5).
  const inner = await page.evaluate(() => window.innerHeight);
  await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await expect(page.getByTestId('bar-status')).toBeVisible();
  await expect(page.getByTestId('bar-status')).toHaveText('En pause.');
  await setKeyboard(page, 0);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'full');
  const paused = (await spokenLines(page)).length;
  await tap(page.getByTestId('btn-resume'), testInfo);
  await expect(page.getByTestId('dictation-status')).toHaveText('Écoute…');
  await expect.poll(async () => (await spokenLines(page)).length).toBeGreaterThan(paused);
});

// Spec §10: the compact layout with a simulated keyboard. The stage becomes a band above the
// parchment and stays visible; the textarea and every control stay above the keyboard. Final review
// I3: once more with the visual viewport panned down (iOS scrolling a low field into view), where
// the stage must follow it (`top: var(--vv-top)`); every check is against the band really visible.
for (const pan of [0, 120]) {
  test(`the keyboard folds the dictation: band above, textarea and controls above the keyboard (pan ${pan})`, async ({ page, request }, testInfo) => {
    await installKeyboardSim(page);
    const id = await createProfileApi(request, uniqueName(`Dic2-${testInfo.project.name}`));
    const text = await createText(request, { title: uniqueName('Dictée clavier'), body: LONG, level: '10H' });
    await page.goto(`/#/p/${id}/play/${text.id}?encounter=hydre`);
    await expectBattle(page, 'muster');
    await startDictation(page, testInfo);
    const ta = page.getByTestId('dictation-textarea');
    await tap(ta, testInfo);
    const inner = await page.evaluate(() => window.innerHeight);
    const view = await setKeyboard(page, inner - 420, pan);
    expect(view).toEqual({ top: pan, bottom: pan + 420 });
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
    await expect.poll(async () => (await battleRects(page)).scene?.height ?? 0).toBeLessThanOrEqual(104);
    // The stage follows the pan: its band starts at the top of what is visible.
    await expect.poll(async () => Math.round((await battleRects(page)).scene?.y ?? -1)).toBe(pan);
    const r = await battleRects(page);
    const bandBottom = r.scene!.y + r.scene!.height;
    for (const part of ['dragon', 'opponent', 'hp'] as const) {
      const b = r[part]!;
      expect(b.height, `${part} still visible in the band`).toBeGreaterThan(20);
      expect(b.y, `${part} inside the band`).toBeGreaterThanOrEqual(view.top - 1);
      expect(b.y + b.height, `${part} inside the band`).toBeLessThanOrEqual(bandBottom + 1);
    }
    const box = (await ta.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(bandBottom - 1);
    expect(box.y + box.height).toBeLessThanOrEqual(view.bottom);
    expect(box.height).toBeGreaterThanOrEqual(150);
    const buttons = await page.getByTestId('battle-parchment').getByRole('button').all();
    expect(buttons.length, 'Quitter, Réécouter, Suivant').toBeGreaterThanOrEqual(3);
    for (const b of buttons) {
      const bb = (await b.boundingBox())!;
      expect(bb.height).toBeGreaterThanOrEqual(48);
      expect(bb.width).toBeGreaterThanOrEqual(48);
      expect(bb.y).toBeGreaterThanOrEqual(bandBottom - 1);
      expect(bb.y + bb.height).toBeLessThanOrEqual(view.bottom);
    }
    await ta.fill(LONG + ' ' + LONG);
    await expect(ta).toBeFocused();
    // The caret line (at the end) stays in view: the textarea scrolled to its bottom.
    expect(await ta.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2)).toBe(true);
    await setKeyboard(page, 0);
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'full');
    await expect.poll(async () => (await battleRects(page)).opponent?.height ?? 0).toBeGreaterThan(150);
    await expect.poll(async () => Math.round((await battleRects(page)).scene?.y ?? -1)).toBe(0);
  });
}

test('a short window folds the dictation too (spec §10: reduced viewport height)', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic3-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée courte'), body: BODY, level: '10H' });
  const size = page.viewportSize()!;
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo);
  await page.setViewportSize({ width: size.width, height: 440 });
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  const box = (await page.getByTestId('dictation-textarea').boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual((await visibleBand(page)).bottom + 1);
  await page.setViewportSize(size);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'full');
});

test('Quitter asks first, then shows the resume ribbon with the draft kept', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic4-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée quitter'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo);
  await page.getByTestId('dictation-textarea').fill('Les fées');
  await tap(page.getByTestId('btn-quit-dictation'), testInfo);
  await expect(page.getByText('Ton brouillon est gardé. Veux-tu vraiment quitter la dictée\u202f?')).toBeVisible();
  // Final review M9: the confirm takes the focus, on its first answer.
  await expect(page.getByTestId('btn-quit-confirm')).toBeFocused();
  await tap(page.getByTestId('btn-quit-confirm'), testInfo);
  await expect(page.getByTestId('battle-resume')).toBeVisible();
  await resumeSeeded(page);
  await expect(page.getByTestId('dictation-textarea')).toHaveValue('Les fées');
});

// Pace-bug report 2026-09-27, open item 1: « Continuer » resumes at the saved pace, so the ribbon names
// it. A 10H hero's muster preselects « D'un bon pas »: the ribbon must say the pace she really chose.
test('the resume ribbon names the pace the dictation was saved at, and « Recommencer » offers them all', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic8-${testInfo.project.name}`), '10H');
  const text = await createText(request, { title: uniqueName('Dictée rythme'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo, 1);
  await tap(page.getByTestId('btn-quit-dictation'), testInfo);
  await tap(page.getByTestId('btn-quit-confirm'), testInfo);
  await expect(page.getByTestId('battle-resume-continue')).toHaveText('Continuer — Pas à pas');
  // She comes back later: the same ribbon, the same pace named.
  await page.reload();
  await expectBattle(page, 'muster');
  const ribbon = page.getByTestId('battle-resume');
  await expect(ribbon).toContainText("Ton brouillon t'attend là où tu l'avais laissé.");
  await expect(page.getByTestId('battle-resume-continue')).toHaveText('Continuer — Pas à pas');
  // « Recommencer » is the way to another pace: the medallions are back, at the level's default.
  await tap(page.getByTestId('battle-resume-restart'), testInfo);
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByRole('radio')).toHaveCount(4);
  await expect(sheet.getByTestId('pace-option-3').locator('input')).toBeChecked();
});

test('a saved grimoire names no pace on its ribbon: it has none', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic9-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Grimoire rythme'), body: BODY, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, mode: 'grimoire', phase: 'proofreading', draft: BODY, opponent: 'eris' });
  await page.goto(`/#/p/${id}/grimoire/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-resume-continue')).toHaveText('Continuer');
});

// Ruling M20: a dictation left and resumed reads again the sentence it had reached, not the first.
test('a resumed dictation restarts at the sentence it had reached', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic7-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée reprise'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo, 1);
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await tap(page.getByTestId('btn-next'), testInfo);
  // The second sentence is read, and the play state keeps where the reading is (debounced save).
  await expect.poll(async () => (await spokenLines(page)).at(-1)?.text ?? '').toContain('Elles chantent');
  const key = `discorde.play.${id}.${text.id}`;
  await expect.poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').dictationStep, key)).toBe(2);
  await tap(page.getByTestId('btn-quit-dictation'), testInfo);
  await tap(page.getByTestId('btn-quit-confirm'), testInfo);
  await expect(page.getByTestId('battle-resume')).toBeVisible();
  // The first words read after `from`.
  const firstReadFrom = async (from: number) => (await spokenLines(page)).slice(from)[0]?.text ?? '';
  const heard = (await spokenLines(page)).length;
  await resumeSeeded(page);
  await expectBattle(page, 'dictation');
  await expect.poll(() => firstReadFrom(heard), 'the resumed reading starts on the second sentence').toContain('Elles chantent');
  await expect(page.getByTestId('battle-parchment')).toContainText('Phrase 2 sur 2');
  // And after a reload, from the saved state alone.
  await page.reload();
  await expectBattle(page, 'muster');
  const again = (await spokenLines(page)).length;
  await resumeSeeded(page);
  await expect.poll(() => firstReadFrom(again)).toContain('Elles chantent');
});

// Closing item 1: a resumed dictation must not get its « Réécouter » back - M20 used to save only
// the reading position, so a reload refilled the count.
test('a resumed dictation keeps its reduced replay count', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic9-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée réécoute'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo, 2);
  await expect(page.getByTestId('btn-replay')).toBeEnabled();
  await expect(page.getByTestId('btn-replay')).toContainText('(3)');
  await tap(page.getByTestId('btn-replay'), testInfo);
  await expect(page.getByTestId('btn-replay')).toContainText('(2)');
  const key = `discorde.play.${id}.${text.id}`;
  await expect
    .poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}').dictationReplaysLeft, key))
    .toBe(2);
  await page.reload();
  await expectBattle(page, 'muster');
  await resumeSeeded(page);
  await expectBattle(page, 'dictation');
  await expect(page.getByTestId('btn-replay')).toContainText('(2)');
});

// Ruling C11: a flowing dictation (pace 3) pauses when the iPad turns to portrait, and waits.
test('turning to portrait pauses a flowing dictation until « Reprendre »', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic5-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée portrait'), body: LONG, level: '10H' });
  const size = page.viewportSize()!;
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo, 3);
  await expect(page.getByTestId('dictation-status')).toHaveText('Écoute…');
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
  // The rotate screen is CSS (a media query): it shows before the page's resize event runs. The
  // dictation pauses on that event, behind the rotate screen, and stays paused once turned back.
  await expect(page.getByTestId('dictation-status')).toHaveText('En pause.');
  await page.setViewportSize(size);
  await expect(page.getByTestId('rotate-screen')).toBeHidden();
  await expect(page.getByTestId('dictation-status')).toHaveText('En pause.');
  const spoken = (await spokenLines(page)).length;
  await tap(page.getByTestId('btn-resume'), testInfo);
  await expect.poll(async () => (await spokenLines(page)).length).toBeGreaterThan(spoken);
});

// Final review I1: a hidden page (another app, the iPad locked) suspends the voice; a flowing
// dictation pauses as in portrait, and waits for her tap once the page is back.
test('hiding the page pauses a flowing dictation until « Reprendre »', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic6-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée cachée'), body: LONG, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo, 4);
  await expect(page.getByTestId('dictation-status')).toHaveText('Écoute…');
  const hide = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await hide(true);
  await expect(page.getByTestId('dictation-status')).toHaveText('En pause.');
  const spoken = (await spokenLines(page)).length;
  await hide(false);
  await expect(page.getByTestId('dictation-status')).toHaveText('En pause.');
  expect((await spokenLines(page)).length).toBe(spoken);
  await tap(page.getByTestId('btn-resume'), testInfo);
  await expect.poll(async () => (await spokenLines(page)).length).toBeGreaterThan(spoken);
  await expect(page.getByTestId('dictation-status')).toHaveText('Écoute…');
});

// ===== Task 5: the proofreading =====
// ~300 words: a long proofreading text (legibility beats décor, spec §5).
const SENTENCES = [
  'Les fées dansent dans la clairière pendant que la lune se lève.',
  'Elles chantent doucement et les oiseaux les écoutent sans bruit.',
  'Le vent emporte leurs chansons jusqu’au village endormi.',
  'Les enfants sortent de leurs maisons, émerveillés par la musique.',
  'La nuit est douce et les étoiles brillent au-dessus des arbres.',
];
const LONG_REF = Array.from({ length: 24 }, (_, i) => SENTENCES[i % SENTENCES.length]).join(' ');
const LONG_DRAFT = LONG_REF.replace('Les fées dansent', 'Les fées danse').replace(/La nuit est douce(?![\s\S]*La nuit est douce)/, 'La nuit et douce');

async function seededProof(page: Page, request: APIRequestContext, testInfo: TestInfo, help: 1 | 2 | 3 | 4) {
  const id = await createProfileApi(request, uniqueName(`Pro-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Relecture longue'), body: LONG_REF, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'proofreading', draft: LONG_DRAFT, opponent: 'chimere' });
  await page.goto(`/#/p/${id}/play/${text.id}?help=${help}`);
  await expectBattle(page, 'muster');
  await resumeSeeded(page);
  await expectBattle(page, 'proofreading');
  return { id, text };
}

/** How many lines of text are really in sight: the text zone's content box, clipped by the
 *  scrolling proofreading column and by the top of the (simulated) keyboard, over the line box. */
async function visibleLines(page: Page): Promise<number> {
  return page.getByTestId('proof-text').evaluate((el) => {
    const p = el.querySelector('.tokens, textarea') as HTMLElement;
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const contentTop = box.top + el.clientTop + parseFloat(cs.paddingTop);
    const contentBottom = box.top + el.clientTop + el.clientHeight - parseFloat(cs.paddingBottom);
    const column = (el.closest('.proof') as HTMLElement).getBoundingClientRect();
    const vv = window.visualViewport;
    const keyboardTop = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const top = Math.max(contentTop, column.top, vv?.offsetTop ?? 0);
    const bottom = Math.min(contentBottom, column.bottom, keyboardTop);
    return Math.max(0, bottom - top) / parseFloat(getComputedStyle(p).lineHeight);
  });
}

test('a long proofreading text reads comfortably: size, measure, height, an opaque page, a quiet stage', async ({ page, request }, testInfo) => {
  await seededProof(page, request, testInfo, 4);
  const zone = page.getByTestId('proof-text');
  const m = await zone.evaluate((el) => {
    const p = el.querySelector('.tokens') as HTMLElement;
    const cs = getComputedStyle(p);
    const size = parseFloat(cs.fontSize);
    return {
      family: cs.fontFamily,
      size,
      line: parseFloat(cs.lineHeight) / size,
      measure: p.getBoundingClientRect().width / size,
      height: el.getBoundingClientRect().height / window.innerHeight,
      bg: getComputedStyle(el).backgroundColor,
    };
  });
  expect(m.family).toContain('Literata');
  expect(m.size).toBeGreaterThanOrEqual(22);
  expect(m.line).toBeGreaterThanOrEqual(1.8);
  expect(m.measure, 'column width in font sizes (~44-72 characters)').toBeGreaterThanOrEqual(22);
  expect(m.measure).toBeLessThanOrEqual(36);
  expect(m.height, 'the text zone takes most of the screen').toBeGreaterThanOrEqual(0.55);
  // A word is a button, an atomic inline box: its own height sets the row (Task 8 walk). The rows
  // are the line height (1.8-1.9 font sizes, the ~44 px tap row), not taller.
  const rows = await zone.evaluate((el) => {
    const tops = [...new Set(Array.from(el.querySelectorAll<HTMLElement>('.tok')).map((t) => Math.round(t.getBoundingClientRect().top)))].sort((a, b) => a - b);
    const size = parseFloat(getComputedStyle(el.querySelector('.tokens')!).fontSize);
    return { pitch: (tops[5] - tops[0]) / 5 / size, tap: el.querySelector<HTMLElement>('.tok')!.getBoundingClientRect().height };
  });
  expect(rows.pitch, 'row pitch in font sizes').toBeLessThanOrEqual(2);
  expect(rows.tap, 'a word is still a ~44 px tap row').toBeGreaterThanOrEqual(41);
  // Final review M7: its tap area is 44 px all the same (an invisible band a little taller than the
  // row): a finger just above the first word still lands on it.
  const hit = await zone.evaluate((el) => {
    const first = el.querySelector<HTMLElement>('.tok')!;
    const r = first.getBoundingClientRect();
    const band = parseFloat(getComputedStyle(first, '::after').height);
    const above = document.elementFromPoint(r.left + r.width / 2, r.top - 0.8);
    return { band, above: above === first };
  });
  expect(hit.band, 'the tap band of a word (px)').toBeGreaterThanOrEqual(44);
  expect(hit.above, 'a tap just above the first word lands on it').toBe(true);
  const alpha = Number(/rgba?\([^)]*?,\s*([\d.]+)\)$/.exec(m.bg)?.[1] ?? '1');
  expect(alpha).toBeGreaterThanOrEqual(0.94);
  await expect(page.locator('.battle-backdrop')).toHaveCSS('filter', /brightness\(0\.7\)/);
  await expect.poll(() => page.getByTestId('battle-opponent').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator('[data-testid="scene-battle"] [data-testid="fx-canvas"]')).toHaveCount(0);
  await expect(page.getByTestId('battle-parchment').locator(LEGACY_UI)).toHaveCount(0);
  // The words of the text are inline targets (see Global Constraints, Accessibility): the 48 px
  // sweep covers the tools and the footer, not the tokens.
  await expectOverlayTapTargets(page, 'proof-tools');
  await expectOverlayTapTargets(page, 'proof-foot');
  expect(await redScan(page)).toEqual([]);
  // French typography (the lane V review): no gap before a full stop or a comma.
  const { gaps, orphans, loose } = await zone.evaluate((el) => {
    const toks = Array.from(el.querySelectorAll<HTMLElement>('.tok'));
    const out = { gaps: [] as number[], orphans: [] as string[], loose: [] as string[] };
    toks.forEach((t, i) => {
      if (i > 0 && /^[.,]$/.test(t.textContent ?? '')) {
        const prev = toks[i - 1].getClientRects();
        const cur = t.getClientRects();
        if (prev.length && cur.length && Math.abs(prev[prev.length - 1].top - cur[0].top) < 2) {
          out.gaps.push(cur[0].left - prev[prev.length - 1].right);
        } else out.orphans.push(`${toks[i - 1].textContent}${t.textContent}`);
        // Task 8 walk: a full stop once opened a line. It shares its word's unbreakable run.
        if (t.previousElementSibling !== toks[i - 1] || getComputedStyle(t.parentElement!).whiteSpace !== 'nowrap') {
          out.loose.push(`${toks[i - 1].textContent}${t.textContent}`);
        }
      }
    });
    return out;
  });
  expect(gaps.length).toBeGreaterThan(0);
  for (const g of gaps) expect(g, 'gap before « . » or « , » (px)').toBeLessThanOrEqual(0.5);
  expect(orphans, 'a full stop or a comma never opens a line').toEqual([]);
  expect(loose, 'a full stop or a comma is glued to its word').toEqual([]);
});

test('the Argus passes and the four tools work from their painted controls; the hold never grades', async ({ page, request }, testInfo) => {
  await seededProof(page, request, testInfo, 1);
  const hp = page.getByTestId('battle-hp');
  await expect(hp).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByTestId('argus-pass-verbes')).toHaveAttribute('aria-pressed', 'true');
  // The four tools sit on one row (fix round 1 #7), at 1180 (ipad) and 1280 (desktop).
  const tops = await page.getByTestId('proof-tools').getByRole('button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tops).toHaveLength(4);
  expect(new Set(tops).size, 'the tools on one row').toBe(1);
  // Ruling U4-c: the spotlight steps the other words back in ink, never in opacity.
  const dim = page.locator('[data-testid^="tok-"].dim').first();
  await expect(dim).toHaveCSS('color', 'rgb(102, 97, 90)');
  await expect(dim).toHaveCSS('opacity', '1');
  // UI4 playability #12: a lit word paints its glyphs' band only, so lit rows never touch.
  await expect(page.locator('[data-testid^="tok-"].lit').first()).toHaveCSS('background-image', /linear-gradient/);
  await tap(page.getByTestId('btn-next-pass'), testInfo);
  await expect(page.getByTestId('argus-pass-verbes')).not.toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('battle-dragon')).toHaveAttribute('data-reaction', 'cheer');
  // UI4 playability #19: the owl's hints on its coin in the full layout too, never in brackets.
  await expect(page.getByTestId('chouette-count')).toHaveText('3');
  await expect(page.getByTestId('btn-chouette')).not.toContainText('(');
  await expect(page.getByTestId('btn-chouette')).toHaveAccessibleName(/^Chouette d'Athéna ?, 3 indices$/);
  await tap(page.getByTestId('btn-chouette'), testInfo);
  await expect(page.getByTestId('chouette-note')).toContainText(/chouette|manque/i);
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'flinch');
  await expect(page.getByTestId('chouette-count')).toHaveText('2');
  // UI4 playability #6: the Bouclier walks from the last sentence up, in text order, with the
  // directions named as on the page, and says once why it starts at the bottom.
  await tap(page.getByTestId('btn-bouclier'), testInfo);
  await expect(page.getByTestId('btn-bouclier')).toHaveAttribute('aria-pressed', 'true');
  const pos = page.getByTestId('sentence-pos');
  await expect(pos).toHaveText('Phrase 24 sur 24');
  await expect(page.getByTestId('bouclier-note')).toHaveText('Le Bouclier de Persée te fait lire à rebours, de la dernière phrase à la première.');
  await expect(page.getByTestId('btn-sentence-up')).toHaveText('Plus haut');
  await expect(page.getByTestId('btn-sentence-down')).toHaveText('Plus bas');
  await expect(page.getByTestId('btn-sentence-down')).toBeDisabled();
  expect(await pos.evaluate((el) => el.getClientRects().length), 'the position on one line').toBe(1);
  const sizes = await page.getByTestId('proof-text').evaluate((el) => {
    const p = el.querySelector('.tokens') as HTMLElement;
    return { spot: parseFloat(getComputedStyle(p).fontSize), zone: el.getBoundingClientRect(), p: p.getBoundingClientRect() };
  });
  expect(sizes.spot, 'the one sentence is set larger').toBeGreaterThanOrEqual(22 * 1.15 - 0.5);
  expect(Math.abs(sizes.p.top - sizes.zone.top - (sizes.zone.bottom - sizes.p.bottom)), 'centred in the page').toBeLessThanOrEqual(24);
  await tap(page.getByTestId('btn-sentence-up'), testInfo);
  await expect(pos).toHaveText('Phrase 23 sur 24');
  await expect(page.getByTestId('bouclier-note')).toHaveCount(0);
  await expect(page.getByTestId('btn-sentence-down')).toBeEnabled();
  await tap(page.getByTestId('btn-bouclier'), testInfo);
  await tap(page.getByTestId('btn-fil'), testInfo);
  await expect(page.getByTestId('btn-fil')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('fil-message')).toContainText('Touche un verbe');
  await tap(page.getByTestId('btn-fil-exit'), testInfo);
  await expect(page.getByTestId('fil-message')).toHaveCount(0);
  // An edit never grades on the stage (Ruling C3): the hold stays full and the opponent unmoved; the
  // dragon gives every change the same nod, a fix or a new slip alike (UI4 playability #20).
  await expect(page.getByTestId('battle-dragon')).not.toHaveAttribute('data-reaction', 'brace');
  await tap(page.locator('[data-testid^="tok-"]', { hasText: /^danse$/ }).first(), testInfo);
  // The editor's hint is in the foot, not under the word (UI4 playability #5).
  await expect(page.getByTestId('proof-foot').getByTestId('editor-hint')).toHaveText('Efface tout pour retirer le mot');
  await page.getByTestId('word-editor').fill('dansent');
  await page.getByTestId('word-editor').press('Enter');
  await expect(page.locator('[data-testid^="tok-"]', { hasText: /^dansent$/ }).first()).toBeVisible();
  await expect(hp).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByTestId('battle-opponent')).toHaveAttribute('data-reaction', 'flinch');
  await expect(page.getByTestId('battle-dragon')).toHaveAttribute('data-reaction', 'brace');
  await expect(page.getByTestId('editor-hint')).toHaveCount(0);
});

// UI4 playability #8: the fight against Éris has no side door; a lieutenant's grimoire stays hers.
test('the boss muster offers no way out of the fight; a lieutenant muster keeps its encounter into the grimoire', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mus8-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Porte'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=eris&quest=1`);
  await expectBattle(page, 'muster');
  const sheet = page.getByTestId('battle-parchment');
  await expect(sheet.getByRole('button', { name: 'Commencer la dictée' })).toBeVisible();
  await expect(sheet.getByTestId('btn-grimoire')).toHaveCount(0);
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=hydre`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-opponent', 'hydre');
  await tap(sheet.getByTestId('btn-grimoire'), testInfo);
  await expect(page).toHaveURL(new RegExp(`/grimoire/${text.id}\\?encounter=hydre$`));
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-opponent', 'hydre');
});

test('help stage 3 notches the hold with the count it already shows', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  await seededProof(page, request, testInfo, 3);
  await expect(page.getByText('2 pièges sont cachés dans ce texte.')).toBeVisible();
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('data-segments', '2');
  // The compact bar keeps the count, short (fix round 1 #6).
  const inner = await page.evaluate(() => window.innerHeight);
  await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await expect(page.getByTestId('bar-count')).toHaveText('2 pièges');
});

// Fix round 1 #1: with the Bouclier, the Fil and the owl all open under the keyboard, the bar and
// one line of notes leave four lines of text in sight; the passes go back as well as forward.
test('all three notes open under the keyboard still leave four lines of text', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  await seededProof(page, request, testInfo, 1);
  await tap(page.getByTestId('btn-chouette'), testInfo);
  await tap(page.getByTestId('btn-bouclier'), testInfo);
  await tap(page.getByTestId('btn-fil'), testInfo);
  await expect(page.getByTestId('fil-message')).toBeVisible();
  const inner = await page.evaluate(() => window.innerHeight);
  const view = await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  const r = await battleRects(page);
  const bandBottom = r.scene!.y + r.scene!.height;
  await expect(page.getByTestId('fil-message')).toBeVisible();
  await expect(page.getByTestId('chouette-note')).toBeVisible();
  await expect(page.getByTestId('bar-sentence-pos')).toContainText(/\d+\/\d+/);
  expect(await visibleLines(page), 'lines of text in view above the keyboard').toBeGreaterThanOrEqual(4);
  for (const b of await page.getByTestId('battle-parchment').getByRole('button').all()) {
    if (!(await b.isVisible())) continue;
    const bb = (await b.boundingBox())!;
    if (bb.y > view.bottom) continue; // a token of the text below the fold scrolls, it is not a control
    if ((await b.getAttribute('data-testid'))?.startsWith('tok-')) continue;
    expect(Math.min(bb.width, bb.height)).toBeGreaterThanOrEqual(48);
    expect(bb.y).toBeGreaterThanOrEqual(bandBottom - 1);
    expect(bb.y + bb.height).toBeLessThanOrEqual(view.bottom);
  }
  // Compact icons carry a hover title; the owl's count reads large and dark on its disc.
  await expect(page.getByTestId('btn-fil')).toHaveAttribute('title', "Fil d'Ariane");
  const count = page.getByTestId('chouette-count');
  await expect(count).toHaveText('2');
  expect(parseFloat(await count.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  // The passes step forward and back from the bar.
  await expect(page.getByTestId('bar-pass')).toHaveText('Verbes');
  await expect(page.getByTestId('btn-prev-pass')).toBeDisabled();
  await tap(page.getByTestId('btn-next-pass'), testInfo);
  await expect(page.getByTestId('bar-pass')).not.toHaveText('Verbes');
  await tap(page.getByTestId('btn-prev-pass'), testInfo);
  await expect(page.getByTestId('bar-pass')).toHaveText('Verbes');
  // Final review M11: once a thread is drawn (the Bouclier's last sentence: « Les enfants
  // sortent… »), the Fil's follow-up hint stays in the one-line note, as in the full layout.
  const words = page.getByTestId('proof-text');
  await tap(words.locator('[data-testid^="tok-"]', { hasText: /^sortent$/ }), testInfo);
  await tap(words.locator('[data-testid^="tok-"]', { hasText: /^enfants$/ }), testInfo);
  await expect(page.getByTestId('fil-next')).toHaveCount(1);
  await expect(page.getByTestId('fil-next')).toContainText('sortent');
});

// Spec §10: editing a word near the end of a long text with the keyboard open; once more with the
// visual viewport panned down, as iOS does for a word low on the page (final review I3).
for (const pan of [0, 120]) {
  test(`the keyboard folds the proofreading: the word editor stays above it, the band stays visible (pan ${pan})`, async ({ page, request }, testInfo) => {
    await installKeyboardSim(page);
    await seededProof(page, request, testInfo, 1);
    // The owl's note stays in compact: a note and the bar and four lines must all fit.
    await tap(page.getByTestId('btn-chouette'), testInfo);
    await expect(page.getByTestId('chouette-note')).toBeVisible();
    const tokens = page.locator('[data-testid^="tok-"]');
    const last = tokens.nth((await tokens.count()) - 4);
    await last.scrollIntoViewIfNeeded();
    await tap(last, testInfo);
    const editor = page.getByTestId('word-editor');
    await expect(editor).toBeFocused();
    const inner = await page.evaluate(() => window.innerHeight);
    const view = await setKeyboard(page, inner - 420, pan);
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
    // The stage follows the pan: its band starts at the top of what is visible.
    await expect.poll(async () => Math.round((await battleRects(page)).scene?.y ?? -1)).toBe(pan);
    const r = await battleRects(page);
    const bandBottom = r.scene!.y + r.scene!.height;
    expect(r.opponent!.height).toBeGreaterThan(20);
    expect(r.opponent!.y).toBeGreaterThanOrEqual(view.top - 1);
    await expect
      .poll(async () => {
        const b = (await editor.boundingBox())!;
        return b.y >= bandBottom - 1 && b.y + b.height <= view.bottom;
      })
      .toBe(true);
    // The Task 2 review: the compact proofreading must keep the text readable, not one line of it.
    expect(await visibleLines(page), 'lines of text in view above the keyboard').toBeGreaterThanOrEqual(4);
    // Every control moved into the one bar, at 48 px, above the keyboard (the parity map).
    for (const id of ['btn-quit-proof', 'btn-next-pass', 'btn-bouclier', 'btn-chouette', 'btn-fil', 'btn-whole', 'btn-done-proofreading']) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(Math.min(b.width, b.height), id).toBeGreaterThanOrEqual(48);
      expect(b.y, `${id} below the band, not scrolled away`).toBeGreaterThanOrEqual(bandBottom - 1);
      expect(b.y + b.height, id).toBeLessThanOrEqual(view.bottom);
    }
    await editor.fill('arbres');
    await editor.press('Enter');
    await expect(editor).toHaveCount(0);
    await setKeyboard(page, 0);
    await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'full');
  });
}

// UI4 playability #5: with the keyboard up, the editor lies over its line (no row moves), the text
// scrolls by whole lines (the top line is never cut in half under the bar), and the editor's hint
// takes the count's place in the bar. Scrolled to a mid-line offset first, so the snap is exercised.
test('editing a word under the keyboard: no row moves, the top line is whole, the hint is in the bar', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  await seededProof(page, request, testInfo, 3);
  const inner = await page.evaluate(() => window.innerHeight);
  const view = await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await expect(page.getByTestId('bar-count')).toBeVisible();
  const zone = page.getByTestId('proof-text');
  // Rows, as offsets from the text's top (scrolling moves none of them).
  const rows = () =>
    zone.evaluate((el) => {
      const top = el.querySelector('.tokens')!.getBoundingClientRect().top;
      const tops = Array.from(el.querySelectorAll<HTMLElement>('.tok')).map((t) => Math.round(t.getBoundingClientRect().top - top));
      return [...new Set(tops)].sort((a, b) => a - b);
    });
  // The top line: whole, never under the zone's top edge.
  const topLineWhole = () =>
    zone.evaluate((el) => {
      const pitch = parseFloat(getComputedStyle(el.querySelector('.tokens')!).lineHeight);
      const visTop = el.getBoundingClientRect().top + el.clientTop;
      const lineTops = Array.from(el.querySelectorAll<HTMLElement>('.tok')).map((t) => {
        const r = t.getBoundingClientRect();
        return (r.top + r.bottom) / 2 - pitch / 2;
      });
      const shown = lineTops.filter((t) => t + pitch > visTop + 1);
      return Math.min(...shown) >= visTop - 1;
    });
  await zone.evaluate((el) => (el.scrollTop = 3.5 * parseFloat(getComputedStyle(el.querySelector('.tokens')!).lineHeight)));
  expect(await topLineWhole(), 'the setup starts on a half-cut line').toBe(false);
  const target = await zone.evaluate((el) => {
    const z = el.getBoundingClientRect();
    const tok = Array.from(el.querySelectorAll<HTMLElement>('[data-testid^="tok-"]')).find((t) => {
      const r = t.getBoundingClientRect();
      return r.top > z.top + z.height * 0.4 && r.bottom < z.bottom - 8 && (t.textContent ?? '').length > 3;
    });
    return tok!.dataset.testid!;
  });
  const before = await rows();
  await tap(page.getByTestId(target), testInfo);
  const editor = page.getByTestId('word-editor');
  await expect(editor).toBeFocused();
  expect(await rows(), 'no row moved for the editor').toEqual(before);
  await expect.poll(topLineWhole, 'the top line is whole once the editor is placed').toBe(true);
  const eb = (await editor.boundingBox())!;
  const zb = (await zone.boundingBox())!;
  expect(eb.y).toBeGreaterThanOrEqual(zb.y - 8);
  expect(eb.y + eb.height).toBeLessThanOrEqual(Math.min(zb.y + zb.height, view.bottom) + 8);
  await expect(page.getByTestId('editor-hint')).toHaveText('Efface tout pour retirer le mot');
  await expect(page.getByTestId('bar-count')).toHaveCount(0);
  const hint = (await page.getByTestId('editor-hint').boundingBox())!;
  expect(hint.y + hint.height, 'the hint is in the bar, above the text').toBeLessThanOrEqual(zb.y);
  await editor.press('Escape');
  await expect(editor).toHaveCount(0);
  await expect(page.getByTestId('bar-count')).toBeVisible();
  expect(await visibleLines(page)).toBeGreaterThanOrEqual(4);
});

// UI4 playability #13: in compact, the lines stay near 80 characters (the full layout keeps 44-72).
test('compact lines stay near 80 characters', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  await seededProof(page, request, testInfo, 4);
  const inner = await page.evaluate(() => window.innerHeight);
  await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  const longest = await page.getByTestId('proof-text').evaluate((el) => {
    const byRow = new Map<number, string>();
    for (const t of Array.from(el.querySelectorAll<HTMLElement>('.tok'))) {
      const row = Math.round(t.getBoundingClientRect().top);
      byRow.set(row, (byRow.get(row) ?? '') + ' ' + t.textContent);
    }
    return Math.max(...[...byRow.values()].map((s) => s.trim().length));
  });
  expect(longest, 'characters on the longest line').toBeLessThanOrEqual(85);
});

test('« Modifier tout le texte » folds under the keyboard too', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  await seededProof(page, request, testInfo, 4);
  await tap(page.getByTestId('btn-whole'), testInfo);
  const ta = page.getByLabel('Tout le texte');
  await tap(ta, testInfo);
  const inner = await page.evaluate(() => window.innerHeight);
  const view = await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  const b = (await ta.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(view.bottom);
  expect(b.height).toBeGreaterThanOrEqual(150);
  expect(await visibleLines(page)).toBeGreaterThanOrEqual(4);
});

test('the proofreading has a way out: Quitter asks, then the resume ribbon keeps everything', async ({ page, request }, testInfo) => {
  const { text } = await seededProof(page, request, testInfo, 4);
  // UI4 playability #11: the text's title heads the proofreading; stage 4 asks her to say so.
  await expect(page.getByTestId('battle-parchment').getByRole('heading', { name: text.title })).toBeVisible();
  await expect(page.getByTestId('battle-parchment')).toContainText("Traque les pièges d'Éris. À toi de jouer. Quand tout te semble juste, dis-le.");
  await tap(page.getByTestId('btn-quit-proof'), testInfo);
  await expect(page.getByText('Ta relecture est gardée. Veux-tu vraiment quitter\u202f?')).toBeVisible();
  await expect(page.getByTestId('btn-quit-proof-confirm')).toBeFocused();
  await tap(page.getByTestId('btn-quit-proof-confirm'), testInfo);
  await expect(page.getByTestId('battle-resume')).toBeVisible();
  await resumeSeeded(page);
  await expectBattle(page, 'proofreading');
});
