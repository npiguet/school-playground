import { test, expect } from './crashGuard';
import type { Locator, Page } from '@playwright/test';
import { posix } from 'node:path';
import { createProfileApi, createText, enterTitle, expectBattle, installKeyboardSim, seedPlay, setKeyboard, uniqueName, waitForSceneSettled } from './helpers';

// Two layout bugs found on a real iPad (landscape Safari, 2026-09-28 report):
// 1. A text box in an overlay (the lens's verify step, the desk, the naming ritual) stayed laid out
//    for the whole screen while the on-screen keyboard covered its bottom: the last lines could not
//    be reached without dismissing the keyboard. The overlay now follows the visual viewport while
//    the keyboard is up, as the battle stage does (lib/battle/viewport.svelte.ts), and the focused
//    field fits the space left above it, its caret line in view (lib/scene/fieldInView.ts).
// 2. The grimoire's muster (and every other hugging parchment) collapsed to a thin strip on the
//    iPad: its height is `fit-content`, and its muster's `flex: 1` (a 0% flex basis) resolved to 0
//    there, so the parchment hugged nothing. The muster's basis is now its content (`auto`).
//
// Where the shots go - WALK_OUT, a path relative to the repo root (or absolute in the container):
// unset, web/test-results/ipad-layout (git-ignored); docs/reviews/ipad-layout/<before|after> for the
// tracked record of the fix. compose.e2e.yaml passes WALK_OUT into the Playwright container.
const OUT = posix.resolve('/work', process.env.WALK_OUT || 'web/test-results/ipad-layout');
// Playwright cannot draw the iPad's keyboard: the shot paints what the simulated one hides (and
// what a pan scrolled away above) in grey, for the reader, and takes the paint off again.
const shot = async (page: Page, project: string, name: string) => {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    const vv = window.visualViewport!;
    const hide = (top: number, height: number) => {
      if (height <= 0) return;
      const d = document.createElement('div');
      d.className = 'e2e-keyboard-paint';
      d.style.cssText = `position:fixed;left:0;right:0;top:${top}px;height:${height}px;background:rgba(60,60,66,0.82);z-index:99999;pointer-events:none`;
      document.body.appendChild(d);
    };
    hide(0, vv.offsetTop);
    hide(vv.offsetTop + vv.height, window.innerHeight - vv.offsetTop - vv.height);
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: `${OUT}/${project}-${name}.png` });
  await page.evaluate(() => document.querySelectorAll('.e2e-keyboard-paint').forEach((d) => d.remove()));
};

/** An iPad's landscape keyboard hides about 45 % of the screen. */
const keyboardPx = (page: Page) => page.evaluate(() => Math.round(window.innerHeight * 0.45));

/** Short lines (no wrapping), so line n's top is n line heights down the text. */
const LONG_TEXT = Array.from({ length: 40 }, (_, i) => `Ligne ${i + 1} : les fées dansent.`).join('\n');

async function rect(l: Locator) {
  const b = await l.boundingBox();
  expect(b, 'on screen').not.toBeNull();
  return { top: b!.y, bottom: b!.y + b!.height };
}

/** The box lies whole in the band the keyboard leaves. */
async function expectInBand(l: Locator, band: { top: number; bottom: number }, what: string) {
  const r = await rect(l);
  expect(r.top, `${what}: top above the keyboard's band`).toBeGreaterThanOrEqual(band.top - 1);
  expect(r.bottom, `${what}: bottom above the keyboard`).toBeLessThanOrEqual(band.bottom + 1);
}

/** The place has come in and its overlay has landed (Overlay.svelte's fly-in drained), so nothing
 *  moves focus or boxes under the test. */
async function overlaySettled(page: Page, sceneId: string, testId: string) {
  await waitForSceneSettled(page, sceneId);
  const panel = page.getByTestId(testId);
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((el) => el.getAnimations().length)).toBe(0);
}

/** Puts the caret at `line` (0-based) of a textarea whose lines do not wrap. */
async function caretToLine(ta: Locator, line: number) {
  await ta.evaluate((el: HTMLTextAreaElement, n) => {
    const at = el.value.split('\n').slice(0, n).join('\n').length + (n > 0 ? 1 : 0);
    el.setSelectionRange(at, at);
  }, line);
}

/** The caret's line lies inside the textarea's visible rows (lines do not wrap). */
async function expectCaretLineShown(ta: Locator, line: number) {
  await expect
    .poll(() =>
      ta.evaluate((el: HTMLTextAreaElement, n) => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight);
        const top = parseFloat(cs.paddingTop) + n * lh;
        return top >= el.scrollTop - 1 && top + lh <= el.scrollTop + el.clientHeight + 1;
      }, line),
    )
    .toBe(true);
}

/** A focused text box with the keyboard up: whole above it, scrolling inside itself, and the caret's
 *  line in view wherever it goes (the end, the start, the middle). */
