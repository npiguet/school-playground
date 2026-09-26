import { test, expect } from './crashGuard';
import {
  battleRects,
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  installKeyboardSim,
  redScan,
  resumeSeeded,
  seedPlay,
  setKeyboard,
  stubSpeech,
  tap,
  uniqueName,
} from './helpers';

// UI4 Task 2 (spec §5): Play, Grimoire and Boss share one battle stage - its backdrop, the dragon on
// the left, the opponent on the right, the hold bar, the parchment in the middle; the scene HUD and
// the exit sign replace the old top bar at the muster (Ruling C5).
const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const HOME: Record<string, string> = { hydre: 'river', lethe: 'river', sirenes: 'coast', protee: 'coast', echo: 'temple', chimere: 'temple' };

test.beforeEach(async ({ page }) => stubSpeech(page));

test('a free text meets a lieutenant on its own ground, and keeps it after a reload', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Bataille'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const stage = page.getByTestId('scene-battle');
  await expect(stage).toHaveAttribute('data-opponent', /^(hydre|echo|chimere|protee|sirenes|lethe)$/);
  const opponent = (await stage.getAttribute('data-opponent'))!;
  await expect(stage).toHaveAttribute('data-backdrop', HOME[opponent]);
  await expect(stage).toHaveAttribute('data-layout', 'full');
  await expect(page.getByTestId('battle-dragon')).toBeVisible();
  await expect(page.getByTestId('battle-opponent')).toBeVisible();
  await expect(page.getByTestId('battle-hp')).toHaveAttribute('aria-valuenow', '100');
  await expect(page.getByTestId('battle-parchment').getByTestId('pace-option-1')).toBeVisible();
  // Ruling C5: the scene HUD and the exit sign, no top bar.
  await expect(page.locator('[data-testid="scene-battle"] [data-testid="stage-hud"] [data-testid="hud-hero"]')).toBeVisible();
  await expect(page.getByTestId('scene-exit')).toBeVisible();
  await expect(page.locator('[data-testid^="topbar-"]')).toHaveCount(0);
  expect(await redScan(page)).toEqual([]);
  await page.reload();
  await expectBattle(page, 'muster');
  await expect(stage).toHaveAttribute('data-opponent', opponent);
});

// Task 2 fix round 1 #1: the play state's key ignores the encounter, so a saved opponent must never
// outlive it. An explicit encounter always wins; an intro keeps nothing; a saved battle resumes only
// under its own (or no) encounter, another one starts a fresh battle.
test('an explicit encounter always wins over the free muster before it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat7-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Rencontre'), body: BODY, level: '10H' });
  const stage = page.getByTestId('scene-battle');
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(stage).toHaveAttribute('data-opponent', /^(hydre|echo|chimere|protee|sirenes|lethe)$/);
  const free = (await stage.getAttribute('data-opponent'))!;
  const other = free === 'hydre' ? 'sirenes' : 'hydre';
  for (const opponent of [other, 'eris']) {
    const hash = `/#/p/${id}/play/${text.id}?encounter=${opponent}`;
    await page.goto(hash);
    await expectBattle(page, 'muster');
    await expect(stage, hash).toHaveAttribute('data-opponent', opponent);
    await page.reload();
    await expectBattle(page, 'muster');
    await expect(stage, `${hash} reloaded`).toHaveAttribute('data-opponent', opponent);
  }
});

test('a saved intro never keeps its opponent', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat8-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Prélude'), body: BODY, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'intro', opponent: 'eris' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-opponent', /^(hydre|echo|chimere|protee|sirenes|lethe)$/);
  await expect(page.getByTestId('battle-resume')).toHaveCount(0);
});

