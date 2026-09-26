import { expect, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test';

// Stubs the Web Speech API before any navigation so the dictation runner never depends on a
// real TTS engine (none is available in the headless Playwright container anyway). Installed
// with page.addInitScript so it exists before the app's own scripts run.
export async function stubSpeech(page: Page) {
  await page.addInitScript(() => {
    class U {
      text: string;
      rate = 1;
      lang = '';
      voice: unknown = null;
      pitch = 1;
      onend: null | ((e: unknown) => void) = null;
      onerror: null | ((e: unknown) => void) = null;
      constructor(t: string) {
        this.text = t;
      }
    }
    const spoken: string[] = [];
    (window as any).__spoken = spoken;
    (window as any).SpeechSynthesisUtterance = U;
    const stub = {
      speaking: false,
      pending: false,
      paused: false,
      speak(u: U) {
        spoken.push(u.text);
        setTimeout(() => u.onend?.({}), 20);
      },
      cancel() {},
      pause() {},
      resume() {},
      getVoices() {
        return [{ name: 'Stub fr', lang: 'fr-FR', default: true, localService: true, voiceURI: 'stub' }];
      },
      addEventListener() {},
      removeEventListener() {},
    };
    // `speechSynthesis` is a readonly getter-only attribute on Window in real browsers (WebKit
    // included): a plain `window.speechSynthesis = stub` assignment silently no-ops there, which
    // then leaves speak() calling the *native* engine with our stub's SpeechSynthesisUtterance
    // instances, throwing "must be an instance of SpeechSynthesisUtterance". defineProperty
    // redefines the (configurable) accessor outright so the stub actually takes effect.
    Object.defineProperty(window, 'speechSynthesis', {
      value: stub,
      configurable: true,
      writable: true,
    });
  });
}

// Dismisses the first-visit onboarding modal (spec's decision 22) if it's showing - tolerant so
// it's safe to call after any camp arrival, whether or not this is the profile's first visit.
export async function skipOnboarding(page: Page) {
  const btn = page.getByTestId('onboarding-skip');
  if (await btn.isVisible()) await btn.click();
}

// Taps (iPad) or clicks (desktop) a locator - a finger on the iPad project, a mouse on the desktop
// one (final review M9): there is no touch device to tap with on `desktop`, and WebKit's mouse
// click doesn't fire the touch-only events some flows depend on.
export async function tap(locator: Locator, testInfo: TestInfo) {
  if (testInfo.project.name === 'ipad') await locator.tap();
  else await locator.click();
}

// Fix round 1 #6: a unique fixture name (hero, text title...) for specs that must not collide
// with another run's. `Date.now()` alone (its former shape, `${prefix}-${Date.now() % 1e6}`)
// collides under `--repeat-each` with several workers - reproduced as a genuine 409 Conflict from
// the server's (correct) UNIQUE constraint on profile.name, traced from the app container's own
// access log (`docker logs`), not a 5xx or a SQLite error: several workers landed on the exact
// same millisecond and so the exact same name. `Math.random()`'s per-process RNG state makes two
// processes colliding on both the millisecond and the random suffix astronomically unlikely.
// Base36 (not decimal) keeps the suffix short: profile.name has a 30-char server limit
// (server/app/schemas.py ProfileCreate.name, max_length=30), and every call site's prefix plus
// this suffix must fit under it.
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** A spec's hero namer (final review M3): `heroNamer('Nid')('webkit')` -> a unique « Nid-webkit-… ». */
export const heroNamer = (prefix: string) => (project: string) => uniqueName(`${prefix}-${project}`);

// UI1 (scenes spec §9): the camp is a hub scene. The old « Bienvenue au camp, X. » heading is now
// the dragon's first dialogue line, so specs wait for the scene stage itself.
export async function expectCamp(page: Page) {
  await expect(page.getByTestId('scene-camp')).toBeVisible();
  // UI1 fix wave 3: never act on a camp that is still zooming in. At scale 1.04 the places and the
  // dialogue box poke past the viewport, and a click scrolls its target into view - that once
  // panned the whole stage 139 px sideways. Every spec that arrives on the camp waits here.
  await waitForSceneSettled(page, 'camp');
}

// Round 1 review #2: SceneTransition (kind="zoom") scales the whole art box in from 1.04 to 1
// over 450ms on mount (SceneTransition.svelte) - a `transform`, not layout, so any boundingBox()
// read (or screenshot) taken mid-animation reads a box that's still shrinking (up to ~4%
// oversized). Every spec that measures element geometry or takes a screenshot waits for this
// first.
// Final review M10: a bare `transform: none` check could pass *before* the zoom had even started.
// SceneTransition now flags the real end of its entry (`data-settled`, set on introend), and on top
// of that no Web Animation may still be running on it.
// Fix round 1 minor #1: an explicit 15s timeout (cold load + a shared 4-worker container can starve
// WebKit past the default 5s), and diagnostics attached to the failure message rather than a bare
// timeout, since "which animation, still running or never started" is what actually explains it.
// UI3a Task 8: scoped to `sceneId`, not a bare `.scene-transition`. When this was written, Overlay's
// `out:leave|global` kept an outgoing place mounted for its 160ms close animation; since Task 11
// fix round 1 the overlay's outro is local and the old place leaves at once (watchOverlap proves
// it). The scoping stays as a defensive measure (final review M13): any in-place swap that ever
// lets two scenes coexist for a frame would otherwise turn into a strict-mode violation here
// instead of just being waited out.
export async function waitForSceneSettled(page: Page, sceneId: string) {
  const t = page.locator(`[data-testid="scene-${sceneId}"] .scene-transition`);
  try {
    await expect(t).toHaveAttribute('data-settled', 'true', { timeout: 15_000 });
  } catch (e) {
    const diag = await t
      .evaluate((el) => ({
        anims: el.getAnimations().map((a) => [a.playState, a.currentTime]),
        visibility: document.visibilityState,
      }))
      .catch((diagErr) => ({ error: String(diagErr) }));
    throw new Error(`scene never settled (data-settled stayed "false"); diagnostics: ${JSON.stringify(diag)}\n${(e as Error).message}`);
  }
  await expect.poll(() => t.evaluate((el) => el.getAnimations().length)).toBe(0);
}

// Every element's text/background colour, scanned for a pure red (spec §1.6 "orange rather than
// red, nothing is ever lost"): rgb(r,g,b) with r in [200,255] and g,b < 60 - orange (--orange:
// #e07b2a) and terracotta (--terracotta: #c0623b) both have g > 60, so neither trips this.
export async function redScan(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const re = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/;
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const cs = getComputedStyle(el);
      for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'fill', 'stroke'] as const) {
        const m = re.exec(cs[prop] ?? '');
        if (m && +m[1] >= 200 && +m[2] < 60 && +m[3] < 60) out.push(`${el.tagName.toLowerCase()} ${prop}=${cs[prop]}`);
      }
    }
    return out;
  });
}

