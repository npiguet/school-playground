// web/e2e/living-battle.spec.ts
// Spec 2026-10-03 living battle, "Tests" (e2e) and the plan's Review Focus: a battle draws the opponent
// and a hatched dragon on their own canvases (two at most, the foe never tinted), in every phase; the
// egg, reduced motion and a browser without WebGL2 keep the still pictures; each opponent moves and its
// base never does; Éris routed swaps to her own rig under her held defeat pose; a foe rig that fails to
// load leaves that fighter still; the compact band keeps both alive inside it; battles in a row never
// run out of contexts; the sizes keep the battle's UI clear (Task 7). chromium-gl only (SwiftShader).
// No import of src/lib/living/stages.ts (import.meta.glob does not run in Node): its constants are copied.
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { test, expect } from './crashGuard';
import { createProfileApi, createText, expectBattle, expectCamp, installKeyboardSim, resumeSeeded, seedPlay, setKeyboard, uniqueName, victoryProgression } from './helpers';
import { compareShots, dragonTint, dragonWorn, isolateDragon, mockDragon, settledDragon, type Region } from './dragon';
import eris from '../src/lib/living/rig/foe_eris.json' with { type: 'json' };
import hydre from '../src/lib/living/rig/foe_hydre.json' with { type: 'json' };
import chimere from '../src/lib/living/rig/foe_chimere.json' with { type: 'json' };
import echo from '../src/lib/living/rig/foe_echo.json' with { type: 'json' };
import lethe from '../src/lib/living/rig/foe_lethe.json' with { type: 'json' };
import protee from '../src/lib/living/rig/foe_protee.json' with { type: 'json' };
import sirenes from '../src/lib/living/rig/foe_sirenes.json' with { type: 'json' };

const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const DRAFT = 'Les fées danse dans la clairière. Elles chante et les oiseaux les écoutent.';
const FOES = { eris, hydre, chimere, echo, lethe, protee, sirenes };
/** stages.ts FOE_WIDTH: a foe's portrait, padded, centred, into the 1024 frame. */
const FOE_WIDTH = 585;
const PAD = Math.floor((1024 - FOE_WIDTH) / 2);
// The largest channel change two shots of a foe must reach: half the smallest foe's measured change
// (at least 8). Measured 2026-10-03 at 1280x720 on SwiftShader, the largest change from a first shot
// over sixteen more taken 0.5 s apart: Éris 216, the Hydre 171, the Chimère 216, Écho 207, Léthé 193,
// Protée 176, les Sirènes 211; half the Hydre's 171, rounded down.
const MOVES = 85;
// The fighters' own files: the living chunk and every rig (`dragon_<stage>`, `foe_<id>`; a build's
// `-<hash>.js`, the dev server's `.json`).
const LIVING_FILES = /\/(LivingDragon[^/]*\.(js|svelte)|(dragon|foe)_[a-z_]+(-[\w-]+)?\.(js|json))(\?|$)/;
const opponent = (page: Page) => page.getByTestId('battle-opponent');
const dragon = (page: Page) => page.getByTestId('battle-dragon');
const canvases = (page: Page) => page.locator('[data-testid="scene-battle"] .dragon-living canvas');
const frames = (layer: ReturnType<Page['getByTestId']>) => layer.locator('canvas').evaluate((c) => Number((c as HTMLCanvasElement).dataset.frames ?? 0));

async function hero(request: APIRequestContext, testInfo: TestInfo, tag: string) {
  const id = await createProfileApi(request, uniqueName(`${tag}-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Combat vivant'), body: BODY, level: '10H' });
  return { id, text };
}

/** The muster against `foe`. `fresh`: a full navigation (a new document), not a hash change in the
 *  running game, so nothing of the previous battle (its canvases, its chunk's state) carries over. */
async function muster(page: Page, id: number, textId: number, foe: string, fresh = false) {
  if (fresh) await page.goto('about:blank');
  await page.goto(`/#/p/${id}/play/${textId}?encounter=${foe}`);
  await expectBattle(page, 'muster');
}

/** The reactions (the muster's taunt and brace) have finished: a screenshot shows the figure at rest. */
async function reactionsDone(page: Page) {
  for (const layer of [opponent(page), dragon(page)]) {
    await expect
      .poll(() => layer.evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length))
      .toBe(0);
  }
}

/** A rig's feet box as fractions of the foe's portrait box, mirrored when the figure is. */
function baseRegion(feet: number[], mirrored: boolean): Region {
  const x0 = Math.max(0, (feet[0] - PAD) / FOE_WIDTH);
  const x1 = Math.min(1, (feet[2] - PAD) / FOE_WIDTH);
  const [a, b] = mirrored ? [1 - x1, 1 - x0] : [x0, x1];
  return { x0: a, y0: (feet[1] + 16) / 1024, x1: b, y1: 1008 / 1024 };
}

test('a battle draws the opponent and a hatched dragon alive, two canvases, the foe never tinted', async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LB1');
  await mockDragon(page, id, () => ({ stage: 'adult', tint: 'braise', worn: ['hydre-cou'] }));
  await muster(page, id, text.id, 'hydre');
  expect(await settledDragon(opponent(page))).toBe('living');
  expect(await settledDragon(dragon(page))).toBe('living');
  await expect(canvases(page)).toHaveCount(2);
  await expect(opponent(page).locator('.dragon-base')).toHaveAttribute('data-src', '/art/lieutenants/hydre_cut.webp');
  await expect(opponent(page).locator('.dragon-base')).not.toHaveAttribute('data-tint');
  await expect.poll(() => dragonTint(dragon(page))).toBe('braise');
  expect(await dragonWorn(dragon(page))).toEqual(['hydre-cou']);
  // The Hydra looks right in its file: mirrored on the right, its canvas with it.
  await expect(opponent(page).locator('.facing')).toHaveClass(/mirror/);
  await expect(opponent(page).locator('.facing.mirror canvas')).toBeVisible();
  // The CSS breathing is gone: the figures carry no idle animation of their own.
  await expect(page.locator('[data-testid="scene-battle"] .idle-breathe')).toHaveCount(0);
});

