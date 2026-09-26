import { test, expect } from './crashGuard';
import {
  battleRects,
  createProfileApi,
  createText,
  expectBattle,
  expectCamp,
  installKeyboardSim,
  redScan,
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

test('portrait turns the battle into the rotate screen, with its backdrop', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Bat4-${testInfo.project.name}`));
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto(`/#/p/${id}/eris`);
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
  await expect(page.locator('.rotate-backdrop')).toHaveAttribute('src', '/art/scenes/eris_lair.webp');
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
  await setKeyboard(page, inner - 420);
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
  expect(r.parchment!.y + r.parchment!.height).toBeLessThanOrEqual(421);
  await setKeyboard(page, 0);
  await expect(stage).toHaveAttribute('data-layout', 'full');
});