// Creates an already-onboarded profile through the API (no first-visit modal), for specs that
// start straight on the camp hub. Returns its id.
export async function createProfileApi(request: APIRequestContext, name: string, level = '10H'): Promise<number> {
  const res = await request.post('/api/profiles', { data: { name, avatar: 'chouette', level } });
  expect(res.ok()).toBeTruthy();
  const profile = await res.json();
  const patch = await request.patch(`/api/profiles/${profile.id}`, { data: { settings: { onboarded: true } } });
  expect(patch.ok()).toBeTruthy();
  return profile.id as number;
}

// UI profile creation (mirrors profiles.spec.ts): starts from the title's naming ritual, lands on
// the camp (SP3: the new home), skips onboarding and heads straight into the library so callers
// can chain straight into it.
export async function createProfile(page: Page, name: string, level: string) {
  await newHero(page, name, level);
  await skipOnboarding(page);
  await page.getByTestId('camp-parchemins').click();
  await openShelves(page);
}

// UI3 title (Ruling A4): taps « Entrer » if the gate is still closed, then waits for the shields.
export async function enterTitle(page: Page) {
  await expectScene(page, 'title');
  const gate = page.getByTestId('title-gate');
  if (await gate.count()) await gate.click();
  await expect(page.getByTestId('title-shields')).toBeVisible();
}

// Immersion wave Ruling W5: levels are medallion radios named by their level.
export async function chooseLevel(scope: Locator, level: string) {
  await scope.getByRole('radio', { name: level, exact: true }).check();
}

// Names a new hero through the ritual overlay and lands on the camp.
export async function newHero(page: Page, name: string, level = '10H', pin?: string) {
  await page.goto('/');
  await enterTitle(page);
  await page.getByTestId('title-new').click();
  const ritual = page.getByTestId('overlay-hero-new');
  await expect(ritual).toBeVisible();
  await ritual.getByLabel('Ton prénom').fill(name);
  await chooseLevel(ritual, level);
  if (pin) {
    await ritual.getByRole('button', { name: "Protéger ton bouclier d'un sceau" }).click();
    await ritual.getByLabel('Ton sceau à quatre chiffres').fill(pin);
  }
  await ritual.getByRole('button', { name: 'Accrocher mon bouclier' }).click();
  await expectCamp(page);
}

