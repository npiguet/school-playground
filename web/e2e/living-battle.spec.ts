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
/** Half the draft's mistakes fixed: one strike lands, the opponent retreats. */
const HALF = 'Les fées dansent dans la clairière. Elles chante et les oiseaux les écoutent.';
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

/** `tag`: four characters at most (a profile's name is 30 at most, the project's and a unique suffix
 *  included). */
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

/** Every reaction an `.actor` starts, in order, as it starts: the combatant's test id, its
 *  `data-reaction` then (Svelte writes the attribute before Combatant's effect animates) and the
 *  keyframes. Read back with `startedReactions`. */
async function recordReactions(page: Page) {
  await page.addInitScript(() => {
    const started: { who: string; reaction: string; keyframes: string }[] = [];
    (window as unknown as { __reactions: typeof started }).__reactions = started;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      const combatant = this.classList.contains('actor') ? this.closest<HTMLElement>('.combatant') : null;
      if (combatant) started.push({ who: combatant.dataset.testid ?? '', reaction: combatant.dataset.reaction ?? '', keyframes: JSON.stringify(args[0]) });
      return animate.apply(this, args);
    };
  });
}

const startedReactions = (page: Page) =>
  page.evaluate(() => (window as unknown as { __reactions: { who: string; reaction: string; keyframes: string }[] }).__reactions);

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
  await recordReactions(page);
  await muster(page, id, text.id, 'hydre');
  // The muster's taunt starts on the opponent's actor, over the living figure.
  await expect
    .poll(async () => (await startedReactions(page)).some((r) => r.who === 'battle-opponent' && r.reaction === 'taunt'))
    .toBe(true);
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
  // The opponent's states, in order, from its first frame on: its `data-motion`, its base's
  // `data-src` (an empty one: no `.dragon-base` at all) and its reaction, one entry per change.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __erisStates: string[] }).__erisStates = seen;
    const note = () => {
      const layer = document.querySelector<HTMLElement>('[data-testid="battle-opponent"]');
      if (!layer) return;
      const motion = layer.querySelector<HTMLElement>('.dragon-figure')?.dataset.motion ?? '';
      const src = layer.querySelector<HTMLElement>('.dragon-base')?.dataset.src ?? '';
      const state = `${motion}|${src}|${layer.dataset.reaction ?? ''}`;
      if (seen[seen.length - 1] !== state) seen.push(state);
    };
    new MutationObserver(note).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-motion', 'data-src', 'data-reaction'] });
  });
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
  // Standing Éris was alive before the defeat, her flustered picture came straight after her, and no
  // frame lacked a base (never a blank box).
  const states = (await page.evaluate(() => (window as unknown as { __erisStates: string[] }).__erisStates)).map((e) => {
    const [motion, src, reaction] = e.split('|');
    return { motion, src, reaction };
  });
  const STANDING = '/art/characters/eris_cut.webp';
  const FLUSTERED = '/art/characters/eris_flustered_cut.webp';
  const told = JSON.stringify(states);
  expect(states.every((s) => s.src !== ''), `a base in every frame: ${told}`).toBe(true);
  const firstFlustered = states.findIndex((s) => s.src === FLUSTERED);
  expect(firstFlustered, told).toBeGreaterThan(0);
  expect(states.slice(0, firstFlustered).every((s) => s.src === STANDING), told).toBe(true);
  expect(states.slice(firstFlustered).every((s) => s.src === FLUSTERED), told).toBe(true);
  expect(states.findIndex((s) => s.src === STANDING && s.motion === 'living' && s.reaction !== 'defeat'), `standing Éris alive before the defeat: ${told}`).toBeGreaterThanOrEqual(0);
});

