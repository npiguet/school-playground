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

// UI profile creation (mirrors profiles.spec.ts): starts from the profile picker, fills the
// "Nouveau héros" form and waits for the library so callers can chain straight into it.
export async function createProfile(page: Page, name: string, level: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /Nouveau héros/ }).click();
  await page.getByLabel('Ton prénom').fill(name);
  await page.getByLabel('Ton niveau').selectOption(level);
  await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
  await expect(page.getByRole('heading', { name: 'Les Parchemins' })).toBeVisible();
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
