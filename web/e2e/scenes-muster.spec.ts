// Spec 2026-09-29 §5: the pace-and-aids screen. One screen, no scrolling at 1280×800 and on the iPad in
// landscape (and at 1024×768), the start button always in view; the aids' choice, its bonus, its
// suggestion (never automatic), its memory.
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { test, expect } from './crashGuard';
import { createProfileApi, createText, expectBattle, makeResult, postSession, swissDay, tap, uniqueName } from './helpers';

const BODY = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
const ALL = ['argus', 'ariane', 'persee', 'athena', 'palamede'];

async function muster(page: Page, request: APIRequestContext, testInfo: TestInfo, o: { level?: string; due?: string; query?: string } = {}) {
  const id = await createProfileApi(request, uniqueName(`Mst-${testInfo.project.name}`), o.level ?? '10H');
  const text = await createText(request, { title: uniqueName('Rassemblement'), body: BODY, level: '10H', ...(o.due ? { due_date: o.due } : {}) });
  await page.goto(`/#/p/${id}/play/${text.id}${o.query ?? ''}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster')).toBeVisible();
  return { id, text };
}

/** The whole muster fits its parchment: nothing to scroll. */
const fits = (page: Page) => page.getByTestId('muster').evaluate((el) => el.scrollHeight <= el.clientHeight + 1);

/** The start button lies wholly inside the muster's visible box. */
async function startInView(page: Page): Promise<boolean> {
  const start = await page.getByTestId('btn-start').boundingBox();
  const box = await page.getByTestId('muster').boundingBox();
  return !!start && !!box && start.y >= box.y - 1 && start.y + start.height <= box.y + box.height + 1;
}

for (const [width, height, layout] of [
  [1280, 800, 'wide'],
  [1180, 820, 'wide'],
  [1024, 768, 'narrow'],
] as const) {
  test(`at ${width}×${height} the muster fits without scrolling, in its ${layout} layout`, async ({ page, request }, testInfo) => {
    await page.setViewportSize({ width, height });
    await muster(page, request, testInfo);
    await expect(page.getByTestId('muster')).toHaveAttribute('data-layout', layout);
    await expect(page.getByTestId('muster-aids').getByRole('button')).toHaveCount(5);
    await expect.poll(() => fits(page)).toBe(true);
    await expect.poll(() => startInView(page)).toBe(true);
  });
}

/** How tall the muster's content is against the room it has (px), so the headroom shows in a failure. */
const heights = (page: Page) =>
  page.getByTestId('muster').evaluate((el) => {
    const last = el.lastElementChild as HTMLElement;
    const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    return { content: Math.ceil(last.getBoundingClientRect().bottom - el.getBoundingClientRect().top + el.scrollTop + pad), room: el.clientHeight };
  });

/** The fullest muster: every aid left at the camp, a take-back suggestion (two copies « à reprendre »),
 *  a quest tag, the Pythie's prophecy, the Hydra's longest dossier line (her « strong » band) or Éris's
 *  fight rule and her longest taunt (the draw pinned to the first of `battle.start`). */
async function fullestMuster(page: Page, request: APIRequestContext, testInfo: TestInfo, eris: boolean) {
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  const id = await createProfileApi(request, uniqueName(`MstW-${testInfo.project.name}`), '10H');
  const due = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const text = await createText(request, { title: uniqueName('Les fées de la clairière'), body: BODY, level: '10H', due_date: due });
  for (let i = 0; i < 2; i++) {
    await postSession(request, { profileId: id, textId: text.id, day: swissDay(), result: makeResult({ draft: 12, caught: 0 }), aids: [] });
  }
  await page.goto(`/#/p/${id}/play/${text.id}?quest=1&encounter=${eris ? 'eris' : 'hydre'}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster-suggestion')).toHaveText("Tu pourrais reprendre le fil d'Ariane avec toi.");
  for (const aid of ALL) await expect(page.getByTestId(`aid-toggle-${aid}`)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('play-quest-banner')).toBeVisible();
  await expect(page.getByTestId('play-prophecy')).toBeVisible();
  await expect(page.getByTestId('muster-prophecy-bonus')).toBeVisible();
  if (eris) {
    await expect(page.getByTestId('play-boss-banner')).toBeVisible();
    await expect(page.getByTestId('battle-voice')).toContainText('Un parchemin de plus pour mes dés-accords.');
  } else {
    await expect(page.getByTestId('battle-voice')).toContainText('Les têtes de mon Hydre se glissent dans les pluriels');
  }
}

for (const [width, height, layout] of [
  [1280, 800, 'wide'],
  [1180, 820, 'wide'],
  [1024, 768, 'narrow'],
] as const) {
  for (const eris of [false, true]) {
    test(`at ${width}×${height} the fullest muster${eris ? " of Éris's fight" : ''} still fits, in its ${layout} layout`, async ({ page, request }, testInfo) => {
      await page.setViewportSize({ width, height });
      await fullestMuster(page, request, testInfo, eris);
      await expect(page.getByTestId('muster')).toHaveAttribute('data-layout', layout);
      await expect
        .poll(async () => {
          const h = await heights(page);
          return h.content <= h.room ? 'fits' : `${h.content} px of content for ${h.room} px`;
        })
        .toBe('fits');
      await expect.poll(() => fits(page)).toBe(true);
      await expect.poll(() => startInView(page)).toBe(true);
    });
  }
}

test('at phone width the start button stays in view while the muster scrolls', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await muster(page, request, testInfo);
  const m = page.getByTestId('muster');
  await expect.poll(() => m.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await expect.poll(() => startInView(page)).toBe(true);
  await m.evaluate((el) => el.scrollTo({ top: el.scrollHeight / 2 }));
  await expect.poll(() => startInView(page)).toBe(true);
  await m.evaluate((el) => el.scrollTo({ top: 0 }));
  await expect.poll(() => startInView(page)).toBe(true);
});

test('each aid left at the camp adds its bonus to the glory of the battle, pace and prophecy included', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const due = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  await muster(page, request, testInfo, { due });
  await tap(page.getByTestId('pace-option-1'), testInfo);
  await expect(page.getByTestId('muster-bonus')).toContainText('Gloire de ce combat\u202f: +50\u202f%');
  await expect(page.getByTestId('muster-prophecy-bonus')).toHaveText('Prophétie +50\u202f%');
  const owl = page.getByTestId('aid-toggle-athena');
  await expect(owl).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('aid-bonus-athena')).toHaveCount(0);
  await tap(owl, testInfo);
  await expect(owl).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('aid-bonus-athena')).toHaveText('+20\u202f%');
  await expect(page.getByTestId('muster-bonus')).toContainText('+70\u202f%');
  await tap(page.getByTestId('pace-option-2'), testInfo);
  await expect(page.getByTestId('pace-bonus-2')).toHaveText('+25\u202f%');
  await expect(page.getByTestId('pace-bonus-1')).toHaveCount(0);
  await expect(page.getByTestId('muster-bonus')).toContainText('+95\u202f%');
});