test('a saved battle resumes under its own encounter, another encounter starts a fresh one', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat9-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Reprise'), body: BODY, level: '10H' });
  const stage = page.getByTestId('scene-battle');
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'dictation', draft: 'Les fées', opponent: 'echo', encounter: 'echo' });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=hydre`);
  await expectBattle(page, 'muster');
  await expect(stage).toHaveAttribute('data-opponent', 'hydre');
  await expect(page.getByTestId('battle-parchment').getByTestId('pace-option-1')).toBeVisible();
  await expect(page.getByTestId('battle-resume')).toHaveCount(0);
  for (const hash of [`/#/p/${id}/play/${text.id}`, `/#/p/${id}/play/${text.id}?encounter=echo`]) {
    await page.goto(hash);
    await expectBattle(page, 'muster');
    await expect(page.getByTestId('battle-resume'), hash).toBeVisible();
    await expect(stage, hash).toHaveAttribute('data-opponent', 'echo');
  }
});

// Ruling C2c (final review I1): a battle is told apart by the encounter it was started under, never
// by its opponent. Éris faces the boss fight, every grimoire and a free text alike.
test('a free save against Éris never passes for the boss fight: the boss link starts a fresh one', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat11-${testInfo.project.name}`), '10H');
  const stage = page.getByTestId('scene-battle');
  const sheet = page.getByTestId('battle-parchment');
  for (const phase of ['proofreading', 'results'] as const) {
    const text = await createText(request, { title: uniqueName(`Libre ${phase}`), body: BODY, level: '10H' });
    await seedPlay(page, { profileId: id, textId: text.id, phase, draft: BODY, pace: 1, opponent: 'eris', encounter: null });
    await page.goto(`/#/p/${id}/play/${text.id}?encounter=eris&quest=1`);
    await expectBattle(page, 'muster');
    await expect(page.getByTestId('battle-resume'), phase).toHaveCount(0);
    await expect(page.getByTestId('victory-title'), phase).toHaveCount(0);
    await expect(stage, phase).toHaveAttribute('data-backdrop', 'lair');
    await expect(sheet.getByTestId('play-boss-banner'), phase).toBeVisible();
    // The boss's pace floor holds: the slow paces are locked, and none of them is the one chosen.
    await expect(sheet.getByTestId('pace-option-1'), phase).toHaveClass(/\bdisabled\b/);
    await expect(sheet.getByTestId('pace-option-1').locator('input'), phase).not.toBeChecked();
  }
});

test('a boss battle reopened from the shelves is still the boss fight, and is sent as one', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat12-${testInfo.project.name}`), '10H');
  const text = await createText(request, { title: uniqueName('Combat repris'), body: BODY, level: '10H' });
  const draft = BODY.replace('dansent', 'danse');
  // Ruling C2d: the boss link's help stage (3) is kept with the battle; the shelves' link has none.
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'proofreading', draft, pace: 3, opponent: 'eris', encounter: 'eris', quest: 4242, help: 3 });
  // The submission is caught and answered here: only what the battle sends matters.
  let sent: Record<string, unknown> | null = null;
  await page.route('**/api/sessions', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ detail: 'Muses absentes' }) });
  });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-backdrop', 'lair');
  await resumeSeeded(page);
  await expectBattle(page, 'proofreading');
  // The boss's help stage, not the profile's own: stage 3's frozen count, no Argus passes.
  await expect(page.getByTestId('battle-parchment')).toContainText('1 piège est caché dans ce texte.');
  await expect(page.getByTestId('btn-next-pass')).toHaveCount(0);
  await tap(page.getByTestId('btn-done-proofreading'), testInfo);
  await expectBattle(page, 'victory');
  await expect.poll(() => sent).not.toBeNull();
  expect(sent).toMatchObject({ encounter: 'eris', quest_id: 4242, pace_level: 3, help_stage: 3 });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

test('a grimoire against Éris never passes for the boss fight, and the shelves still reopen it', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat13-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Grimoire repris'), body: BODY, level: '10H' });
  const stage = page.getByTestId('scene-battle');
  await seedPlay(page, { profileId: id, textId: text.id, mode: 'grimoire', phase: 'proofreading', draft: BODY, opponent: 'eris' });
  await page.goto(`/#/p/${id}/grimoire/${text.id}?encounter=eris&quest=1`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-resume')).toHaveCount(0);
  await expect(page.getByTestId('battle-parchment').getByTestId('btn-open-grimoire')).toBeVisible();
  await expect(stage).toHaveAttribute('data-backdrop', 'lair');
  // The grimoire saved from the shelves is untouched: the shelves reopen it, in the temple.
  await page.goto(`/#/p/${id}/grimoire/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-resume')).toBeVisible();
  await expect(stage).toHaveAttribute('data-backdrop', 'temple');
});

// Task 2 fix round 1 #2: play/A -> play/B inside the app (a link, Back, Forward) is another battle.
test('another text in the address bar is another battle, and Back returns to the first', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat10-${testInfo.project.name}`));
  const a = await createText(request, { title: uniqueName('Premier'), body: BODY, level: '10H' });
  const b = await createText(request, { title: uniqueName('Second'), body: BODY, level: '10H' });
  const parchment = page.getByTestId('battle-parchment');
  await page.goto(`/#/p/${id}/play/${a.id}`);
  await expectBattle(page, 'muster');
  await expect(parchment.getByRole('heading', { name: a.title })).toBeVisible();
  await page.goto(`/#/p/${id}/play/${b.id}`);
  await expectBattle(page, 'muster');
  await expect(parchment.getByRole('heading', { name: b.title })).toBeVisible();
  await expect(parchment.getByRole('heading', { name: a.title })).toHaveCount(0);
  await page.goBack();
  await expect(parchment.getByRole('heading', { name: a.title })).toBeVisible();
  await expect(parchment.getByRole('heading', { name: b.title })).toHaveCount(0);
});

