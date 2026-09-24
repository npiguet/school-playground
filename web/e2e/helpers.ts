import { expect, type APIRequestContext, type Page } from '@playwright/test';

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

// UI1 (scenes spec §9): the camp is a hub scene. The old « Bienvenue au camp, X. » heading is now
// the dragon's first dialogue line, so specs wait for the scene stage itself.
export async function expectCamp(page: Page) {
  await expect(page.getByTestId('scene-camp')).toBeVisible();
  // UI1 fix wave 3: never act on a camp that is still zooming in. At scale 1.04 the places and the
  // dialogue box poke past the viewport, and a click scrolls its target into view - that once
  // panned the whole stage 139 px sideways. Every spec that arrives on the camp waits here.
  await waitForSceneSettled(page);
}

// Round 1 review #2: SceneTransition (kind="zoom") scales the whole art box in from 1.04 to 1
// over 450ms on mount (SceneTransition.svelte) - a `transform`, not layout, so any boundingBox()
// read (or screenshot) taken mid-animation reads a box that's still shrinking (up to ~4%
// oversized). Every spec that measures element geometry or takes a screenshot waits for this
// first.
// Final review M10: a bare `transform: none` check could pass *before* the zoom had even started.
// SceneTransition now flags the real end of its entry (`data-settled`, set on introend), and on top
// of that no Web Animation may still be running on it.
export async function waitForSceneSettled(page: Page) {
  const t = page.locator('.scene-transition');
  await expect(t).toHaveAttribute('data-settled', 'true');
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

// Navigates straight to a profile's library (SP3: the camp is the new home, the library moved to
// `/parchemins` - route name `library` unchanged).
export async function goToLibrary(page: Page, profileId: number | string) {
  await page.goto('/#/p/' + profileId + '/parchemins');
}

// UI profile creation (mirrors profiles.spec.ts): starts from the profile picker, fills the
// "Nouveau héros" form, lands on the camp (SP3: the new home), skips onboarding and heads
// straight into the library so callers can chain straight into it.
export async function createProfile(page: Page, name: string, level: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /Nouveau héros/ }).click();
  await page.getByLabel('Ton prénom').fill(name);
  await page.getByLabel('Ton niveau').selectOption(level);
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expectCamp(page);
  await skipOnboarding(page);
  await page.getByTestId('camp-parchemins').click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
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