test('the aids chosen go with the battle and come back with its resume ribbon', async ({ page, request }, testInfo) => {
  await muster(page, request, testInfo);
  for (const aid of ['athena', 'argus']) await tap(page.getByTestId(`aid-toggle-${aid}`), testInfo);
  await tap(page.getByTestId('btn-start'), testInfo);
  await expectBattle(page, 'dictation');
  await tap(page.getByTestId('btn-quit-dictation'), testInfo);
  await tap(page.getByTestId('btn-quit-confirm'), testInfo);
  await expect(page.getByTestId('muster-aids-reminder')).toHaveText(
    "Tes aides\u202f: le fil d'Ariane, le bouclier de Persée et les jetons de Palamède.",
  );
});

test('the aids taken last are chosen again, and a suggestion only suggests', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, uniqueName(`Mst7-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Trois belles copies'), body: BODY, level: '10H' });
  // Three belles copies with the same three aids: the server remembers them (not the default five) and
  // the camp suggests leaving the owl, the first of its order that the run took.
  const TAKEN = ['ariane', 'persee', 'athena'];
  for (let i = 0; i < 3; i++) {
    await postSession(request, { profileId: id, textId: text.id, day: swissDay(), result: makeResult({ draft: 2, caught: 2 }), aids: TAKEN });
  }
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  for (const aid of ALL) await expect(page.getByTestId(`aid-toggle-${aid}`)).toHaveAttribute('aria-pressed', String(TAKEN.includes(aid)));
  await expect(page.getByTestId('muster-suggestion')).toHaveText('Tu pourrais laisser la chouette au camp.');
  const owl = page.getByTestId('aid-toggle-athena');
  await expect(owl).toHaveAttribute('data-suggested', 'true');
  // The child follows it: the owl stays at the camp, and the camp now names the next aid of its order
  // that the run took and this muster still takes (plan Ruling R3), without touching any toggle.
  await tap(owl, testInfo);
  await expect(owl).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('muster-suggestion')).toHaveText('Tu pourrais laisser le bouclier de Persée au camp.');
  await expect(page.getByTestId('aid-toggle-persee')).toHaveAttribute('data-suggested', 'true');
  await expect(page.getByTestId('aid-toggle-persee')).toHaveAttribute('aria-pressed', 'true');
  await expect(owl).not.toHaveAttribute('data-suggested', 'true');
  for (const aid of ['argus', 'palamede']) await expect(page.getByTestId(`aid-toggle-${aid}`)).toHaveAttribute('aria-pressed', 'false');
});

test('each aid toggle is named by its aid alone, whatever its state, and described by its own line', async ({ page, request }, testInfo) => {
  for (const [width, height] of [
    [1280, 800],
    [1024, 768],
  ] as const) {
    await page.setViewportSize({ width, height });
    await muster(page, request, testInfo);
    const owl = page.getByRole('button', { name: "La chouette d'Athéna", exact: true });
    await expect(owl).toHaveAttribute('aria-pressed', 'true');
    await expect(owl).toHaveAccessibleDescription('3 indices pour repérer un piège.');
    await tap(owl, testInfo);
    await expect(page.getByRole('button', { name: "La chouette d'Athéna", exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: "Le fil d'Ariane", exact: true })).toHaveAccessibleDescription('Relie un verbe à son sujet.');
  }
});

test("the grimoire's muster shows only the aids and its own button; Éris's fight keeps its pace floor", async ({ page, request }, testInfo) => {
  const { id, text } = await muster(page, request, testInfo);
  await page.goto(`/#/p/${id}/grimoire/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster-aids')).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByTestId('btn-open-grimoire')).toBeVisible();
  await page.goto(`/#/p/${id}/play/${text.id}?encounter=eris&quest=1`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster-aids').getByRole('button')).toHaveCount(5);
  await expect(page.locator('[data-testid^="pace-option-"].disabled').first()).toContainText('Pas pendant un combat');
});