test('a quest, a grimoire and the boss bring their own opponent and ground', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat2-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Sirènes'), body: BODY, level: '10H' });
  const stage = page.getByTestId('scene-battle');
  for (const [hash, opponent, backdrop] of [
    [`/#/p/${id}/play/${text.id}?encounter=sirenes`, 'sirenes', 'coast'],
    [`/#/p/${id}/grimoire/${text.id}`, 'eris', 'temple'],
    [`/#/p/${id}/eris`, 'eris', 'lair'],
  ] as const) {
    await page.goto(hash);
    await expectBattle(page, 'muster');
    await expect(stage, hash).toHaveAttribute('data-opponent', opponent);
    await expect(stage, hash).toHaveAttribute('data-backdrop', backdrop);
  }
});

test('the exit sign leads back to the camp', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat3-${testInfo.project.name}`));
  await page.goto(`/#/p/${id}/eris`);
  await expectBattle(page, 'muster');
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

// Final review I4: a window under 560 px tall folds the stage (Ruling C4) with no keyboard at all.
// « Le camp » and the HUD move into the band beside the hold; they never disappear.
test('a short window keeps « Le camp » and the HUD at the muster, folded into the band', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat14-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Fenêtre basse'), body: BODY, level: '10H' });
  await page.setViewportSize({ width: 1280, height: 520 });
  for (const hash of [`/#/p/${id}/eris`, `/#/p/${id}/play/${text.id}?encounter=hydre`]) {
    await page.goto(hash);
    await expectBattle(page, 'muster');
    await expect(page.getByTestId('scene-battle'), hash).toHaveAttribute('data-layout', 'compact');
    const band = page.getByTestId('band-hud');
    for (const control of ['scene-exit', 'hud-hero', 'hud-dragon', 'hud-mute']) {
      await expect(band.getByTestId(control), `${hash} ${control}`).toBeVisible();
    }
    await expect.poll(async () => (await battleRects(page)).scene?.height ?? 0).toBeLessThanOrEqual(104);
    const r = await battleRects(page);
    const boxes = await Promise.all(['scene-exit', 'hud-hero', 'hud-dragon', 'hud-mute'].map(async (c) => [c, (await band.getByTestId(c).boundingBox())!] as const));
    const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    for (const [c, b] of boxes) {
      expect(Math.min(b.width, b.height), `${hash} ${c}: a 48 px target`).toBeGreaterThanOrEqual(48);
      expect(b.y, `${hash} ${c} inside the band`).toBeGreaterThanOrEqual(r.scene!.y - 1);
      expect(b.y + b.height, `${hash} ${c} inside the band`).toBeLessThanOrEqual(r.scene!.y + r.scene!.height + 1);
      for (const part of ['dragon', 'opponent', 'hp'] as const) {
        expect(overlaps(b, r[part]!), `${hash} ${c} clear of the ${part}`).toBe(false);
      }
    }
  }
  await tap(page.getByTestId('scene-exit'), testInfo);
  await expectCamp(page);
});

