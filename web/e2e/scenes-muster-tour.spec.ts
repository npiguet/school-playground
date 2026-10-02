import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from './crashGuard';
import { createProfileApi, createText, expectBattle, heroNamer, makeResult, postSession, seedPlay, swissDay, tap, uniqueName } from './helpers';

// Spec 2026-09-29 explanations §2 (plan R11): the muster's own tour, on the plate of Éris's taunt.
test.use({ tours: true });
const heroName = heroNamer('MTour');
const BODY = 'Les enfants jouent dans le jardin. Ils rient.';

test('the first muster explains the pace, the aids and the total, once', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('Visite'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const tour = page.getByTestId('muster-tour');
  await expect(tour).toHaveAttribute('data-step', '0');
  await expect(page.getByTestId('muster-tour-voice')).toHaveAttribute('data-speaker', 'dragon');
  await expect(page.getByTestId('battle-voice')).toHaveCount(0);
  const lit = page.locator('[data-tour-lit]');
  const parts: string[] = [];
  for (let i = 0; i < 8 && (await tour.count()) > 0; i++) {
    const target = (await tour.getAttribute('data-target')) ?? '';
    parts.push(target);
    if (target) await expect(lit).toHaveAttribute('data-tour-part', target);
    else await expect(lit).toHaveCount(0);
    const step = await tour.getAttribute('data-step');
    await tap(page.getByTestId('muster-tour-next'), testInfo);
    await expect.poll(async () => ((await tour.count()) === 0 ? 'gone' : await tour.getAttribute('data-step'))).not.toBe(step);
  }
  expect(parts).toEqual(['pace', 'aids', 'aids', 'bonus', '']);
  await expect(lit).toHaveCount(0);
  await expect(page.getByTestId('btn-start')).toBeFocused();
  await expect(page.getByTestId('battle-voice')).toBeVisible();
  await expect.poll(async () => (await (await request.get(`/api/profiles/${id}`)).json()).settings.tours ?? []).toContain('muster');
  await page.reload();
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-voice')).toBeVisible();
  await expect(tour).toHaveCount(0);
});

// Final review M7: a live region inserted with its words already in is usually not read, so the tour's
// region comes into the page empty and each step's words are written into it afterwards.
test("the tour's live region is in the page before the first step's words", async ({ page, request }, testInfo) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __liveAtInsert?: string[] };
    w.__liveAtInsert = [];
    new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          const live = n.matches('[data-testid="muster-tour-live"]') ? n : n.querySelector('[data-testid="muster-tour-live"]');
          if (live) w.__liveAtInsert!.push(live.textContent ?? '');
        }
    }).observe(document, { childList: true, subtree: true });
  });
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('Visite'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  const live = page.getByTestId('muster-tour-live');
  await expect(live).toHaveAttribute('aria-live', 'polite');
  const first = (await page.getByTestId('muster-tour-voice').locator('.voice-text').textContent()) ?? '';
  await expect(live).toContainText(first);
  expect(await page.evaluate(() => (window as unknown as { __liveAtInsert: string[] }).__liveAtInsert)).toEqual(['']);
  await tap(page.getByTestId('muster-tour-next'), testInfo);
  await expect(page.getByTestId('muster-tour')).toHaveAttribute('data-step', '1');
  const second = (await page.getByTestId('muster-tour-voice').locator('.voice-text').textContent()) ?? '';
  expect(second).not.toBe(first);
  await expect(live).toContainText(second);
});

// Review focus 3.
test('the muster stays usable under its tour: « Commencer la dictée » ends it, and it is seen', async ({ page, request }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('Visite'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster-tour')).toBeVisible();
  const owl = page.getByTestId('aid-toggle-athena');
  const pressed = await owl.getAttribute('aria-pressed');
  await tap(owl, testInfo);
  await expect(owl).not.toHaveAttribute('aria-pressed', pressed ?? '');
  await expect(page.getByTestId('muster-tour')).toBeVisible();
  await expect(page.getByTestId('btn-start')).toBeInViewport();
  await tap(page.getByTestId('btn-start'), testInfo);
  await expectBattle(page, 'dictation');
  await expect(page.locator('[data-tour-lit]')).toHaveCount(0);
  await expect.poll(async () => (await (await request.get(`/api/profiles/${id}`)).json()).settings.tours ?? []).toContain('muster');
});

test('« Passer la visite » ends the tour at once, and it is seen', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('Visite'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.locator('[data-tour-lit]')).toHaveAttribute('data-tour-part', 'pace');
  await tap(page.getByTestId('muster-tour-skip'), testInfo);
  await expect(page.getByTestId('muster-tour')).toHaveCount(0);
  // Final review M6: focus goes to the button the tour's last line points at, not to <body>.
  await expect(page.getByTestId('btn-start')).toBeFocused();
  await expect(page.locator('[data-tour-lit]')).toHaveCount(0);
  await expect(page.getByTestId('battle-voice')).toBeVisible();
  await expect.poll(async () => (await (await request.get(`/api/profiles/${id}`)).json()).settings.tours ?? []).toContain('muster');
});