// Picks a hero on the title: its shield when it hangs on a rail, else through « Tous les héros »
// (the shared e2e database holds far more heroes than the six slots).
export async function pickHero(page: Page, name: string) {
  await enterTitle(page);
  const shield = page.getByTestId('title-shields').getByRole('button', { name: new RegExp(name) });
  if (await shield.count()) {
    await shield.first().click();
    return;
  }
  await page.getByTestId('title-all').click();
  await page.getByTestId('overlay-heroes').getByRole('button', { name: new RegExp(name) }).click();
}

// Passes the scan verify step the way the child has to (SP2 playability P1-8): every
// « À vérifier » chip must be tapped (it selects the word in the textarea), then « Le texte est
// juste » asks « As-tu comparé chaque ligne avec la feuille ? » and only the confirmation moves
// on to the details form.
export async function confirmScanVerified(page: Page) {
  const chips = page.getByTestId('scan-low-confidence').locator('button');
  for (let i = 0; i < (await chips.count()); i++) await chips.nth(i).click();
  await page.getByTestId('btn-scan-verified').click();
  await expect(page.getByTestId('scan-confirm')).toContainText('As-tu comparé chaque ligne avec la feuille ?');
  await page.getByTestId('btn-scan-confirm').click();
}

// Minimal mirror of the server's TextCreate schema (server/app/schemas.py) - kept local rather
// than imported from web/src so the e2e project (excluded from web/tsconfig.json) stays free of
// a cross-project source dependency.
export interface TextCreateInput {
  title: string;
  body: string;
  level: string;
  source?: string;
  author?: string | null;
  translator?: string | null;
  work?: string | null;
  credits?: string | null;
  added_by_profile_id?: number | null;
  due_date?: string | null;
  scan_id?: string | null;
}