test('portrait turns the battle into the rotate screen, with its backdrop', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat4-${testInfo.project.name}`));
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`/#/p/${id}/eris`);
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
  await expect(page.locator('.rotate-backdrop')).toHaveAttribute('src', '/art/scenes/eris_lair.webp');
  // UI4 playability #22: one line for every place, never « Le camp » over a battle.
  await expect(page.getByTestId('rotate-screen')).toContainText("Tout se joue à l'horizontale.");
});

// UI4 playability #20: on a wide screen the hold hangs above the opponent, not in the far corner;
// in the compact band both cut-outs stand clear of its edges.
test('the hold hangs above the opponent on a wide screen; the band keeps both cut-outs whole', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  const id = await createProfileApi(request, uniqueName(`Bat14-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Large'), body: BODY, level: '10H' });
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 2560, height: 1080 });
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=lethe`);
  await expectBattle(page, 'muster');
  const wide = await battleRects(page);
  const hold = wide.hp!.x + wide.hp!.width / 2;
  expect(hold, 'the hold over the opponent').toBeGreaterThanOrEqual(wide.opponent!.x);
  expect(hold, 'the hold over the opponent').toBeLessThanOrEqual(wide.opponent!.x + wide.opponent!.width);
  expect((await page.getByTestId('battle-hp').boundingBox())!.height).toBeGreaterThanOrEqual(16);
  await page.setViewportSize(size);
  const inner = await page.evaluate(() => window.innerHeight);
  await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  await expect.poll(async () => (await battleRects(page)).scene?.height ?? 0).toBeLessThanOrEqual(104);
  const r = await battleRects(page);
  for (const part of ['dragon', 'opponent'] as const) {
    const b = r[part]!;
    expect(b.x, `${part} clear of the left edge`).toBeGreaterThanOrEqual(12);
    expect(b.x + b.width, `${part} clear of the right edge`).toBeLessThanOrEqual(size.width - 12);
    expect(b.y, `${part} clear of the band's top`).toBeGreaterThanOrEqual(r.scene!.y + 4);
  }
});

test('reduced motion: no particles, no idle motion on the combatants', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat5-${testInfo.project.name}`));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/#/p/${id}/eris`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.locator('[data-testid="scene-battle"] [data-testid="fx-canvas"]')).toHaveCount(0);
  for (const id of ['battle-dragon', 'battle-opponent']) {
    await expect.poll(() => page.getByTestId(id).evaluate((el) => el.getAnimations({ subtree: true }).length), id).toBe(0);
  }
});

test('the simulated keyboard folds the stage into a band above the parchment, and back', async ({ page, request }, testInfo) => {
  await installKeyboardSim(page);
  const id = await createProfileApi(request, uniqueName(`Bat6-${testInfo.project.name}`));
  await page.goto(`/#/p/${id}/eris`);
  await expectBattle(page, 'muster');
  const inner = await page.evaluate(() => window.innerHeight);
  const view = await setKeyboard(page, inner - 420);
  const stage = page.getByTestId('scene-battle');
  await expect(stage).toHaveAttribute('data-layout', 'compact');
  await expect.poll(async () => (await battleRects(page)).scene?.height ?? 0).toBeLessThanOrEqual(104);
  const r = await battleRects(page);
  for (const part of ['dragon', 'opponent', 'hp'] as const) {
    const b = r[part]!;
    expect(b.y, `${part} inside the band`).toBeGreaterThanOrEqual(r.scene!.y - 1);
    expect(b.y + b.height, `${part} inside the band`).toBeLessThanOrEqual(r.scene!.y + r.scene!.height + 1);
  }
  expect(r.parchment!.y).toBeGreaterThanOrEqual(r.scene!.y + r.scene!.height - 1);
  expect(r.parchment!.y + r.parchment!.height).toBeLessThanOrEqual(view.bottom);
  await setKeyboard(page, 0);
  await expect(stage).toHaveAttribute('data-layout', 'full');
});