async function expectTextBoxAboveKeyboard(page: Page, ta: Locator, band: { top: number; bottom: number }, what: string, snap: () => Promise<void>) {
  // The shot is taken once the page has settled, fitted or not (it records the bug before the fix).
  const fitted = await expect
    .poll(async () => {
      const r = await rect(ta);
      return r.top >= band.top - 1 && r.bottom <= band.bottom + 1;
    }, `${what} fits above the keyboard`)
    .toBe(true)
    .then(
      () => null,
      (e: unknown) => e,
    );
  await snap();
  if (fitted) throw fitted;
  await expectInBand(ta, band, what);
  const lines = await ta.evaluate((el: HTMLTextAreaElement) => el.value.split('\n').length);
  // It scrolls inside itself: every line is reachable, the last one included.
  expect(await ta.evaluate((el) => el.scrollHeight > el.clientHeight), `${what} scrolls inside itself`).toBe(true);
  for (const line of [lines - 1, 0, Math.floor(lines / 2), lines - 1]) {
    await caretToLine(ta, line);
    await expectCaretLineShown(ta, line);
    await expectInBand(ta, band, what);
  }
  await expect(ta).toBeFocused();
}

test.describe('the on-screen keyboard never covers a text box', () => {
  test.beforeEach(async ({ page }) => installKeyboardSim(page));

  // iOS also pans the visual viewport to bring a low field into view (helpers.ts installKeyboardSim).
  for (const pan of [0, 160]) test(`the lens: the text to check fits above the keyboard, every line in reach (pan ${pan})`, async ({ page, request }, testInfo) => {
    const project = testInfo.project.name;
    const id = await createProfileApi(request, uniqueName(`Kbd1-${project}`));
    // The OCR is the server's (scan.spec.ts covers it): here a long reading comes back at once.
    await page.route('**/api/scan', (route) =>
      route.fulfill({
        json: { scan_id: 'kbd-scan', text: LONG_TEXT, pages: [{ index: 1, text: LONG_TEXT, low_confidence: [], width: 800, height: 1100 }] },
      }),
    );
    await page.route('**/api/scan/kbd-scan/page/*', (route) => route.fulfill({ path: '/work/server/tests/fixtures/scan/handout.png' }));
    await page.goto(`/#/p/${id}/texts/scan`);
    await overlaySettled(page, 'library', 'overlay-lens');
    const lens = page.getByTestId('overlay-lens');
    await lens.getByTestId('scan-input').first().setInputFiles('/work/server/tests/fixtures/scan/handout.png');
    await lens.getByTestId('btn-scan-read').click();
    const ta = lens.getByTestId('scan-textarea');
    await expect(ta).toHaveValue(LONG_TEXT);
    await ta.click();
    await caretToLine(ta, 39);
    const band = await setKeyboard(page, await keyboardPx(page), pan);
    await expectTextBoxAboveKeyboard(page, ta, band, 'the scan text', () => shot(page, project, `lens-keyboard-pan${pan}`));
    // The keyboard goes: the text box gets its full height back.
    await setKeyboard(page, 0);
    await expect.poll(() => ta.evaluate((el) => el.style.maxHeight)).toBe('');
  });

  test('the desk: the new text fits above the keyboard, and so does its title', async ({ page, request }, testInfo) => {
    const project = testInfo.project.name;
    const id = await createProfileApi(request, uniqueName(`Kbd2-${project}`));
    await page.goto(`/#/p/${id}/texts/new`);
    await overlaySettled(page, 'library', 'overlay-desk');
    const desk = page.getByTestId('overlay-desk');
    const ta = desk.locator('textarea');
    await ta.fill(LONG_TEXT);
    await ta.click();
    await caretToLine(ta, 39);
    const band = await setKeyboard(page, await keyboardPx(page));
    await expectTextBoxAboveKeyboard(page, ta, band, 'the desk text', () => shot(page, project, 'desk-keyboard'));
    const title = desk.getByLabel('Titre');
    await title.click();
    await expect.poll(async () => (await rect(title)).bottom <= band.bottom + 1, 'the title above the keyboard').toBe(true);
    await expectInBand(title, band, 'the title');
  });

  test('the naming ritual: the name field stays above the keyboard', async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    await page.goto('/');
    await enterTitle(page);
    await page.getByTestId('title-new').click();
    await overlaySettled(page, 'title', 'overlay-hero-new');
    const ritual = page.getByTestId('overlay-hero-new');
    const name = ritual.getByLabel('Ton prénom');
    await name.click();
    const band = await setKeyboard(page, await keyboardPx(page));
    const fitted = await expect
      .poll(async () => (await rect(name)).bottom <= band.bottom + 1, 'the name above the keyboard')
      .toBe(true)
      .then(
        () => null,
        (e: unknown) => e,
      );
    await shot(page, project, 'ritual-keyboard');
    if (fitted) throw fitted;
    await expectInBand(name, band, 'the name field');
    // The ritual's own words stay whole in the band too: the panel follows the visual viewport.
    await expectInBand(ritual.locator('.overlay-title'), band, 'the ritual title');
  });

  test("the seal: a protected hero's code slots stay above the keypad", async ({ page, request }, testInfo) => {
    const project = testInfo.project.name;
    const res = await request.post('/api/profiles', { data: { name: uniqueName(`Kbd4-${project}`), avatar: 'lyre', level: '10H', pin: '1234' } });
    expect(res.ok()).toBeTruthy();
    await page.goto(`/#/p/${(await res.json()).id}/camp`);
    const gate = page.getByTestId('pin-gate');
    await expect(gate).toBeVisible();
    const slots = gate.getByTestId('pin-slots');
    await gate.getByLabel('Tes quatre chiffres').click();
    const band = await setKeyboard(page, await keyboardPx(page));
    const fitted = await expect
      .poll(async () => {
        const r = await rect(slots);
        return r.top >= band.top - 1 && r.bottom <= band.bottom + 1;
      }, 'the slots above the keypad')
      .toBe(true)
      .then(
        () => null,
        (e: unknown) => e,
      );
    await shot(page, project, 'seal-keyboard');
    if (fitted) throw fitted;
    await expectInBand(gate.locator('.pin-title'), band, "the seal's title");
  });
});