test('both fighters stay alive while she proofreads', async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LB2');
  await mockDragon(page, id, () => ({ stage: 'young' }));
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'proofreading', draft: DRAFT, opponent: 'chimere' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await resumeSeeded(page);
  await expectBattle(page, 'proofreading');
  expect(await settledDragon(opponent(page))).toBe('living');
  expect(await settledDragon(dragon(page))).toBe('living');
  for (const layer of [opponent(page), dragon(page)]) {
    const n = await frames(layer);
    await expect.poll(() => frames(layer)).toBeGreaterThan(n + 5);
  }
});

test('the egg stays the still picture beside a living opponent', async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LB3');
  await mockDragon(page, id, () => ({ stage: 'egg' }));
  await muster(page, id, text.id, 'echo');
  expect(await settledDragon(dragon(page))).toBe('still');
  expect(await settledDragon(opponent(page))).toBe('living');
  await expect(canvases(page)).toHaveCount(1);
});

test('reduced motion and a browser without WebGL2 keep both fighters still, never fetching a rig', async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LB4');
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await muster(page, id, text.id, 'lethe');
  expect(await settledDragon(opponent(page))).toBe('still');
  expect(await settledDragon(dragon(page))).toBe('still');
  await expect(canvases(page)).toHaveCount(0);
  await expect(opponent(page).locator('img.dragon-base')).toHaveAttribute('data-src', '/art/lieutenants/lethe_cut.webp');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type === 'webgl2' ? null : (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
    };
  });
  const living: string[] = [];
  page.on('request', (r) => {
    if (LIVING_FILES.test(r.url())) living.push(r.url());
  });
  await page.reload();
  await expectBattle(page, 'muster');
  expect(await settledDragon(opponent(page))).toBe('still');
  expect(await settledDragon(dragon(page))).toBe('still');
  await expect(canvases(page)).toHaveCount(0);
  expect(living).toEqual([]);
});

test('a foe rig that fails to load leaves the opponent still and the dragon alive', async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LB5');
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await page.route(/\/foe_protee[^/]*\.(js|json)(\?|$)/, (route) => route.abort());
  await muster(page, id, text.id, 'protee');
  expect(await settledDragon(opponent(page))).toBe('still');
  expect(await settledDragon(dragon(page))).toBe('living');
  await expect(opponent(page).locator('img.dragon-base')).toBeVisible();
  await expect(canvases(page)).toHaveCount(1);
});

test('each opponent moves in battle, and its base never does', async ({ page, request }, testInfo) => {
  test.setTimeout(300_000);
  const { id, text } = await hero(request, testInfo, 'LB6');
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  const measured: string[] = [];
  for (const [foe, rig] of Object.entries(FOES)) {
    // A new document per foe: the isolating style tag below must not outlive its battle.
    await muster(page, id, text.id, foe, true);
    expect(await settledDragon(opponent(page)), foe).toBe('living');
    await reactionsDone(page);
    await page.screenshot({ path: testInfo.outputPath(`battle-${foe}.png`) });
    await isolateDragon(page, 'battle', 'battle-opponent');
    const box = opponent(page).locator('.combatant-figure');
    const mirrored = await opponent(page).locator('.facing').evaluate((el) => el.classList.contains('mirror'));
    const first = await box.screenshot();
    await expect
      .poll(async () => (await compareShots(page, first, await box.screenshot())).maxDiff, { message: `${foe} moves`, timeout: 15_000 })
      .toBeGreaterThan(MOVES);
    const later = await box.screenshot();
    measured.push(`${foe}: ${(await compareShots(page, first, later)).maxDiff}`);
    const base = await compareShots(page, first, later, baseRegion(rig.feet, mirrored));
    expect(base.maxDiff, `${foe}: its base stays put`).toBeLessThanOrEqual(2);
  }
  testInfo.annotations.push({ type: 'foe motion', description: measured.join('; ') });
});