test('no muster tour on a resumed battle or on the grimoire', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, { title: uniqueName('Visite'), body: BODY, level: '10H' });
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'dictation', draft: 'Les enfants' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-resume')).toBeVisible();
  await expect(page.getByTestId('muster-tour')).toHaveCount(0);
  await page.goto(`/#/p/${id}/grimoire/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('btn-open-grimoire')).toBeVisible();
  await expect(page.getByTestId('battle-voice')).toBeVisible();
  await expect(page.getByTestId('muster-tour')).toHaveCount(0);
  // Neither counts as the first dictation muster: the tour still waits for it. Shown, not read once off
  // the server (a wrong save is an async PATCH that could land after such a read; a tour marked seen
  // is closed at once for this page load, so the next plain muster would stay silent).
  const other = await createText(request, { title: uniqueName('Visite'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${other.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster-tour')).toHaveAttribute('data-step', '0');
});

// Task 3 review: the lyre's reset brings the muster's tour back too (R8: it clears every tour).
test('« Refaire les visites du camp » brings the muster tour back on the next dictation muster', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const every = ['camp', 'camp:2', 'library', 'delphi', 'war', 'war:2', 'nest', 'nest:2', 'cabin', 'cabin:2', 'muster'];
  expect((await request.patch(`/api/profiles/${id}`, { data: { settings: { tours: every } } })).ok()).toBeTruthy();
  const text = await createText(request, { title: uniqueName('Visite'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('battle-voice')).toBeVisible();
  await expect(page.getByTestId('muster-tour')).toHaveCount(0);
  await page.goto(`/#/p/${id}/settings`);
  const lyre = page.getByTestId('overlay-lyre');
  await tap(lyre.getByTestId('lyre-tours'), testInfo);
  await expect(lyre.getByRole('status')).toHaveText('Les visites reprendront à ton prochain passage dans chaque lieu.');
  const next = await createText(request, { title: uniqueName('Visite'), body: BODY, level: '10H' });
  await page.goto(`/#/p/${id}/play/${next.id}`);
  await expectBattle(page, 'muster');
  await expect(page.getByTestId('muster-tour')).toHaveAttribute('data-step', '0');
  await expect(page.locator('[data-tour-lit]')).toHaveAttribute('data-tour-part', 'pace');
});

// Review focus 3: the muster's no-scroll budget (scenes-muster.spec.ts) holds with the tour's plate in
// the taunt's place, at every step, on the fullest muster too (a hero who played before the tour came
// meets it on such a muster).
const fits = (page: Page) =>
  page.getByTestId('muster').evaluate((el) => (el.scrollHeight <= el.clientHeight + 1 ? 'fits' : `${el.scrollHeight} px of content for ${el.clientHeight} px`));
async function fitsAtEveryStep(page: Page, testInfo: TestInfo) {
  const tour = page.getByTestId('muster-tour');
  for (let i = 0; i < 8 && (await tour.count()) > 0; i++) {
    const step = (await tour.getAttribute('data-step')) ?? '';
    await expect.poll(() => fits(page), `step ${step}`).toBe('fits');
    await expect(page.getByTestId('btn-start')).toBeInViewport({ ratio: 1 });
    await tap(page.getByTestId('muster-tour-next'), testInfo);
    await expect.poll(async () => ((await tour.count()) === 0 ? 'gone' : await tour.getAttribute('data-step'))).not.toBe(step);
  }
  await expect(tour).toHaveCount(0);
}

for (const [width, height] of [
  [1280, 800],
  [1180, 820],
  [1024, 768],
] as const) {
  for (const fullest of [false, true]) {
    test(`at ${width}×${height} the ${fullest ? 'fullest ' : ''}muster still fits under its tour`, async ({ page, request }, testInfo) => {
      await page.setViewportSize({ width, height });
      const id = await createProfileApi(request, heroName(testInfo.project.name));
      const text = await createText(request, {
        title: uniqueName(fullest ? 'Les fées de la clairière' : 'Visite'),
        body: BODY,
        level: '10H',
        ...(fullest ? { due_date: '2099-09-30' } : {}),
      });
      if (fullest) {
        // scenes-muster.spec.ts's fullest muster: every aid left at the camp, a take-back suggestion, a
        // quest tag, the prophecy and Éris's fight rule.
        for (let i = 0; i < 2; i++) {
          await postSession(request, { profileId: id, textId: text.id, day: swissDay(), result: makeResult({ draft: 12, caught: 0 }), aids: [] });
        }
      }
      await page.goto(`/#/p/${id}/play/${text.id}${fullest ? '?quest=1&encounter=eris' : ''}`);
      await expectBattle(page, 'muster');
      if (fullest) {
        await expect(page.getByTestId('muster-suggestion')).toBeVisible();
        await expect(page.getByTestId('play-boss-banner')).toBeVisible();
        await expect(page.getByTestId('play-prophecy')).toBeVisible();
      }
      await expect(page.getByTestId('muster-tour')).toBeVisible();
      await fitsAtEveryStep(page, testInfo);
    });
  }
}