test('a hit plays on the living opponent', async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LB8');
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  // The hit is caught as it starts (reactions.ts: it flashes to brightness(1.8)), even once the
  // retreat has replaced it.
  await recordReactions(page);
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'results', draft: DRAFT, current: HALF, opponent: 'sirenes', progression: victoryProgression() });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  await expect(opponent(page)).toHaveAttribute('data-hits', '1');
  await expect
    .poll(async () => (await startedReactions(page)).some((r) => r.who === 'battle-opponent' && r.keyframes.includes('brightness(1.8)')))
    .toBe(true);
  // Then the retreat, held on the actor over the living figure.
  await expect(opponent(page)).toHaveAttribute('data-reaction', 'retreat');
  expect(await settledDragon(opponent(page))).toBe('living');
  await expect(canvases(page)).toHaveCount(2);
  await expect.poll(() => opponent(page).locator('.actor').evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
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

// Plan Ruling B9: each fighter fills its side column, may tuck under the parchment's edge (drawn above
// it) by a bounded share of its box width, never passes under the hold bar, the HUD or the exit sign,
// nor off the screen; the opponent stays the larger; neither is smaller than before this spec (the
// dragon clamp(140px, 36vh, 320px), the opponent clamp(180px, 50vh, 440px)). The shares are tighter
// than the ruling's 20 % / 15 % (measured on the pictures, BattleStage.svelte): the dragon faces the
// parchment with its snout (81 % of its box), the opponent with what it holds (5 %): 15 % and 3 %,
// but for the old size's floor below.
// `foeTuck`, `dragonTuck`: Ruling B14, "never smaller than before" wins over the 3 % and the 15 %.
// Where the column is narrow for the screen's height each fighter keeps its old size (the opponent
// clamp(180px, 50vh, 440px), the dragon clamp(140px, 36vh, 320px)) and tucks what that size implies:
// at 1180x820 (the ipad project's size), a 224 px column, the opponent 410 px 7.7 %, the dragon 295 px
// 24 %; at 1024x768, a 195 px column, the opponent 384 px 15 %, the dragon 276 px 29.6 % (it tucked as
// much before this spec). 1920x1080: the widest column, where the ratio 1.15 is the closest.
const VIEWPORTS = [
  { width: 1280, height: 720, foeTuck: 0.03, dragonTuck: 0.15 },
  { width: 1366, height: 1024, foeTuck: 0.03, dragonTuck: 0.15 },
  { width: 1024, height: 640, foeTuck: 0.03, dragonTuck: 0.15 },
  { width: 1180, height: 820, foeTuck: 0.08, dragonTuck: 0.25 },
  { width: 1024, height: 768, foeTuck: 0.15, dragonTuck: 0.3 },
  { width: 1920, height: 1080, foeTuck: 0.03, dragonTuck: 0.15 },
];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

async function stageBoxes(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
    };
    const one = (s: string) => box(document.querySelector(s));
    return {
      // The fighters at rest: the combatant's own box, the figure's without the held end pose (the
      // defeat tilts the actor 8 degrees away, its bounding box a little wider than the figure).
      dragon: one('[data-testid="battle-dragon"]'),
      opponent: one('[data-testid="battle-opponent"]'),
      // The figures as drawn (the still picture or the canvas's host).
      dragonFigure: one('[data-testid="battle-dragon"] .combatant-figure'),
      opponentFigure: one('[data-testid="battle-opponent"] .combatant-figure'),
      parchment: one('[data-testid="battle-parchment"]'),
      hold: one('[data-testid="battle-hold"]'),
      exit: one('[data-testid="scene-exit"]'),
      hud: [...document.querySelectorAll('[data-testid="stage-hud"] [data-testid]')].map(box).filter((b): b is Box => b !== null),
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  });
}

const across = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
const down = (a: Box, b: Box) => Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const meets = (a: Box, b: Box) => across(a, b) > 1 && down(a, b) > 1;
const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));

async function expectClear(page: Page, where: string, foeTuck: number, dragonTuck: number) {
  const s = await stageBoxes(page);
  const d = s.dragon!;
  const o = s.opponent!;
  for (const [name, f, tuck] of [['dragon', d, dragonTuck], ['opponent', o, foeTuck]] as const) {
    expect(f.x, `${where}: the ${name} stays on screen`).toBeGreaterThanOrEqual(-1);
    expect(f.x + f.w, `${where}: the ${name} stays on screen`).toBeLessThanOrEqual(s.vw + 1);
    expect(f.y, `${where}: the ${name} stays on screen`).toBeGreaterThanOrEqual(-1);
    expect(f.y + f.h, `${where}: the ${name} stays on screen`).toBeLessThanOrEqual(s.vh + 1);
    expect(across(f, s.parchment!) / f.w, `${where}: the ${name} tucks under the parchment by at most ${tuck * 100} %`).toBeLessThanOrEqual(tuck + 0.01);
    if (s.hold) expect(meets(f, s.hold), `${where}: the ${name} clears the hold bar`).toBe(false);
    if (s.exit) expect(meets(f, s.exit), `${where}: the ${name} clears the exit sign`).toBe(false);
    for (const h of s.hud) expect(meets(f, h), `${where}: the ${name} clears the HUD`).toBe(false);
  }
  expect(o.h, `${where}: the opponent stays the larger`).toBeGreaterThanOrEqual(1.15 * d.h);
  expect(d.h, `${where}: the dragon is no smaller than before`).toBeGreaterThanOrEqual(clamp(140, 0.36 * s.vh, 320) - 1);
  expect(o.h, `${where}: the opponent is no smaller than before`).toBeGreaterThanOrEqual(clamp(180, 0.5 * s.vh, 440) - 1);
  return s;
}