/** The hugging parchment holds its whole heading, on screen (the iPad showed a thin strip). */
async function expectParchmentHoldsTitle(page: Page, heading: Locator) {
  const parchment = page.getByTestId('battle-parchment');
  await expect(heading).toBeVisible();
  const [p, h] = [await rect(parchment), await rect(heading)];
  const vh = await page.evaluate(() => window.innerHeight);
  expect(h.top, 'title inside the parchment (top)').toBeGreaterThanOrEqual(p.top);
  expect(h.bottom, 'title inside the parchment (bottom)').toBeLessThanOrEqual(p.bottom);
  expect(h.top, 'title on screen (top)').toBeGreaterThanOrEqual(0);
  expect(h.bottom, 'title on screen (bottom)').toBeLessThanOrEqual(vh);
  // The root cause, on every engine: the parchment's content is sized by what it holds, never by a
  // zero flex basis (iPad Safari resolved `flex: 1`'s 0% against the parchment's insets, to 0).
  const basis = await parchment.evaluate((el) => getComputedStyle(el.firstElementChild!).flexBasis);
  expect(basis, "the parchment content's flex basis").toBe('auto');
  // Nothing of the muster is cut: it fits whole, or scrolls inside a parchment as tall as the band.
  const fits = await parchment.evaluate((el) => {
    const inner = el.firstElementChild as HTMLElement;
    return inner.scrollHeight <= inner.clientHeight + 1 || el.getBoundingClientRect().height >= window.innerHeight * 0.6;
  });
  expect(fits, 'the parchment holds its muster').toBe(true);
}

test.describe('a hugging parchment holds its whole content', () => {
  test('the grimoire muster: « Grimoire corrompu » whole on its parchment', async ({ page, request }, testInfo) => {
    const project = testInfo.project.name;
    const id = await createProfileApi(request, uniqueName(`Hug1-${project}`));
    const t = await createText(request, { title: uniqueName('Hug grimoire'), body: 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.', level: '10H', source: 'custom' });
    await page.goto(`/#/p/${id}/grimoire/${t.id}`);
    await expectBattle(page, 'muster');
    const heading = page.getByRole('heading', { name: 'Grimoire corrompu' });
    await expect(heading).toBeVisible();
    await shot(page, project, 'grimoire-muster');
    await expectParchmentHoldsTitle(page, heading);
  });

  test('the resume ribbon: the title whole on its parchment', async ({ page, request }, testInfo) => {
    const project = testInfo.project.name;
    const id = await createProfileApi(request, uniqueName(`Hug2-${project}`));
    const title = uniqueName('Hug reprise');
    const body = 'Les fées dansent dans la clairière. Elles chantent et les oiseaux les écoutent.';
    const t = await createText(request, { title, body, level: '10H', source: 'custom' });
    await seedPlay(page, { profileId: id, textId: t.id, phase: 'proofreading', draft: body, current: body });
    await page.goto(`/#/p/${id}/play/${t.id}`);
    await expectBattle(page, 'muster');
    await expect(page.getByTestId('battle-resume')).toBeVisible();
    await shot(page, project, 'resume-muster');
    await expectParchmentHoldsTitle(page, page.getByRole('heading', { name: title }));
  });

  test("Éris's lair: her challenge whole on its parchment", async ({ page, request }, testInfo) => {
    const project = testInfo.project.name;
    const id = await createProfileApi(request, uniqueName(`Hug3-${project}`));
    await page.goto(`/#/p/${id}/eris`);
    await expectBattle(page, 'muster');
    // No heading on her parchment (the stage's plaque names her): the tier's banner comes first.
    const heading = page.getByTestId('boss-tier');
    await expect(heading).toBeVisible();
    await shot(page, project, 'eris-lair');
    await expectParchmentHoldsTitle(page, heading);
  });
});