// Creates a text directly via the API (POST /api/texts), bypassing the "type or paste" UI flow
// for specs that only need a text to exist. Returns the created TextFull JSON.
export async function createText(request: APIRequestContext, body: TextCreateInput) {
  const res = await request.post('/api/texts', { data: body });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// Builds a minimal, valid SessionResult (mirrors web/src/lib/grading/types.ts) with every draft
// error attributed to a single category, so SP3 world.spec.ts can drive quest/mastery progression
// from the API without replaying a full dictation. `category` is a StatKey (e.g. 'agreement:verb',
// 'homophone') - the one lieutenant category the caller wants to move.
export function makeResult(o: { words?: number; draft?: number; caught?: number; category?: string }): object {
  const words = o.words ?? 120;
  const draft = o.draft ?? 0;
  const caught = o.caught ?? 0;
  const category = o.category ?? 'agreement:verb';
  const draftError = { refIndex: 0, typedIndex: 0, expected: 'x', typed: 'y', category: 'agreement', sub: 'verb', anchor: -1 };
  return {
    version: 1,
    byCategory: { [category]: { opportunities: 10, draft, caught, missed: draft - caught, introduced: 0 } },
    draftErrors: Array(draft).fill(draftError),
    finalErrors: [],
    caught: Array(caught).fill(draftError),
    missed: [],
    introduced: [],
    correctWords: words - draft,
    totalWords: words,
    catchRate: draft ? caught / draft : null,
    score: 10,
  };
}

// Posts a session straight to the API (bypassing dictation/proofreading), for specs that need to
// drive quest/mastery/boss progression across many sessions or specific days (SP3 Decision 5's
// `X-Discorde-Day` test-clock header, enabled only via `DISCORDE_TEST_HOOKS=1` in
// compose.e2e.yaml). Returns the parsed JSON response (with its `progression` block).
export async function postSession(
  request: APIRequestContext,
  o: { profileId: number; textId: number; day: string; result: object; questId?: number; encounter?: string; helpStage?: number },
): Promise<any> {
  const result = o.result as { catchRate: number | null };
  const res = await request.post('/api/sessions', {
    headers: { 'X-Discorde-Day': o.day },
    data: {
      profile_id: o.profileId,
      text_id: o.textId,
      pace_level: 1,
      help_stage: o.helpStage ?? 1,
      started_at: o.day + 'T10:00:00+00:00',
      draft: 'x',
      final: 'x',
      result: o.result,
      score: 10,
      catch_rate: result.catchRate,
      quest_id: o.questId,
      encounter: o.encounter,
    },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// Final review I6: prophecies are global (every text with a due date, server/app/routers/world.py),
// so texts other specs create in parallel could be the one the camp shows. The camp response is
// filtered down to the caller's own prophecy, so its assertions always exercise their own fixture.
export async function onlyOwnProphecy(page: Page, textId: number) {
  await page.route('**/api/profiles/*/camp', async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    json.prophecies = json.prophecies.filter((p: { text_id: number }) => p.text_id === textId);
    await route.fulfill({ response: res, json });
  });
}

// The Pythia's own list comes from /oracle (worldApi.oracle), not /camp: the same filter there, so
// parallel workers' prophecies never crowd the panel. Also narrows /camp (the altar card).
export async function onlyOwnOracleProphecy(page: Page, textId: number) {
  await onlyOwnProphecy(page, textId);
  await page.route('**/api/profiles/*/oracle', async (route) => {
    const res = await route.fetch();
    const json = await res.json();
    // GET answers the oracle itself; a consult (POST) answers { oracle, quest }; an error has neither.
    const oracle = route.request().method() === 'GET' ? json : json.oracle;
    if (oracle?.prophecies) oracle.prophecies = oracle.prophecies.filter((p: { text_id: number }) => p.text_id === textId);
    await route.fulfill({ response: res, json });
  });
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Reads every requested box in one browser round trip (UI1 round 1 review #2): separate
// boundingBox() calls can straddle a layout-changing frame.
export async function measureBoxes(page: Page, selectors: Record<string, string>): Promise<Record<string, Rect | null>> {
  return page.evaluate((sel) => {
    const out: Record<string, { x: number; y: number; width: number; height: number } | null> = {};
    for (const [key, selector] of Object.entries(sel)) {
      const el = document.querySelector(selector);
      if (!el) {
        out[key] = null;
        continue;
      }
      const r = el.getBoundingClientRect();
      out[key] = { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    return out;
  }, selectors);
}

// UI3: a place scene is on screen and has finished its entry (never click into the zoom-in).
export async function expectScene(page: Page, sceneId: string) {
  await expect(page.getByTestId(`scene-${sceneId}`)).toBeVisible();
  await waitForSceneSettled(page, sceneId);
}

// UI3a Task 9: from the library tent scene, open the shelves overlay (the old Library screen).
export async function openShelves(page: Page) {
  await expectScene(page, 'library');
  await page.getByTestId('library-shelves').click();
  await expect(page.getByRole('heading', { name: 'Tes parchemins' })).toBeVisible();
}

// Closes the topmost overlay (wax seal) and waits until only it has left: closing a work overlay
// steps back to the portal overlay underneath it rather than waiting for every overlay to close
// (controller ruling U2 - a deep overlay stack must be closed one level at a time).
export async function closeOverlay(page: Page) {
  const top = page.locator('.overlay-panel').last();
  if ((await top.count()) === 0) return;
  const id = await top.getAttribute('data-testid');
  await top.getByTestId('overlay-close').click();
  await expect(page.getByTestId(id!)).toHaveCount(0);
}

// UI3a Task 11 review, fix round 2 finding 2: proves an outgoing place never coexists with the one
// replacing it (Overlay.svelte's OUT transitions must stay local, not `|global` - fix round 1 #1),
// without depending on how fast the machine running the test is. A fixed "count is 0 within N ms"
// window is either too tight (flakes under load) or too loose (hides a real 160ms lingering) -
// this instead watches every DOM mutation from the moment it's installed (before the
// transition-triggering action) and flags the flag if the two testids were EVER both present, no
// matter how briefly. Call before the action; read the result after the new place has settled.
export async function watchOverlap(page: Page, oldTestId: string, newTestId: string) {
  await page.evaluate(
    ([a, b]) => {
      const w = window as unknown as { __overlap?: boolean; __overlapObserver?: MutationObserver };
      w.__overlapObserver?.disconnect();
      w.__overlap = false;
      const check = () => {
        if (document.querySelector(`[data-testid="${a}"]`) && document.querySelector(`[data-testid="${b}"]`)) {
          w.__overlap = true;
        }
      };
      check();
      const obs = new MutationObserver(check);
      obs.observe(document.body, { childList: true, subtree: true });
      w.__overlapObserver = obs;
    },
    [oldTestId, newTestId],
  );
}

// Reads the flag `watchOverlap` maintains: false means the two testids were never both in the DOM
// at once since it was installed.
export async function expectNoOverlap(page: Page) {
  expect(await page.evaluate(() => (window as unknown as { __overlap?: boolean }).__overlap)).toBe(false);
}

// Every listed hotspot and its label plaque sit inside the art's 4:3 safe zone (x 12.5-87.5 %,
// hotspots below the HUD band at y 14 %) and on screen; every hotspot is a 48 px touch target.
// Review round 1 (Task 9): a label with a caption (a new hero, so the glow shows) is taller than a
// bare one, so its own vertical position is checked too - below the HUD band, and clear of the
// DialogueBox's dock (a plaque behind the narrator card would be unreadable while it's open).
// `labelless`: hotspots with no plaque (the library owl, playability #23), measured without their
// label checks.
export async function expectInSafeZone(page: Page, sceneId: string, testIds: string[], labelless: string[] = []) {
  const sel: Record<string, string> = { art: `[data-testid="scene-${sceneId}"] .art` };
  for (const id of testIds) {
    sel[id] = `[data-testid="${id}"]`;
    if (!labelless.includes(id)) sel[`${id}-label`] = `[data-testid="${id}"] .hotspot-label`;
  }
  const b = await measureBoxes(page, sel);
  const art = b.art;
  if (!art) throw new Error(`scene-${sceneId} .art did not render`);
  const zone = {
    left: art.x + art.width * 0.125,
    right: art.x + art.width * 0.875,
    top: art.y + art.height * 0.14,
    bottom: art.y + art.height,
  };
  const dock = dialogueDockRect(art);
  const EPS = 0.5; // sub-pixel rounding of shapes authored flush with the zone edge
  const vw = page.viewportSize()!.width;
  for (const id of testIds) {
    const h = b[id];
    const l = b[`${id}-label`];
    const plaque = !labelless.includes(id);
    if (!h || (plaque && !l)) throw new Error(`${id} or its label did not render`);
    expect(h.x, `${id} left edge in the safe zone`).toBeGreaterThanOrEqual(zone.left - EPS);
    expect(h.x + h.width, `${id} right edge in the safe zone`).toBeLessThanOrEqual(zone.right + EPS);
    expect(h.y, `${id} top edge below the HUD band`).toBeGreaterThanOrEqual(zone.top - EPS);
    expect(h.y + h.height, `${id} bottom edge in the art`).toBeLessThanOrEqual(zone.bottom + EPS);
    expect(Math.min(h.width, h.height), `${id} is a 48 px touch target`).toBeGreaterThanOrEqual(48);
    if (!plaque || !l) continue; // a plaque without its label threw above; `!l` narrows for tsc
    expect(l.x, `${id} label left edge in the safe zone`).toBeGreaterThanOrEqual(Math.max(0, zone.left - EPS));
    expect(l.x + l.width, `${id} label right edge in the safe zone`).toBeLessThanOrEqual(Math.min(vw, zone.right + EPS));
    expect(l.y, `${id} label below the HUD band`).toBeGreaterThanOrEqual(zone.top - EPS);
    expect(rectsOverlap(l, dock), `${id} label overlaps the dialogue dock`).toBe(false);
  }
}

// Every hotspot label that covers another hotspot or another label of the same scene. A plaque's
// box includes its badge (UI3b Task 7 review): the badge overhangs the plaque's corner, so a badge
// covering another place or plaque counts as an overlap too.
export async function labelOverlaps(page: Page, sceneId: string): Promise<string[]> {
  return page.evaluate((sid) => {
    type Box = { left: number; top: number; right: number; bottom: number };
    const hit = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const plaque = (spot: Element): Box | null => {
      const label = spot.querySelector('.hotspot-label');
      if (!label) return null;
      const r = label.getBoundingClientRect();
      const box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      const badge = label.querySelector('.hotspot-badge');
      if (badge) {
        const b = badge.getBoundingClientRect();
        box.left = Math.min(box.left, b.left);
        box.top = Math.min(box.top, b.top);
        box.right = Math.max(box.right, b.right);
        box.bottom = Math.max(box.bottom, b.bottom);
      }
      return box;
    };
    const spots = Array.from(document.querySelectorAll(`[data-testid="scene-${sid}"] button.hotspot`));
    const out: string[] = [];
    for (const s of spots) {
      const lr = plaque(s);
      if (!lr) continue;
      for (const o of spots) {
        if (o === s) continue;
        if (hit(lr, o.getBoundingClientRect())) out.push(`${s.getAttribute('data-testid')} label over ${o.getAttribute('data-testid')}`);
        const ol = plaque(o);
        if (ol && hit(lr, ol)) out.push(`${s.getAttribute('data-testid')} label over ${o.getAttribute('data-testid')} label`);
      }
    }
    return out;
  }, sceneId);
}

// Strict rectangle overlap (mirrors web/src/lib/scene/geometry.ts's boxesOverlap): rects that only
// touch along an edge do not overlap.
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

// The DialogueBox's dock, in viewport px, from a scene's own `.art` box. `DIALOGUE_DOCK` itself
// lives in web/src/lib/scene/geometry.ts (x 27-87.5 %, y 80-100 %), kept as literal percentages
// here (mirrors TextCreateInput's own comment above): the e2e project is excluded from
// web/tsconfig.json, so it stays free of a cross-project source import.
export function dialogueDockRect(art: Rect): Rect {
  return {
    x: art.x + art.width * 0.27,
    y: art.y + art.height * 0.8,
    width: art.width * (0.875 - 0.27),
    height: art.height * 0.2,
  };
}

// UI3a Task 9 (controller ruling 6): the first place e2e that has both a SceneExit sign and the
// DialogueBox's dock must prove they never overlap - a bronze sign under a narrator card would be
// unreachable. Every future place scene (Delphi, the war tent...) reuses this same check.
export async function expectExitClearOfDialogueDock(page: Page, sceneId: string) {
  const b = await measureBoxes(page, { art: `[data-testid="scene-${sceneId}"] .art`, exit: '[data-testid="scene-exit"]' });
  if (!b.art || !b.exit) throw new Error(`scene-${sceneId} .art or scene-exit did not render`);
  expect(
    rectsOverlap(b.exit, dialogueDockRect(b.art)),
    'scene-exit overlaps the dialogue dock (x 27-87.5%, y 80-100% of the art box)',
  ).toBe(false);
}

// What is still animating on an element (none once an overlay has settled), described so that a
// failure says which animation is left and in what state (playState, currentTime, startTime,
// duration), not just "1".
export function runningAnimations(el: Element): string[] {
  return el.getAnimations().map((a) => {
    const t = a.effect?.getComputedTiming();
    return `${a.playState} t=${Math.round(Number(a.currentTime))} start=${Math.round(Number(a.startTime))} duration=${t?.duration}`;
  });
}

// Immersion wave (playability #12, #21): an open overlay - its rods included - starts below the
// HUD, and the scene's text chrome behind it has faded out (SceneStage `has-overlay`). `hud` says
// whether the scene has a HUD (the title has none): when it should, it must be there, so a HUD
// that failed to render can't pass as "cleared" (review fix round 1 #4).
export async function expectOverlayClearsScene(page: Page, overlayTestId: string, sceneId: string, hud: boolean) {
  const panel = page.getByTestId(overlayTestId);
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate(runningAnimations)).toEqual([]);
  const hudItems = page.locator(`[data-testid="scene-${sceneId}"] [data-testid="stage-hud"] *`);
  if (hud) await expect(hudItems.first()).toBeVisible();
  else await expect(hudItems).toHaveCount(0);
  const { top, hudBottom } = await page.evaluate(
    ({ id, sid }) => {
      const p = document.querySelector(`[data-testid="${id}"]`)!;
      const parts = [p, ...Array.from(p.querySelectorAll('.scroll-rod'))];
      const items = Array.from(document.querySelectorAll(`[data-testid="scene-${sid}"] [data-testid="stage-hud"] *`));
      return {
        top: Math.min(...parts.map((e) => e.getBoundingClientRect().top)),
        hudBottom: Math.max(0, ...items.map((e) => e.getBoundingClientRect().bottom)),
      };
    },
    { id: overlayTestId, sid: sceneId },
  );
  expect(top, `${overlayTestId} starts below the HUD`).toBeGreaterThanOrEqual(hudBottom);
  await expect
    .poll(() =>
      page.evaluate(
        (sid) =>
          Array.from(
            document.querySelectorAll(
              `[data-testid="scene-${sid}"] :is(.hotspot-label, .hotspot-leader, .stage-plaque, .stage-text, .scene-exit, .dialogue)`,
            ),
          ).filter((e) => getComputedStyle(e).opacity !== '0').length,
        sceneId,
      ),
    )
    .toBe(0);
}

// Review fix round 1 #1: a focused control's ring (outline + offset) lies inside the visible box
// of the overlay's scrolling body - never clipped by it. Focuses through the keyboard modality
// (a Tab first) so `:focus-visible` applies, as it does for a keyboard user.
export async function expectFocusRingInsideBody(page: Page, overlayTestId: string, control: Locator) {
  await page.keyboard.press('Tab');
  await control.focus();
  const r = await control.evaluate((el) => {
    const cs = getComputedStyle(el);
    const ring = cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset);
    const box = el.getBoundingClientRect();
    const body = el.closest('.overlay-body')!.getBoundingClientRect();
    return {
      focusVisible: el.matches(':focus-visible'),
      ring,
      left: box.left - ring,
      right: box.right + ring,
      top: box.top - ring,
      bottom: box.bottom + ring,
      body: { left: body.left, right: body.right, top: body.top, bottom: body.bottom },
    };
  });
  expect(r.focusVisible, `${overlayTestId}: the control shows its focus ring`).toBe(true);
  expect(r.ring, `${overlayTestId}: the control has a focus ring`).toBeGreaterThan(0);
  expect(r.left, 'ring left edge inside the body').toBeGreaterThanOrEqual(r.body.left);
  expect(r.right, 'ring right edge inside the body').toBeLessThanOrEqual(r.body.right);
  expect(r.top, 'ring top edge inside the body').toBeGreaterThanOrEqual(r.body.top);
  expect(r.bottom, 'ring bottom edge inside the body').toBeLessThanOrEqual(r.body.bottom);
}

// Playability #25: every control inside an overlay is a 48 px touch target. A radio or file input
// is measured through its label (the input itself is hidden or stretched over it); content inside
// a closed <details> has no box and is skipped.
export async function expectOverlayTapTargets(page: Page, overlayTestId: string) {
  // Measure the settled panel: during its fly-in a 48 px control can read 47.x (B3 fix round 1).
  const panel = page.getByTestId(overlayTestId);
  await expect.poll(() => panel.evaluate(runningAnimations)).toEqual([]);
  const small = await panel.evaluate((root) => {
    const sel = [
      'button',
      'a[href]',
      'summary',
      'select',
      'input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=hidden])',
      'label:has(> input[type=radio])',
      'label:has(> input[type=file])',
    ].join(', ');
    return Array.from(root.querySelectorAll<HTMLElement>(sel))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => r.width > 2 && r.height > 2 && getComputedStyle(el).visibility !== 'hidden')
      .filter(({ r }) => Math.min(r.width, r.height) < 48)
      .map(({ el, r }) => `${el.tagName.toLowerCase()} « ${(el.textContent ?? '').trim().slice(0, 30)} » ${Math.round(r.width)}×${Math.round(r.height)}`);
  });
  expect(small, `${overlayTestId}: controls under 48 px`).toEqual([]);
}

// Classes of the legacy kit (buttons, cards, chips, parchment boxes) that an in-world overlay never
// uses (immersion wave Task 13), and the rest of the kit UI4 retired (src/testing/legacyClasses.ts).
export const LEGACY_UI = '.btn, .btn-primary, .btn-ghost, .card, .chip, .chip-active, .parchment, .screen, .scene, .eris-panel, .banner, .banner-olive, .banner-error';

// Immersion wave Task 13 (playability #1, #12, #21, #25; Rulings W1, W2, W4): an overlay is an
// in-world object of its variant, clear of the HUD with the scene's words faded, 48 px targets, kit
// classes only, and the character who speaks in it (or nobody). Each UI3b place spec calls it for
// its own overlays.
export async function expectInWorldOverlay(page: Page, testId: string, scene: string, hud: boolean, variant: string, voice: string | null) {
  const panel = page.getByTestId(testId);
  await expect(panel).toHaveAttribute('data-variant', variant);
  await expectOverlayClearsScene(page, testId, scene, hud);
  await expectOverlayTapTargets(page, testId);
  await expect(panel.locator(LEGACY_UI)).toHaveCount(0);
  if (voice) await expect(panel.getByTestId('overlay-voice')).toHaveAttribute('data-speaker', voice);
  else await expect(panel.getByTestId('overlay-voice')).toHaveCount(0);
  expect(await redScan(page)).toEqual([]);
}

// UI4 (spec §10: the battle's compact layout "with a simulated keyboard"): the iPad's on-screen
// keyboard shrinks the *visual* viewport, not the layout one, and Playwright cannot open it. Like
// stubSpeech's speechSynthesis, `window.visualViewport` (a [Replaceable], configurable attribute of
// the window) is replaced before the app runs by a stand-in whose height is innerHeight minus the
// keyboard. lib/battle/viewport.svelte.ts reads window.visualViewport at every event.
// Final review I3: iOS also pans the visual viewport when it scrolls a focused field low on the page
// into view above the keyboard: `offsetTop` grows (the visible band is offsetTop .. offsetTop +
// height of the layout viewport) and the viewport fires `scroll`. `top` stands in for that pan.
export async function installKeyboardSim(page: Page) {
  await page.addInitScript(() => {
    const target = new EventTarget();
    let keyboard = 0;
    let top = 0;
    const fake = {
      get height() {
        return Math.max(0, window.innerHeight - keyboard);
      },
      get width() {
        return window.innerWidth;
      },
      get offsetTop() {
        return top;
      },
      offsetLeft: 0,
      get pageTop() {
        return window.scrollY;
      },
      get pageLeft() {
        return window.scrollX;
      },
      scale: 1,
      onresize: null,
      onscroll: null,
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    };
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => fake });
    window.addEventListener('resize', () => target.dispatchEvent(new Event('resize')));
    (window as unknown as { __setKeyboard: (px: number, pan: number) => void }).__setKeyboard = (px: number, pan: number) => {
      keyboard = px;
      // The pan never shows what lies below the layout viewport.
      top = Math.max(0, Math.min(pan, keyboard));
      target.dispatchEvent(new Event('resize'));
      target.dispatchEvent(new Event('scroll'));
    };
  });
}

/** What the visual viewport shows, in the layout viewport's px (client coordinates): the band a
 *  control must lie in to be seen above the keyboard. Read from the page, never assumed. */
export async function visibleBand(page: Page): Promise<{ top: number; bottom: number }> {
  return page.evaluate(() => {
    const vv = window.visualViewport;
    return vv ? { top: vv.offsetTop, bottom: vv.offsetTop + vv.height } : { top: 0, bottom: window.innerHeight };
  });
}

/** Opens (px > 0) or closes (0) the simulated keyboard, panned down by `top` px as iOS does for a
 *  field low on the page, checks the page sees it, and returns the visible band. */
export async function setKeyboard(page: Page, px: number, top = 0) {
  const { vv, inner, offsetTop } = await page.evaluate(
    ([k, t]) => {
      (window as unknown as { __setKeyboard: (px: number, pan: number) => void }).__setKeyboard(k, t);
      return { vv: window.visualViewport!.height, inner: window.innerHeight, offsetTop: window.visualViewport!.offsetTop };
    },
    [px, top] as const,
  );
  expect(vv, 'the simulated keyboard shrinks the visual viewport').toBe(Math.max(0, inner - px));
  expect(offsetTop, 'the simulated pan moves the visual viewport').toBe(Math.max(0, Math.min(top, px)));
  return visibleBand(page);
}

export interface PlaySeed {
  profileId: number;
  textId: number;
  mode?: 'dictation' | 'grimoire';
  phase: 'intro' | 'dictation' | 'proofreading' | 'results';
  draft?: string;
  current?: string;
  pace?: 1 | 2 | 3 | 4;
  opponent?: string;
  /** Ruling C2c: the encounter and quest the battle was started under (absent: an older save). */
  encounter?: string | null;
  quest?: number | null;
}

// Seeds a play state (lib/playState.ts, version 1) before the app starts, once per tab: a reload
// then keeps what the app itself saved since. Each test has its own browser context, so its
// localStorage is its own under 8 workers.
export async function seedPlay(page: Page, s: PlaySeed) {
  await page.addInitScript((seed) => {
    const key = `discorde.play.${seed.profileId}.${seed.textId}${seed.mode === 'grimoire' ? '.grimoire' : ''}`;
    if (sessionStorage.getItem(`seeded:${key}`)) return;
    sessionStorage.setItem(`seeded:${key}`, '1');
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        profileId: seed.profileId,
        textId: seed.textId,
        phase: seed.phase,
        pace: seed.pace ?? 1,
        mode: seed.mode ?? 'dictation',
        startedAt: new Date().toISOString(),
        draft: seed.draft ?? '',
        current: seed.current ?? seed.draft ?? '',
        hintsUsed: 0,
        revealedKeys: [],
        passIndex: 0,
        bouclier: false,
        submitted: false,
        sessionId: null,
        ...(seed.opponent ? { opponent: seed.opponent } : {}),
        ...(seed.encounter !== undefined ? { encounter: seed.encounter } : {}),
        ...(seed.quest !== undefined ? { quest: seed.quest } : {}),
      }),
    );
  }, s);
}

/** A seeded dictation or proofreading comes back behind the resume ribbon: continue it. */
export async function resumeSeeded(page: Page) {
  await page.getByTestId('battle-resume-continue').click();
  await expect(page.getByTestId('battle-resume')).toHaveCount(0);
}

/** The battle stage is on screen, settled, and (optionally) in this phase. */
export async function expectBattle(page: Page, phase?: 'muster' | 'dictation' | 'proofreading' | 'victory') {
  await expectScene(page, 'battle');
  if (phase) await expect(page.getByTestId('scene-battle')).toHaveAttribute('data-phase', phase);
}

/** The stage's parts in viewport px (null when absent). */
export async function battleRects(page: Page) {
  return measureBoxes(page, {
    scene: '[data-testid="battle-scene"]',
    dragon: '[data-testid="battle-dragon"]',
    opponent: '[data-testid="battle-opponent"]',
    // The hold: its plaque (the battle's h1) and its meter (`battle-hp`).
    hp: '[data-testid="battle-hold"]',
    parchment: '[data-testid="battle-parchment"]',
  });
}