test('the bigger fighters keep the battle UI clear at six viewports, the three tuned ones first', async ({ page, request }, testInfo) => {
  test.setTimeout(480_000);
  const sizes: string[] = [];
  for (const [i, vp] of VIEWPORTS.entries()) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const at = `${vp.width}x${vp.height}`;
    const measure = async (phase: string) => {
      await reactionsDone(page);
      const s = await expectClear(page, `${at} ${phase}`, vp.foeTuck, vp.dragonTuck);
      sizes.push(`${at} ${phase}: dragon ${Math.round(s.dragon!.h)}, opponent ${Math.round(s.opponent!.h)}`);
      await page.screenshot({ path: testInfo.outputPath(`sizes-${at}-${phase}.png`) });
    };
    // The muster: the HUD and the exit sign are on the stage.
    const m = await hero(request, testInfo, `LSm${i}`);
    await mockDragon(page, m.id, () => ({ stage: 'ancestral' }));
    await muster(page, m.id, m.text.id, 'eris');
    await measure('muster');
    // The proofreading: the tools and the text on the parchment.
    const p = await hero(request, testInfo, `LSp${i}`);
    await mockDragon(page, p.id, () => ({ stage: 'adult' }));
    await seedPlay(page, { profileId: p.id, textId: p.text.id, phase: 'proofreading', draft: DRAFT, opponent: 'hydre' });
    await page.goto('about:blank');
    await page.goto(`/#/p/${p.id}/play/${p.text.id}`);
    await expectBattle(page, 'muster');
    await resumeSeeded(page);
    await expectBattle(page, 'proofreading');
    await measure('proofreading');
    // The victory: the sheet and its dialogue dock.
    const v = await hero(request, testInfo, `LSv${i}`);
    await mockDragon(page, v.id, () => ({ stage: 'illustre' }));
    await seedPlay(page, { profileId: v.id, textId: v.text.id, phase: 'results', draft: DRAFT, current: BODY, opponent: 'sirenes', progression: victoryProgression() });
    await page.goto('about:blank');
    await page.goto(`/#/p/${v.id}/play/${v.text.id}`);
    await expectBattle(page, 'victory');
    await measure('victory');
    // Where the opponent tucks more than 3 %, the two foes not seen above, for the eye (Ruling B14:
    // the Chimère's snake head and Protée's trident must stay visible).
    if (vp.foeTuck > 0.03) {
      for (const foe of ['chimere', 'protee']) {
        await muster(page, m.id, m.text.id, foe, true);
        await measure(foe);
      }
    }
  }
  testInfo.annotations.push({ type: 'fighter sizes', description: sizes.join('; ') });
  console.log(`fighter sizes: ${sizes.join('; ')}`);
});

test('the living and the still fighters take the same box', async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LSbx');
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await muster(page, id, text.id, 'chimere');
  expect(await settledDragon(opponent(page))).toBe('living');
  expect(await settledDragon(dragon(page))).toBe('living');
  await reactionsDone(page);
  const living = await stageBoxes(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const layer of [opponent(page), dragon(page)]) await expect(layer.locator('.dragon-figure')).toHaveAttribute('data-motion', 'still');
  await expect(canvases(page)).toHaveCount(0);
  const still = await stageBoxes(page);
  for (const k of ['dragon', 'opponent'] as const) {
    const [l, st] = [living[`${k}Figure`]!, still[`${k}Figure`]!];
    for (const f of ['x', 'y', 'w', 'h'] as const) {
      expect(Math.abs(l[f] - st[f]), `${k} ${f}`).toBeLessThanOrEqual(1);
      // At rest, the figure is its combatant's box: the layout rules measure the one, the eye sees the other.
      expect(Math.abs(l[f] - living[k]![f]), `${k} ${f} at rest`).toBeLessThanOrEqual(1);
    }
  }
});