test('Éris routed swaps to her flustered rig under her held defeat pose', async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LB7');
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await seedPlay(page, {
    profileId: id,
    textId: text.id,
    phase: 'results',
    draft: DRAFT,
    current: BODY,
    opponent: 'eris',
    encounter: 'eris',
    progression: victoryProgression({ boss: { tier: 1, won: true }, encounter: 'eris' }),
  });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  await expect(opponent(page)).toHaveAttribute('data-reaction', 'defeat');
  // The flustered picture at once (the still one while her rig loads), then her own rig alive.
  await expect(opponent(page).locator('.dragon-base')).toHaveAttribute('data-src', '/art/characters/eris_flustered_cut.webp');
  expect(await settledDragon(opponent(page))).toBe('living');
  await expect(opponent(page).locator('.dragon-living')).toHaveAttribute('data-src', '/art/characters/eris_flustered_cut.webp');
  await expect(canvases(page)).toHaveCount(2);
  // The defeat pose is held on the actor, over the living figure.
  const held = await opponent(page).locator('.actor').evaluate((el) => getComputedStyle(el).transform);
  expect(held).not.toBe('none');
  const n = await frames(opponent(page));
  await expect.poll(() => frames(opponent(page))).toBeGreaterThan(n + 5);
});

test('a hit plays on the living opponent', async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LB8');
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  // Every reaction the opponent's actor starts, in order, as it starts (reactions.ts: the hit flashes
  // to brightness(1.8)): the hit is caught even once the retreat has replaced it.
  await page.addInitScript(() => {
    const started: string[] = [];
    (window as unknown as { __opponentAnims: string[] }).__opponentAnims = started;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      if (this.classList.contains('actor') && this.closest('[data-testid="battle-opponent"]')) started.push(JSON.stringify(args[0]));
      return animate.apply(this, args);
    };
  });
  const HALF = 'Les fées dansent dans la clairière. Elles chante et les oiseaux les écoutent.';
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'results', draft: DRAFT, current: HALF, opponent: 'sirenes', progression: victoryProgression() });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  await expect(opponent(page)).toHaveAttribute('data-hits', '1');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __opponentAnims: string[] }).__opponentAnims.some((k) => k.includes('brightness(1.8)'))))
    .toBe(true);
  // Then the retreat, held on the actor over the living figure.
  await expect(opponent(page)).toHaveAttribute('data-reaction', 'retreat');
  expect(await settledDragon(opponent(page))).toBe('living');
  await expect(canvases(page)).toHaveCount(2);
  const n = await frames(opponent(page));
  await expect.poll(() => frames(opponent(page))).toBeGreaterThan(n + 5);
});

test("the keyboard's compact band keeps both fighters alive inside it", async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LB9');
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await installKeyboardSim(page);
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'proofreading', draft: DRAFT, opponent: 'hydre' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await resumeSeeded(page);
  await expectBattle(page, 'proofreading');
  const inner = await page.evaluate(() => window.innerHeight);
  await setKeyboard(page, inner - 420);
  await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-layout', 'compact');
  expect(await settledDragon(opponent(page))).toBe('living');
  expect(await settledDragon(dragon(page))).toBe('living');
  const r = await page.evaluate(() => {
    const box = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    return { band: box('[data-testid="battle-scene"]'), dragon: box('[data-testid="battle-dragon"] .combatant-figure'), opponent: box('[data-testid="battle-opponent"] .combatant-figure') };
  });
  for (const f of [r.dragon, r.opponent]) {
    expect(f.top).toBeGreaterThanOrEqual(r.band.top - 1);
    expect(f.bottom).toBeLessThanOrEqual(r.band.bottom + 1);
  }
  for (const layer of [opponent(page), dragon(page)]) {
    const n = await frames(layer);
    await expect.poll(() => frames(layer)).toBeGreaterThan(n);
  }
});

test('ten battles in a row never run out of WebGL contexts', async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  const { id, text } = await hero(request, testInfo, 'LB10');
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (/WebGL|too many active|CONTEXT_LOST/i.test(m.text())) warnings.push(m.text());
  });
  const foes = Object.keys(FOES);
  for (let i = 0; i < 10; i++) {
    await muster(page, id, text.id, foes[i % foes.length]);
    expect(await settledDragon(opponent(page))).toBe('living');
    expect(await settledDragon(dragon(page))).toBe('living');
    await expect(canvases(page)).toHaveCount(2);
    await page.goto(`/#/p/${id}/camp`);
    await expectCamp(page);
  }
  expect(warnings).toEqual([]);
});
