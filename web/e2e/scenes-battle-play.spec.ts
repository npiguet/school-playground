import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './crashGuard';
import {
  battleRects,
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  expectOverlayTapTargets,
  installKeyboardSim,
  LEGACY_UI,
  redScan,
  resumeSeeded,
  seedPlay,
  setKeyboard,
  stubSpeech,
  tap,
  uniqueName,
} from './helpers';

// UI4 lane P (spec §5): the muster, the dictation and the proofreading on the battle stage, their
// compact layout under the simulated keyboard, and the long text's legibility.
const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';

test.beforeEach(async ({ page }) => stubSpeech(page));

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
  await expect(sheet.getByTestId('play-boss-banner')).toHaveText("Combat contre Éris : les Yeux d'Argus restent éteints.");
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
  await expect(sheet.getByTestId('battle-voice')).toContainText("J'ai recopié ce parchemin à ma façon");
  await tap(sheet.getByTestId('btn-open-grimoire'), testInfo);
  await expect(sheet.locator('.kit-note[data-tone="eris"]')).toBeVisible();
  await expect(sheet.getByTestId('btn-back-library')).toHaveText('Retour aux parchemins');
});

// ===== Task 4: the dictation =====
const LONG = Array.from({ length: 8 }, () => 'Les fées dansent dans la clairière et les oiseaux les écoutent en silence.').join(' ');

async function startDictation(page: Page, testInfo: TestInfo, pace: 1 | 2 | 3 = 1) {
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
  const font = await ta.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, size: parseFloat(cs.fontSize), line: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) };
  });
  expect(font.family).toContain('Literata');
  expect(font.size).toBeGreaterThanOrEqual(22);
  expect(font.line).toBeGreaterThanOrEqual(1.5);
  await expect(page.getByTestId('btn-next')).toBeEnabled();
  await expect(page.getByTestId('dictation-status')).toHaveText("À toi d'écrire.");
  await expect(page.getByTestId('battle-parchment').locator(LEGACY_UI)).toHaveCount(0);
  await expectOverlayTapTargets(page, 'battle-parchment');
  await expect(page.locator('[data-testid="scene-battle"] [data-testid="stage-hud"] *')).toHaveCount(0);
  expect(await redScan(page)).toEqual([]);
});

// Parity: « Réécouter » counts down at pace 2; « Pause » and « Reprendre » drive a flowing pace.
test('replay counts down at pace 2; pause and resume a flowing pace', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Dic6-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée rythmes'), body: LONG, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo, 2);
  const replay = page.getByTestId('btn-replay');
  await expect(replay).toBeEnabled();
  await expect(replay).toContainText('(3)');
  const before = await page.evaluate(() => (window as any).__spoken.length);
  await tap(replay, testInfo);
  await expect(replay).toContainText('(2)');
  await expect.poll(() => page.evaluate(() => (window as any).__spoken.length)).toBeGreaterThan(before);
  const flowing = await createText(request, { title: uniqueName('Dictée pause'), body: LONG, level: '10H' });
  await page.goto(`/#/p/${id}/play/${flowing.id}`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo, 3);
  await expect(page.getByTestId('btn-pause')).toBeEnabled();
  await tap(page.getByTestId('btn-pause'), testInfo);
  await expect(page.getByTestId('dictation-status')).toHaveText('En pause.');
  const paused = await page.evaluate(() => (window as any).__spoken.length);
  await tap(page.getByTestId('btn-resume'), testInfo);
  await expect(page.getByTestId('dictation-status')).toHaveText('Écoute…');
  await expect.poll(() => page.evaluate(() => (window as any).__spoken.length)).toBeGreaterThan(paused);
});

// Spec §10: the compact layout with a simulated keyboard. The stage becomes a band above the
// parchment and stays visible; the textarea and every control stay above the keyboard.
test('the keyboard folds the dictation: band above, textarea and controls above the keyboard', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  const id = await createProfileApi(request, uniqueName(`Dic2-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Dictée clavier'), body: LONG, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=hydre`);
  await expectBattle(page, 'muster');
  await startDictation(page, testInfo);
  const ta = page.getByTestId('dictation-textarea');
  await tap(ta, testInfo);
  const inner = await page.evaluate(() => window.innerHeight);
  await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await expect.poll(async () => (await battleRects(page)).scene?.height ?? 0).toBeLessThanOrEqual(104);
  const r = await battleRects(page);
  const bandBottom = r.scene!.y + r.scene!.height;
  for (const part of ['dragon', 'opponent', 'hp'] as const) {
    const b = r[part]!;
    expect(b.height, `${part} still visible in the band`).toBeGreaterThan(20);
    expect(b.y + b.height, `${part} inside the band`).toBeLessThanOrEqual(bandBottom + 1);
  }
  const box = (await ta.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(bandBottom - 1);
  expect(box.y + box.height).toBeLessThanOrEqual(421);
  expect(box.height).toBeGreaterThanOrEqual(150);
  const buttons = await page.getByTestId('battle-parchment').getByRole('button').all();
  expect(buttons.length, 'Quitter, Réécouter, Suivant').toBeGreaterThanOrEqual(3);
  for (const b of buttons) {
    const bb = (await b.boundingBox())!;
    expect(bb.height).toBeGreaterThanOrEqual(48);
    expect(bb.width).toBeGreaterThanOrEqual(48);
    expect(bb.y).toBeGreaterThanOrEqual(bandBottom - 1);
    expect(bb.y + bb.height).toBeLessThanOrEqual(421);
  }
  await ta.fill(LONG + ' ' + LONG);
  await expect(ta).toBeFocused();
  // The caret line (at the end) stays in view: the textarea scrolled to its bottom.
  expect(await ta.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2)).toBe(true);
  await setKeyboard(page, 0);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'full');
  await expect.poll(async () => (await battleRects(page)).opponent?.height ?? 0).toBeGreaterThan(150);
});

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
  expect(box.y + box.height).toBeLessThanOrEqual(441);
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
  await expect(page.getByText('Ton brouillon est gardé. Veux-tu vraiment quitter la dictée ?')).toBeVisible();
  await tap(page.getByTestId('btn-quit-confirm'), testInfo);
  await expect(page.getByTestId('battle-resume')).toBeVisible();
  await resumeSeeded(page);
  await expect(page.getByTestId('dictation-textarea')).toHaveValue('Les fées');
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
  const spoken = await page.evaluate(() => (window as any).__spoken.length);
  await tap(page.getByTestId('btn-resume'), testInfo);
  await expect.poll(() => page.evaluate(() => (window as any).__spoken.length)).toBeGreaterThan(spoken);
});
