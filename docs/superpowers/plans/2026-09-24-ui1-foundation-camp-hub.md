# La Discorde — UI1 "Foundation + Camp hub" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the scenes-UI foundation (self-hosted fonts, UI kit, typed scene data, the scene engine components, the 16:9 cover stage with its 4:3 safe zone, parallax, reduced motion, rotate screen, `?debug` hotspot overlay (amended 2026-09-24: replaces the dropped `?edit` editor, see Ruling 9), HUD, dialogue box) and turn the Camp into the first hub scene whose hotspots route to the existing, unchanged screens, tested in WebKit at iPad landscape 1180×820.

**Architecture:** Pure logic lives in small TypeScript modules under `web/src/lib/scene/` (geometry, validation, particles, typewriter, editor serialisation) and is unit-tested with vitest (node environment, no DOM). Scene *data* lives in `web/src/lib/world/scenes/` (the camp definition + a separate, generated `camp.shapes.ts` holding only hotspot coordinates in art %). Svelte 5 components under `web/src/components/scene/` render a fixed full-screen stage: a 16:9 "art box" sized to the viewport height (sides cropped on iPad, bands on ultra-wide), everything interactive inside a centred 4:3 safe zone. The Camp screen becomes a `SceneStage` with `Hotspot` buttons, a `Hud`, a `DialogueBox` greeting and an `Overlay` hero panel on its own route (`#/p/:id/camp?panel=heros`). Components are verified by `svelte-check` and Playwright (a new `ipad` WebKit project next to the existing `desktop` one).

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 3 (node env), Playwright 1.55.0 (WebKit, `mcr.microsoft.com/playwright:v1.55.0-noble`), FastAPI (one MIME line), Docker Desktop + Git Bash wrapper scripts. No new npm dependency.

**Spec:** `docs/superpowers/specs/2026-09-24-scenes-ui-design.md` — binding. Read §2, §4, §6, §9 (UI1) and §10 before any task. Where this plan and the spec disagree, the spec wins; where the spec is silent, the "Rulings" section below wins. The parent spec `docs/superpowers/specs/2026-09-23-la-discorde-design.md` and the SP3 plan `docs/superpowers/plans/2026-09-24-sp3-world-progression.md` describe the code you extend (camp store, world types, juice).

## Global Constraints

- **Scope (spec §1, §9.1):** "Mechanics, pedagogy, API, server: unchanged." UI1 = "fonts, UI kit, scene components, stage/safe-zone, rotate screen, hotspot editor, HUD, dialogue box (static lines ok), Camp as hub scene on placeholder or existing art. Other screens untouched but reachable."
- **Language:** the UI and all game text are in French (use every French string in this plan verbatim); code, comments, docs and commit messages are in English.
- **Routing (spec §2.3):** "the in-house hash router and all current route names/paths stay; every scene and overlay has a route, so Back, reload and deep links keep working." No route removed.
- **Forms (spec §2.4):** form elements stay real HTML.
- **Dependencies (spec §2.1):** "New npm deps allowed: `gsap`, `howler` (+ types). Any other dep needs a ledger ruling." UI1 adds **none** (see Ruling 2). `web/package.json` dependencies and `web/package-lock.json` must not change (only the `scripts` block gains `"fonts"`).
- **Fonts (spec §2.7):** "self-hosted woff2, OFL, latin + latin-ext subsets, no runtime Google Fonts": Cinzel "place names, hotspot labels, titles; caps only, never running text", Alegreya "dialogue, narration, quests, bestiary, UI body", Literata "the dictation and proofreading text".
- **Stage (spec §4):** "art is 16:9, rendered `object-fit: cover` full-bleed. All interactive elements live in a centred 4:3 safe zone." "Portrait (`orientation: portrait` and aspect < 1) → rotate screen." "Standalone PWA with `apple-mobile-web-app-status-bar-style: black-translucent`; respect safe-area insets."
- **Motion (spec §4):** "honour `prefers-reduced-motion` (no parallax, no bob, fades only)." Parallax "gentle, on pointer drag / device tilt where permitted; ≤ 3 depth layers."
- **Performance (spec §4):** "≤ 600 KB WebP per scene background; preload likely next scenes." "A test/script fails if a scene background exceeds the budget."
- **Ethics (parent spec):** no red anywhere (e2e `redScan` fails on any computed colour with r ≥ 200, g < 60, b < 60); orange is Éris's colour; nothing is lost, no guilt wording.
- **Accessibility:** touch targets ≥ 48 px; every hotspot is a real focusable `<button>` with a visible label; every image has an `alt` (empty for decoration).
- **Toolchain:** no Node and no host Python for tooling. Every command goes through `scripts/*.sh` from the repo root in Git Bash: `scripts/npm.sh run test -- <file>` (vitest), `scripts/npm.sh run check` (svelte-check), `scripts/pytest.sh <file> -v`, `scripts/playwright.sh [spec-filter] [--project=<name>]` (builds the prod image, runs e2e), `scripts/check.sh` (the full gate: pytest, svelte-check, vitest, docker build, Playwright).
- **vitest runs in the `node` environment** (`web/vite.config.ts`): no component tests, no DOM. Put logic in `.ts` modules and test those; components are covered by `svelte-check` (0 errors) and Playwright.
- **Legacy CSS:** the global class `.scene` (in `web/src/app.css`) is still used by Oracle, Cabin, Boss, DragonScreen, Lieutenant, QuestBoard. New code must **not** use the class names `scene` or `screen`; the engine uses `scene-stage`, `art`, `stage-*`, `hotspot*`, `kit-*`.
- **Commits:** branch `scenes`. Another agent commits art files in parallel: **always commit with a pathspec** (`git add <paths> && git commit -m "..." -- <paths>`), never `git add -A`, never `git stash`, `git reset`, `git checkout` or `git clean`. End every commit message with the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` (or the attribution trailer your harness gives you).
- **Verification:** before claiming a task done, run its test commands and paste the real output into your report.

## Rulings taken by this plan (the spec is silent; do not re-ask)

1. **Fonts are vendored, not installed.** `web/scripts/vendor-fonts.mjs` (run once in the node container via `scripts/npm.sh run fonts`) downloads the woff2 files of the `@fontsource/*` **5.3.0** packages (unmodified Google Fonts builds) from jsDelivr, plus each family's `LICENSE` as `OFL.txt`, into `web/public/fonts/<family>/`, and generates `web/src/styles/fonts.css`. The output is committed. Why: `@fontsource` as an npm dependency would need a ledger ruling (spec §2.1) and would put all five subsets (cyrillic, greek, vietnamese…) into `dist`; vendoring keeps exactly latin + latin-ext, keeps the Docker build offline-safe, and the app never fetches a font from a third party. Faces: Cinzel 600, 700; Alegreya 400, 400 italic, 700; Literata 400, 600.
2. **No GSAP in UI1.** Nothing in UI1 is a "cinematic moment" (spec §2.1); hotspot glow/bob/flash, scene fade/zoom and overlays are CSS + Svelte transitions. GSAP arrives with the UI4 victory overlay.
3. **Stage geometry.** The art box is always `width = min(vh × 16/9, vw / 0.75)`, `height = width × 9/16`, centred. On every landscape viewport down to 4:3 this is exactly "cover by height" (sides cropped, e.g. iPad 1180×820 shows art x ≈ 9.5–90.5 %); on ultra-wide it becomes contain (side bands); below 4:3 it shrinks so the safe zone stays whole. Bands/crops show a blurred, darkened copy of the background. **Safe zone** = art x 12.5–87.5 %, full height. **HUD band**: hotspots stay at y ≥ 14 %. **Dialogue dock** = art box x 27–87.5 %, y 80–100 %; no hotspot may overlap it (so the greeting never blocks a place).
4. **Hotspot test ids are `<sceneId>-<hotspotId>`**, and the camp hotspot ids reuse the old card ids: `camp-dragon`, `camp-oracle`, `camp-quests`, `camp-parchemins`, `camp-dossier`, `camp-bestiary`, `camp-cabin`, `camp-boss`. Dynamic info the old cards showed (dragon name, boss reward, counts) becomes the hotspot **caption**, so existing selectors such as `camp-dragon` → "Braise" and `camp-boss` → "Sandales d'Hermès" keep working.
5. **Camp DOM contract changes** (the old heading « Bienvenue au camp, X. » is now the dragon's first dialogue line): e2e waits for `scene-camp` via the new helper `expectCamp(page)`; `camp-xp` → `hud-xp`; `topbar-mute` on the camp → `hud-mute`; "Changer de héros" on the camp is inside the hero panel (`hud-hero` first). `camp-weekly` and `camp-prophecy` keep their ids and texts. Other screens keep their `TopBar` unchanged.
6. **Hero panel = the UI1 overlay**, on route `#/p/:id/camp?panel=heros` (the router already parses hash queries). It carries the links the camp's TopBar used to offer: Réglages (settings), Progrès (stats), Changer de héros. Closing navigates to `#/p/:id/camp`; Back also closes it.
7. **Parallax is pointer-only in UI1** (mouse move, touch drag) with `touch-action: none` on the stage. Device tilt needs `DeviceOrientationEvent.requestPermission()` from a user gesture on iPad; it is deferred to UI3's title scene « Entrer » tap. Depth 0 (the background and every hotspot) never moves, so hotspots stay exactly on their art.
8. **Rotate screen only on scene screens in UI1.** `RotateScreen` lives inside `SceneStage`; the legacy screens stay usable in portrait until UI3/UI4 replace them (the old iPad-portrait playability walks keep working).
9. **`?debug` flag (amended 2026-09-24, user decision; was `?edit`):** the read-only hotspot outline overlay (`HotspotDebug.svelte`) shows when `debug` is in `location.search` (`/?debug#/p/1/camp`) **or** in the hash query (`#/p/1/camp?debug`). The interactive `?edit` editor of Task 9 below was dropped (Task 9b); shapes are hand-authored data in `camp.shapes.ts`. It is compiled into the bundle but never rendered without the flag.
10. **Greeting:** the dragon greets once per profile per page load (module-level set), only after onboarding is done, never in edit mode. Non-modal: it sits in the dialogue dock.
11. **Global type swap.** `--font-display` becomes Cinzel and `--font-body` Alegreya app-wide (legacy screens get the new type for free; texts and selectors are unchanged); new token `--font-reading` (Literata) replaces `--font-body` on exactly four reading surfaces: `Dictation.svelte` `.draft`, `TokenText.svelte` `.tokens`, `Proofreading.svelte` `.text textarea`, `WordEditor.svelte` `input`.
12. **Art budget tests split:** scene backgrounds (`web/public/art/scenes/*.webp`) are checked against the spec's 600 KB; the existing 150 KB/file and 2.5 MB total checks in `art.test.ts` now exclude scenes (UI2's 2048×1152 scenes would otherwise fail them).
13. **Placeholder hotspots on the existing `camp.webp`** (1024×585): dragon by the shields, oracle = hill temple, quests = colonnade, parchemins = left house, dossier (« La tente de guerre ») = right-centre house, bestiary = training posts, cabin = big right house, boss = island temple. Coordinates are pure data in `camp.shapes.ts`; UI2 replaces them with the editor's output.
14. **Playwright projects.** Main config: `desktop` (Desktop Safari, every functional spec, as before) and `ipad` (WebKit, iPad Pro 11 landscape, 1180×820, touch) running only `scenes-*.spec.ts`. All `playability*.spec.ts` walks are excluded from the main run (the SP3 walk was not excluded before) and run only through `playwright.playability.config.ts`. The older walks (SP1–SP3) get only the mechanical selector migration of Ruling 5.
15. **`ASSETS-LICENSES.md`** is created at the repo root in UI1 with the fonts; UI5 appends the audio credits (spec §7).
16. **PWA:** status bar `black-translucent`, manifest `"orientation": "landscape"` and `"background_color": "#15121a"` (the stage's night colour, so the splash doesn't flash white).

## File map

| File | Responsibility | Task |
|---|---|---|
| `web/scripts/vendor-fonts.mjs` | one-off font vendoring + `fonts.css` generation | 1 |
| `web/public/fonts/{cinzel,alegreya,literata}/*` | woff2 + `OFL.txt` (generated, committed) | 1 |
| `web/src/styles/fonts.css` | `@font-face` rules (generated) | 1 |
| `web/src/styles/fonts.test.ts` | fonts contract | 1 |
| `ASSETS-LICENSES.md` | third-party asset credits | 1 |
| `web/src/styles/kit.css`, `kit.test.ts` | UI kit tokens, classes, keyframes | 2 |
| `web/src/lib/ui/contrast.ts`, `laurel.ts` (+ tests) | WCAG contrast, laurel leaf count | 2 |
| `web/src/components/ui/LaurelBar.svelte` | laurel XP bar | 2 |
| `web/src/lib/scene/types.ts` | scene data types | 3 |
| `web/src/lib/scene/geometry.ts` (+ test) | stage box, safe zone, shapes, parallax | 3 |
| `web/src/lib/scene/validate.ts` (+ test) | scene/shape validation | 3 |
| `web/src/lib/world/scenes/camp.shapes.ts` | camp hotspot coordinates (generated format) | 4 |
| `web/src/lib/world/scenes/camp.ts` (+ test) | camp scene definition, hotspot states, greeting | 4 |
| `web/src/lib/world/scenes/index.ts`, `budget.test.ts` | scene registry, weight budget | 4 |
| `web/src/lib/juice/motion.ts` (+ test) | `watchReducedMotion` | 5 |
| `web/src/lib/scene/editMode.ts`, `runtime.svelte.ts`, `fx.ts` (+ tests) | edit flag, stage runtime context, ambient particles | 5 |
| `web/src/components/scene/{SceneStage,SceneLayer,SceneTransition,FxCanvas,RotateScreen}.svelte` | stage engine | 5 |
| `web/src/lib/scene/typewriter.ts`, `greeting.ts` (+ tests) | dialogue typing, greet-once | 6 |
| `web/src/components/scene/{Hotspot,DialogueBox,Overlay}.svelte` | interactive scene pieces | 6 |
| `web/src/lib/scene/hud.ts` (+ test), `web/src/components/scene/Hud.svelte` | HUD | 7 |
| `web/src/screens/Camp.svelte` | camp hub scene | 7 |
| `web/e2e/helpers.ts` + existing specs | migration to the hub DOM | 7 |
| `web/playwright.config.ts`, `web/playwright.playability.config.ts`, `web/e2e/scenes-camp.spec.ts` | iPad WebKit project + hub e2e | 8 |
| `web/src/lib/scene/debugMode.ts` (+ test), `web/src/components/scene/HotspotDebug.svelte`, `web/e2e/scenes-debug.spec.ts` | `?debug` hotspot overlay (amended 2026-09-24: replaces the dropped `?edit` editor files) | 9b |
| `web/e2e/playability-ui1.spec.ts`, `docs/reviews/ui1/*.png` | review screenshots | 10 |

---

### Task 1: Self-hosted fonts (Cinzel, Alegreya, Literata)

**Files:**
- Create: `web/scripts/vendor-fonts.mjs`
- Modify: `web/package.json` (`scripts` block only)
- Create (generated by the script, then committed): `web/public/fonts/cinzel/*`, `web/public/fonts/alegreya/*`, `web/public/fonts/literata/*`, `web/src/styles/fonts.css`
- Modify: `web/src/main.ts`, `web/src/app.css` (`:root` font tokens + header comment), `web/index.html`
- Modify: `web/src/components/Dictation.svelte` (`.draft` rule), `web/src/components/TokenText.svelte` (`.tokens` rule), `web/src/components/Proofreading.svelte` (`.text textarea` rule), `web/src/components/WordEditor.svelte` (`input` rule)
- Modify: `server/app/main.py:17` (MIME registration)
- Create: `ASSETS-LICENSES.md`
- Test: `web/src/styles/fonts.test.ts`, `server/tests/test_health.py`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties `--font-display` (Cinzel stack), `--font-body` (Alegreya stack), `--font-reading` (Literata stack) on `:root`; font files served at `/fonts/<pkg>/<pkg>-<subset>-<weight>-<style>.woff2` with `Content-Type: font/woff2`; `web/src/styles/` directory imported from `main.ts` (Task 2 adds `kit.css` next to `fonts.css`).

- [ ] **Step 1: Write the failing vitest**

Create `web/src/styles/fonts.test.ts`:

```ts
// Scenes UI spec §2.7: Cinzel / Alegreya / Literata, self-hosted woff2, latin + latin-ext, OFL,
// never fetched from a third party. vitest runs with cwd = web/.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';

const fontsCss = readFileSync('src/styles/fonts.css', 'utf-8');
const urls = [...fontsCss.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
const FAMILIES = ['cinzel', 'alegreya', 'literata'];

describe('self-hosted fonts (scenes spec §2.7)', () => {
  it('declares latin and latin-ext faces for Cinzel, Alegreya and Literata', () => {
    for (const pkg of FAMILIES) {
      expect(urls.some((u) => new RegExp(`^/fonts/${pkg}/${pkg}-latin-\\d`).test(u)), `${pkg} latin`).toBe(true);
      expect(urls.some((u) => new RegExp(`^/fonts/${pkg}/${pkg}-latin-ext-\\d`).test(u)), `${pkg} latin-ext`).toBe(true);
    }
    for (const family of ['Cinzel', 'Alegreya', 'Literata']) expect(fontsCss).toContain(`font-family: '${family}'`);
  });

  it('every face is a local woff2 file and the whole set stays under 450 KB', () => {
    let total = 0;
    for (const u of urls) {
      expect(u.startsWith('/fonts/'), u).toBe(true);
      const file = 'public' + u;
      expect(existsSync(file), file).toBe(true);
      expect(readFileSync(file).subarray(0, 4).toString('latin1'), file).toBe('wOF2');
      total += statSync(file).size;
    }
    expect(urls.length).toBe(14);
    expect(total).toBeLessThan(450 * 1024);
  });

  it('ships the OFL licence with each family', () => {
    for (const pkg of FAMILIES) {
      expect(readFileSync(`public/fonts/${pkg}/OFL.txt`, 'utf-8')).toContain('SIL Open Font License');
    }
  });

  it('never asks a third-party origin for fonts', () => {
    const sources = [
      readFileSync('index.html', 'utf-8'),
      readFileSync('src/app.css', 'utf-8'),
      ...readdirSync('src/styles')
        .filter((f) => f.endsWith('.css'))
        .map((f) => readFileSync(`src/styles/${f}`, 'utf-8')),
    ];
    for (const s of sources) expect(s).not.toMatch(/fonts\.googleapis|fonts\.gstatic|@import\s+url\(\s*['"]?https?:/);
  });

  it('maps the tokens: Cinzel titles, Alegreya body, Literata reading text', () => {
    const app = readFileSync('src/app.css', 'utf-8');
    expect(app).toMatch(/--font-display:\s*'Cinzel'/);
    expect(app).toMatch(/--font-body:\s*'Alegreya'/);
    expect(app).toMatch(/--font-reading:\s*'Literata'/);
    for (const c of ['Dictation', 'TokenText', 'Proofreading', 'WordEditor']) {
      expect(readFileSync(`src/components/${c}.svelte`, 'utf-8'), c).toContain('font-family: var(--font-reading)');
    }
  });
});
```

- [ ] **Step 2: Write the failing pytest**

Append to `server/tests/test_health.py`:

```python
def test_spa_serves_woff2_as_font(settings, client):
    fonts = settings.static_dir / "fonts" / "cinzel"
    fonts.mkdir(parents=True)
    (fonts / "x.woff2").write_bytes(b"wOF2")
    r = client.get("/fonts/cinzel/x.woff2")
    assert r.status_code == 200
    assert r.headers["content-type"] == "font/woff2"
```

- [ ] **Step 3: Run both to verify they fail**

Run: `scripts/npm.sh run test -- src/styles/fonts.test.ts`
Expected: FAIL — `ENOENT: no such file or directory, open 'src/styles/fonts.css'`.

Run: `scripts/pytest.sh tests/test_health.py -v`
Expected: `test_spa_serves_woff2_as_font` FAILS on the content-type assertion (e.g. `application/octet-stream`). If the image's MIME database happens to know `.woff2` already it may PASS; keep the explicit registration of Step 6 anyway (same reasoning as the `.webp` line above it).

- [ ] **Step 4: Write the vendoring script and its npm entry**

Create `web/scripts/vendor-fonts.mjs`:

```js
// One-off vendoring of the UI fonts (scenes UI spec §2.7): Cinzel, Alegreya and Literata as
// woff2, latin + latin-ext subsets, copied from the @fontsource 5.3.0 packages on jsDelivr (the
// same files npm would install: unmodified Google Fonts builds). Writes public/fonts/<pkg>/
// (+ the family's OFL licence as OFL.txt) and generates src/styles/fonts.css.
// Run from web/ with `scripts/npm.sh run fonts`. The output is committed, so neither the Docker
// build nor the running app ever downloads a font.
import { mkdir, writeFile } from 'node:fs/promises';

const VERSION = '5.3.0';
const RANGES = {
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext':
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
};
const FACES = [
  { family: 'Cinzel', pkg: 'cinzel', weight: 600, style: 'normal' },
  { family: 'Cinzel', pkg: 'cinzel', weight: 700, style: 'normal' },
  { family: 'Alegreya', pkg: 'alegreya', weight: 400, style: 'normal' },
  { family: 'Alegreya', pkg: 'alegreya', weight: 400, style: 'italic' },
  { family: 'Alegreya', pkg: 'alegreya', weight: 700, style: 'normal' },
  { family: 'Literata', pkg: 'literata', weight: 400, style: 'normal' },
  { family: 'Literata', pkg: 'literata', weight: 600, style: 'normal' },
];

const cdn = (pkg, path) => `https://cdn.jsdelivr.net/npm/@fontsource/${pkg}@${VERSION}/${path}`;

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

for (const pkg of [...new Set(FACES.map((f) => f.pkg))]) {
  await mkdir(`public/fonts/${pkg}`, { recursive: true });
  await writeFile(`public/fonts/${pkg}/OFL.txt`, await download(cdn(pkg, 'LICENSE')));
}

const blocks = [];
for (const f of FACES) {
  for (const subset of ['latin-ext', 'latin']) {
    const file = `${f.pkg}-${subset}-${f.weight}-${f.style}.woff2`;
    await writeFile(`public/fonts/${f.pkg}/${file}`, await download(cdn(f.pkg, `files/${file}`)));
    blocks.push(
      [
        '@font-face {',
        `  font-family: '${f.family}';`,
        `  font-style: ${f.style};`,
        `  font-weight: ${f.weight};`,
        '  font-display: swap;',
        `  src: url('/fonts/${f.pkg}/${file}') format('woff2');`,
        `  unicode-range: ${RANGES[subset]};`,
        '}',
      ].join('\n'),
    );
    console.log(`fonts: ${file}`);
  }
}

await mkdir('src/styles', { recursive: true });
await writeFile(
  'src/styles/fonts.css',
  `/* Generated by web/scripts/vendor-fonts.mjs (@fontsource ${VERSION}) - do not edit by hand. */\n\n${blocks.join('\n\n')}\n`,
);
```

In `web/package.json`, add one line to `"scripts"` (after `"icons"`, keep a trailing-comma-free JSON):

```json
    "icons": "node scripts/make-icons.mjs",
    "fonts": "node scripts/vendor-fonts.mjs"
```

- [ ] **Step 5: Run the script**

Run: `scripts/npm.sh run fonts`
Expected: 14 lines `fonts: <file>.woff2`, exit 0. Then `ls web/public/fonts/*` shows, per family, `OFL.txt` plus its woff2 files (cinzel 4, alegreya 6, literata 4), and `web/src/styles/fonts.css` exists.

- [ ] **Step 6: Wire the fonts in**

`web/src/main.ts` — import the fonts before `app.css`:

```ts
import { mount } from 'svelte';
import './styles/fonts.css';
import './app.css';
import { startRouter } from './lib/router.svelte';
import App from './App.svelte';

startRouter();

export default mount(App, { target: document.getElementById('app')! });
```

`web/src/app.css` — replace the header comment and the two font tokens in the first `:root` block, and add the reading token:

```css
/* Theme tokens (spec §5 SP1: marble white, terracotta, olive, Aegean blue). Fonts are
   self-hosted woff2 (scenes UI spec §2.7, src/styles/fonts.css): Cinzel for titles and place
   names (caps only), Alegreya for UI and story text, Literata for the dictation text. */
```

```css
  --font-display: 'Cinzel', 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  --font-body: 'Alegreya', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif;
  --font-reading: 'Literata', Georgia, 'Times New Roman', serif;
```

In each of these four rules change `font-family: var(--font-body);` to `font-family: var(--font-reading);` (only inside the named rule, nothing else in those files):
- `web/src/components/Dictation.svelte`, rule `.draft { ... }`
- `web/src/components/TokenText.svelte`, rule `.tokens { ... }`
- `web/src/components/Proofreading.svelte`, rule `.text textarea { ... }`
- `web/src/components/WordEditor.svelte`, rule `input { ... }`

`web/index.html` — after the `<link rel="manifest" …>` line add:

```html
    <link rel="preload" href="/fonts/alegreya/alegreya-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/fonts/cinzel/cinzel-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin />
```

`server/app/main.py` — below `mimetypes.add_type("image/webp", ".webp")` add:

```python
# Same story for the self-hosted UI fonts (scenes UI spec §2.7, web/public/fonts/*.woff2).
mimetypes.add_type("font/woff2", ".woff2")
```

Create `ASSETS-LICENSES.md` at the repo root:

```markdown
# Third-party assets and licences

Everything the game ships that was not made for it. The art is generated locally (see
`docs/art/style-guide.md`) and is not listed here. Audio credits (scenes UI spec §7) are added
in UI5.

## Fonts (scenes UI spec §2.7)

Self-hosted woff2 files under `web/public/fonts/`, latin + latin-ext subsets only, copied from
the `@fontsource/*` 5.3.0 packages (unmodified Google Fonts builds) by
`web/scripts/vendor-fonts.mjs`. All three families are under the SIL Open Font License 1.1; the
full licence text ships next to the files as `OFL.txt`.

| Family | Faces | Copyright | Licence |
|---|---|---|---|
| Cinzel | 600, 700 | Copyright 2020 The Cinzel Project Authors (https://github.com/NDISCOVER/Cinzel) | OFL-1.1, `web/public/fonts/cinzel/OFL.txt` |
| Alegreya | 400, 400 italic, 700 | Copyright 2011 The Alegreya Project Authors (https://github.com/huertatipografica/Alegreya) | OFL-1.1, `web/public/fonts/alegreya/OFL.txt` |
| Literata | 400, 600 | Copyright 2017 The Literata Project Authors (https://github.com/googlefonts/literata) | OFL-1.1, `web/public/fonts/literata/OFL.txt` |
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `scripts/npm.sh run test -- src/styles/fonts.test.ts` → Expected: 5 passed.
Run: `scripts/pytest.sh tests/test_health.py -v` → Expected: 3 passed.
Run: `scripts/npm.sh run check` → Expected: `svelte-check found 0 errors`.
Run: `scripts/npm.sh run test` → Expected: every vitest file passes (nothing else regressed).

- [ ] **Step 8: Commit**

```bash
P="web/scripts/vendor-fonts.mjs web/package.json web/public/fonts web/src/styles/fonts.css web/src/styles/fonts.test.ts web/src/main.ts web/src/app.css web/index.html web/src/components/Dictation.svelte web/src/components/TokenText.svelte web/src/components/Proofreading.svelte web/src/components/WordEditor.svelte server/app/main.py server/tests/test_health.py ASSETS-LICENSES.md"
git add $P && git commit -m "UI1: self-hosted Cinzel, Alegreya and Literata fonts

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

---

### Task 2: UI kit — tokens, parchment, bronze, marble, laurel

**Files:**
- Create: `web/src/styles/kit.css`, `web/src/styles/kit.test.ts`
- Create: `web/src/lib/ui/contrast.ts`, `web/src/lib/ui/contrast.test.ts`
- Create: `web/src/lib/ui/laurel.ts`, `web/src/lib/ui/laurel.test.ts`
- Create: `web/src/components/ui/LaurelBar.svelte`
- Modify: `web/src/main.ts` (import `kit.css` after `app.css`)

**Interfaces:**
- Consumes: `--font-display`, `--font-body`, `--ink`, `--gold`, `--gold-light` (app.css).
- Produces:
  - CSS tokens: `--parchment` (rgba), `--parchment-solid #f3e6c8`, `--parchment-edge`, `--parchment-shadow`, `--bronze #8a5a28`, `--bronze-light #c89450`, `--bronze-dark #5a3a18`, `--bronze-ink #fff7e6`, `--marble-plaque`, `--marble-vein`, `--laurel`, `--laurel-light`, `--laurel-off`, `--night #15121a`, `--scrim`, `--kit-radius`.
  - CSS classes: `.kit-parchment`, `.kit-scroll`, `.kit-bronze`, `.kit-plaque`, `.kit-banner`, `.sr-only`, `.idle-bob`, `.idle-sway`, `.idle-breathe`, `.idle-none`.
  - Keyframes: `kit-glow`, `kit-label-bob` (keeps `translateX(-50%)`), `kit-flash`, `kit-sway`, `kit-breathe`.
  - `contrastRatio(a: string, b: string): number` and `luminance(hex: string): number` in `web/src/lib/ui/contrast.ts` (`#rrggbb` only, throws otherwise).
  - `LAUREL_LEAVES = 10`, `laurelLeaves(value: number, max: number, total?: number): number` in `web/src/lib/ui/laurel.ts`.
  - `LaurelBar.svelte` props `{ value: number; max: number; label: string; testId?: string }`; root is `role="progressbar"` with `aria-label={label}`; its text content includes `label`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/ui/contrast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance } from './contrast';

describe('contrastRatio (WCAG 2.x)', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#8a5a28', '#8a5a28')).toBeCloseTo(1, 5);
  });
  it('is symmetric', () => {
    expect(contrastRatio('#2b2a28', '#f3e6c8')).toBeCloseTo(contrastRatio('#f3e6c8', '#2b2a28'), 10);
  });
  it('rejects anything but #rrggbb', () => {
    expect(() => luminance('red')).toThrow();
    expect(() => luminance('#fff')).toThrow();
  });
});
```

`web/src/lib/ui/laurel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LAUREL_LEAVES, laurelLeaves } from './laurel';

describe('laurelLeaves', () => {
  it('lights one leaf per tenth of the way to the next rank, rounding down', () => {
    expect(LAUREL_LEAVES).toBe(10);
    expect(laurelLeaves(0, 150)).toBe(0);
    expect(laurelLeaves(75, 150)).toBe(5);
    expect(laurelLeaves(149, 150)).toBe(9);
    expect(laurelLeaves(150, 150)).toBe(10);
  });
  it('clamps out-of-range values', () => {
    expect(laurelLeaves(-5, 150)).toBe(0);
    expect(laurelLeaves(400, 150)).toBe(10);
  });
  it('shows a full laurel when there is no next rank (max <= 0)', () => {
    expect(laurelLeaves(1, 0)).toBe(10);
  });
});
```

`web/src/styles/kit.test.ts`:

```ts
// Scenes UI spec §6: parchment panels, bronze buttons, marble plaques, laurel bar - CSS first.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio } from '../lib/ui/contrast';

const css = readFileSync('src/styles/kit.css', 'utf-8');
const tokens: Record<string, string> = Object.fromEntries(
  [...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [m[1], m[2]]),
);
const INK = '#2b2a28';

describe('UI kit (scenes spec §6)', () => {
  it('defines the kit classes', () => {
    for (const cls of ['kit-parchment', 'kit-scroll', 'kit-bronze', 'kit-plaque', 'kit-banner', 'sr-only', 'idle-bob', 'idle-sway', 'idle-breathe']) {
      expect(css, cls).toMatch(new RegExp(`\\.${cls}\\s*\\{`));
    }
  });

  it('keeps text legible on its own surfaces', () => {
    expect(contrastRatio(INK, tokens['parchment-solid'])).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(tokens['bronze-ink'], tokens['bronze'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(tokens['bronze-ink'], tokens['night'])).toBeGreaterThanOrEqual(7);
  });

  it('never defines a red (orange is for Éris, red for nobody)', () => {
    for (const [name, hex] of Object.entries(tokens)) {
      const n = parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      expect(r >= 200 && g < 60 && b < 60, name).toBe(false);
    }
  });

  it('declares the idle and tap keyframes the scene components use', () => {
    for (const k of ['kit-glow', 'kit-label-bob', 'kit-flash', 'kit-sway', 'kit-breathe']) {
      expect(css).toContain(`@keyframes ${k}`);
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `scripts/npm.sh run test -- src/lib/ui src/styles/kit.test.ts`
Expected: FAIL — cannot resolve `./contrast`, `./laurel`, and `ENOENT … src/styles/kit.css`.

- [ ] **Step 3: Implement the pure helpers**

`web/src/lib/ui/contrast.ts`:

```ts
// WCAG 2.x relative luminance and contrast ratio, used by the UI kit tests to keep text on
// parchment/bronze/night legible (scenes UI spec §2.4 "legibility first").
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
```

`web/src/lib/ui/laurel.ts`:

```ts
// The laurel XP bar (scenes UI spec §6): a branch of LAUREL_LEAVES leaves that light up toward
// the next rank. Rounds down, so the last leaf only lights when the rank is actually reached.
export const LAUREL_LEAVES = 10;

export function laurelLeaves(value: number, max: number, total = LAUREL_LEAVES): number {
  if (max <= 0) return total;
  const ratio = Math.min(1, Math.max(0, value / max));
  return Math.floor(ratio * total);
}
```

- [ ] **Step 4: Write the kit stylesheet**

`web/src/styles/kit.css`:

```css
/* UI kit (scenes UI spec §6): semi-transparent parchment panels, bronze embossed buttons, marble
   plaques for place names, the laurel XP bar tokens, and the idle / tap keyframes of the scene
   engine. CSS only; Krea textures come later where CSS can't do it. No red anywhere. */
:root {
  --parchment: rgba(246, 236, 212, 0.88);
  --parchment-solid: #f3e6c8;
  --parchment-edge: #c9ab74;
  --parchment-shadow: rgba(92, 64, 24, 0.3);
  --bronze: #8a5a28;
  --bronze-light: #c89450;
  --bronze-dark: #5a3a18;
  --bronze-ink: #fff7e6;
  --marble-plaque: #efe9df;
  --marble-vein: rgba(110, 100, 90, 0.16);
  --laurel: #6b7a3a;
  --laurel-light: #a4b36a;
  --laurel-off: rgba(255, 247, 230, 0.28);
  --night: #15121a;
  --scrim: rgba(21, 18, 26, 0.55);
  --kit-radius: 12px;
}

.kit-parchment {
  background:
    radial-gradient(ellipse at 20% 0%, rgba(255, 255, 255, 0.35), transparent 60%),
    linear-gradient(180deg, var(--parchment), rgba(236, 219, 184, 0.9));
  color: var(--ink);
  border: 1px solid var(--parchment-edge);
  border-radius: var(--kit-radius);
  box-shadow:
    inset 0 0 28px rgba(140, 100, 40, 0.18),
    0 6px 18px var(--parchment-shadow);
  font-family: var(--font-body);
  -webkit-backdrop-filter: blur(2px);
  backdrop-filter: blur(2px);
}

/* Rolled scroll: two wooden rods above and below a parchment panel. */
.kit-scroll {
  position: relative;
}
.kit-scroll::before,
.kit-scroll::after {
  content: '';
  position: absolute;
  left: -10px;
  right: -10px;
  height: 14px;
  border-radius: 7px;
  background: linear-gradient(180deg, var(--bronze-light), var(--bronze-dark));
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
.kit-scroll::before {
  top: -7px;
}
.kit-scroll::after {
  bottom: -7px;
}

.kit-bronze {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  min-width: 48px;
  padding: 10px 20px;
  border: 1px solid var(--bronze-dark);
  border-radius: 10px;
  background: linear-gradient(180deg, var(--bronze-light) 0%, var(--bronze) 45%, var(--bronze-dark) 100%);
  color: var(--bronze-ink);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.04em;
  text-decoration: none;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.45);
  box-shadow:
    inset 0 1px 0 rgba(255, 240, 200, 0.6),
    inset 0 -2px 0 rgba(0, 0, 0, 0.25),
    0 3px 8px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition:
    transform 0.1s ease,
    filter 0.15s ease;
}
.kit-bronze:hover {
  filter: brightness(1.08);
}
.kit-bronze:active {
  transform: translateY(1px);
}
.kit-bronze:focus-visible {
  outline: 3px solid var(--gold-light);
  outline-offset: 2px;
}

/* Marble plaque for scene names (Cinzel, caps). */
.kit-plaque {
  display: inline-block;
  padding: 6px 18px;
  background:
    repeating-linear-gradient(115deg, transparent 0 18px, var(--marble-vein) 18px 19px, transparent 19px 41px),
    linear-gradient(180deg, #faf6ef, var(--marble-plaque));
  color: var(--ink);
  border: 1px solid #cfc5b4;
  border-radius: 6px;
  box-shadow:
    inset 0 0 0 3px rgba(255, 255, 255, 0.6),
    inset 0 0 0 4px #d8cdbb,
    0 4px 10px rgba(0, 0, 0, 0.3);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Dark ribbon banner over painted scenes (weekly goal, notices). */
.kit-banner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid var(--bronze-light);
  background: linear-gradient(180deg, rgba(21, 18, 26, 0.74), rgba(21, 18, 26, 0.6));
  color: var(--bronze-ink);
  font-family: var(--font-body);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.3);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Idle presets of scene layers (SceneLayerDef.idle). SceneLayer switches to .idle-none under
   reduced motion, so these never need their own media query. */
.idle-none {
  animation: none;
}
.idle-bob {
  animation: float 4s ease-in-out infinite;
}
.idle-sway {
  animation: kit-sway 5s ease-in-out infinite;
  transform-origin: 50% 100%;
}
.idle-breathe {
  animation: kit-breathe 4.5s ease-in-out infinite;
  transform-origin: 50% 100%;
}

@keyframes kit-glow {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 0.6;
  }
}
@keyframes kit-label-bob {
  0%,
  100% {
    transform: translate(-50%, 0);
  }
  50% {
    transform: translate(-50%, -4px);
  }
}
@keyframes kit-flash {
  0% {
    opacity: 1;
    filter: brightness(1.6);
  }
  100% {
    opacity: 0.4;
    filter: none;
  }
}
@keyframes kit-sway {
  0%,
  100% {
    transform: rotate(-1deg);
  }
  50% {
    transform: rotate(1deg);
  }
}
@keyframes kit-breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}
```

In `web/src/main.ts`, add `import './styles/kit.css';` on the line right after `import './app.css';`.

- [ ] **Step 5: Write the LaurelBar component**

`web/src/components/ui/LaurelBar.svelte`:

```svelte
<script lang="ts">
  // The laurel XP bar (scenes UI spec §6 UI kit): a branch of leaves that light up toward the next
  // rank. Olive, never orange (orange is Éris's colour). Accessible as a progressbar.
  import { LAUREL_LEAVES, laurelLeaves } from '../../lib/ui/laurel';

  let { value, max, label, testId }: { value: number; max: number; label: string; testId?: string } = $props();

  const lit = $derived(laurelLeaves(value, max));
</script>

<div
  class="laurel"
  role="progressbar"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuenow={value}
  data-testid={testId}
>
  <span class="laurel-caption">{label}</span>
  <span class="laurel-branch" aria-hidden="true">
    {#each Array.from({ length: LAUREL_LEAVES }, (_, i) => i) as i (i)}
      <span class="leaf" class:lit={i < lit} class:right={i >= LAUREL_LEAVES / 2}></span>
    {/each}
  </span>
</div>

<style>
  .laurel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    color: var(--bronze-ink);
  }
  .laurel-caption {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 15px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    white-space: nowrap;
  }
  .laurel-branch {
    display: flex;
    gap: 3px;
  }
  .leaf {
    width: 12px;
    height: 20px;
    border-radius: 100% 0;
    background: var(--laurel-off);
    transform: rotate(-30deg);
  }
  .leaf.right {
    transform: rotate(30deg) scaleX(-1);
  }
  .leaf.lit {
    background: linear-gradient(135deg, var(--laurel-light), var(--laurel));
    box-shadow: 0 0 6px rgba(164, 179, 106, 0.6);
  }
</style>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `scripts/npm.sh run test -- src/lib/ui src/styles` → Expected: all pass (contrast 3, laurel 3, kit 4, fonts 5).
Run: `scripts/npm.sh run check` → Expected: `svelte-check found 0 errors`.

- [ ] **Step 7: Commit**

```bash
P="web/src/styles/kit.css web/src/styles/kit.test.ts web/src/lib/ui web/src/components/ui/LaurelBar.svelte web/src/main.ts"
git add $P && git commit -m "UI1: UI kit (parchment, bronze, marble plaque, laurel bar)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

---

### Task 3: Scene data model, stage geometry and validation

**Files:**
- Create: `web/src/lib/scene/types.ts`
- Create: `web/src/lib/scene/geometry.ts`, `web/src/lib/scene/geometry.test.ts`
- Create: `web/src/lib/scene/validate.ts`, `web/src/lib/scene/validate.test.ts`

**Interfaces:**
- Consumes: `RouteName` from `web/src/lib/routes.ts`; `CampResponse`, `WorldCatalog` from `web/src/lib/world/types.ts`.
- Produces (exact names, used by every later task):
  - `types.ts`: `type Pt = [number, number]`; `interface EllipseShape { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }`; `interface PolygonShape { kind: 'polygon'; points: Pt[] }`; `type HotspotShape = EllipseShape | PolygonShape`; `type ShapeMap = Record<string, HotspotShape>`; `interface Box { x: number; y: number; w: number; h: number }`; `type Depth = 0 | 1 | 2 | 3`; `type IdlePreset = 'none' | 'bob' | 'sway' | 'breathe'`; `type FxPreset = 'none' | 'embers' | 'dust'`; `type SceneId = 'camp'`; `interface SceneLayerDef { id; src; alt; x; y; scale; depth: Depth; idle: IdlePreset }` (x = horizontal centre, y = **bottom edge**, scale = width, all in art %); `interface SceneContext { camp: CampResponse | null; catalog: WorldCatalog | null }`; `interface HotspotState { visible: boolean; locked: boolean; isNew: boolean; badge: number | null; caption: string | null }`; `const IDLE_HOTSPOT: HotspotState`; `interface HotspotDef { id: string; label: string; target: RouteName; shape: HotspotShape; labelPos: 'above' | 'below'; state: (ctx: SceneContext) => HotspotState }`; `interface SceneDef { id: SceneId; title: string; background: string; layers: SceneLayerDef[]; hotspots: HotspotDef[]; ambience: { particles: FxPreset; music: string | null }; narrator: { enter: string | null; firstVisit: string | null }; preload: string[] }`; `type SpeakerId = 'dragon' | 'pythia' | 'owl' | 'eris'`; `interface DialogueLine { speaker: SpeakerId; name: string; portrait: string; portraitFilter?: string; text: string }`.
  - `geometry.ts`: `ART_ASPECT = 16 / 9`; `SAFE_ZONE: Box = { x: 12.5, y: 0, w: 75, h: 100 }`; `HUD_BAND = 14`; `DIALOGUE_DOCK: Box = { x: 27, y: 80, w: 60.5, h: 20 }`; `PARALLAX_STEP = 0.6`; `interface StageBox { left; top; width; height }` (px); `stageBox(vw: number, vh: number): StageBox`; `shapeBox(s: HotspotShape): Box`; `boxInside(inner: Box, outer: Box): boolean`; `boxesOverlap(a: Box, b: Box): boolean` (touching edges do not overlap); `clipPath(s: HotspotShape): string` (relative to the shape's own box); `parallaxOffset(depth: Depth, nx: number, ny: number): { x: number; y: number }` (art %, never `-0`); `pointerToNorm(clientX: number, clientY: number, vw: number, vh: number): { nx: number; ny: number }` (each in [-1, 1]).
  - `validate.ts`: `validateShapes(shapes: ShapeMap): string[]`; `validateScene(scene: SceneDef): string[]` (empty array = valid; exact message formats below).

- [ ] **Step 1: Write the failing tests**

`web/src/lib/scene/geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DIALOGUE_DOCK,
  HUD_BAND,
  SAFE_ZONE,
  boxInside,
  boxesOverlap,
  clipPath,
  parallaxOffset,
  pointerToNorm,
  shapeBox,
  stageBox,
} from './geometry';

describe('stageBox (Ruling 3)', () => {
  it('fits the 16:9 art to the height on iPad landscape, cropping the sides', () => {
    const b = stageBox(1180, 820);
    expect(b.width).toBeCloseTo(1457.78, 1);
    expect(b.height).toBeCloseTo(820, 5);
    expect(b.left).toBeCloseTo(-138.89, 1);
    expect(b.top).toBeCloseTo(0, 5);
  });
  it('shows the whole art on a 16:9 laptop', () => {
    const b = stageBox(1280, 720);
    expect(b.width).toBeCloseTo(1280, 5);
    expect(b.height).toBeCloseTo(720, 5);
    expect(b.left).toBeCloseTo(0, 5);
    expect(b.top).toBeCloseTo(0, 5);
  });
  it('letterboxes the sides on ultra-wide screens', () => {
    const b = stageBox(2560, 1080);
    expect(b.width).toBeCloseTo(1920, 5);
    expect(b.left).toBeCloseTo(320, 5);
    expect(b.top).toBeCloseTo(0, 5);
  });
  it('shrinks below 4:3 so the safe zone stays whole', () => {
    const b = stageBox(1000, 900);
    expect(b.width).toBeCloseTo(1333.33, 1);
    expect(b.height).toBeCloseTo(750, 1);
    expect(b.top).toBeCloseTo(75, 1);
  });
  it('always keeps the 4:3 safe zone inside the viewport', () => {
    for (const [vw, vh] of [[1180, 820], [1024, 768], [1366, 1024], [1280, 720], [1440, 900], [2560, 1080], [1000, 900]]) {
      const b = stageBox(vw, vh);
      const left = b.left + (SAFE_ZONE.x / 100) * b.width;
      const right = b.left + ((SAFE_ZONE.x + SAFE_ZONE.w) / 100) * b.width;
      expect(left, `${vw}x${vh}`).toBeGreaterThanOrEqual(-1e-6);
      expect(right, `${vw}x${vh}`).toBeLessThanOrEqual(vw + 1e-6);
      expect(b.top + b.height, `${vw}x${vh}`).toBeLessThanOrEqual(vh + 1e-6);
    }
  });
});

describe('shapes', () => {
  it('boxes an ellipse and a polygon', () => {
    expect(shapeBox({ kind: 'ellipse', cx: 30, cy: 53, rx: 7.5, ry: 8 })).toEqual({ x: 22.5, y: 45, w: 15, h: 16 });
    expect(shapeBox({ kind: 'polygon', points: [[10, 20], [30, 20], [20, 40]] })).toEqual({ x: 10, y: 20, w: 20, h: 20 });
  });
  it('clips relative to the shape box', () => {
    expect(clipPath({ kind: 'ellipse', cx: 50, cy: 50, rx: 5, ry: 5 })).toBe('ellipse(50% 50% at 50% 50%)');
    expect(clipPath({ kind: 'polygon', points: [[10, 20], [30, 20], [20, 40]] })).toBe('polygon(0% 0%, 100% 0%, 50% 100%)');
  });
  it('treats touching boxes as not overlapping', () => {
    expect(boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(boxesOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 10, h: 10 })).toBe(true);
  });
  it('checks containment inclusively', () => {
    expect(boxInside({ x: 12.5, y: 15, w: 75, h: 10 }, SAFE_ZONE)).toBe(true);
    expect(boxInside({ x: 12, y: 15, w: 5, h: 10 }, SAFE_ZONE)).toBe(false);
  });
  it('exposes the layout constants of Ruling 3', () => {
    expect(SAFE_ZONE).toEqual({ x: 12.5, y: 0, w: 75, h: 100 });
    expect(HUD_BAND).toBe(14);
    expect(DIALOGUE_DOCK).toEqual({ x: 27, y: 80, w: 60.5, h: 20 });
  });
});

describe('parallax', () => {
  it('moves deeper layers further, against the pointer, half as much vertically', () => {
    expect(parallaxOffset(2, 1, -1)).toEqual({ x: -1.2, y: 0.6 });
    expect(parallaxOffset(3, -1, 0)).toEqual({ x: 1.8, y: 0 });
  });
  it('never moves depth 0 and never returns -0', () => {
    const o = parallaxOffset(0, 1, 1);
    expect(o).toEqual({ x: 0, y: 0 });
    expect(Object.is(o.x, -0)).toBe(false);
    expect(Object.is(parallaxOffset(2, 0, 0).x, -0)).toBe(false);
  });
  it('normalises the pointer to [-1, 1]', () => {
    expect(pointerToNorm(0, 0, 1000, 500)).toEqual({ nx: -1, ny: -1 });
    expect(pointerToNorm(500, 250, 1000, 500)).toEqual({ nx: 0, ny: 0 });
    expect(pointerToNorm(2000, -5, 1000, 500)).toEqual({ nx: 1, ny: -1 });
    expect(pointerToNorm(10, 10, 0, 0)).toEqual({ nx: 0, ny: 0 });
  });
});
```

`web/src/lib/scene/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { IDLE_HOTSPOT, type HotspotDef, type HotspotShape, type SceneDef, type ShapeMap } from './types';
import { validateScene, validateShapes } from './validate';

const e = (cx: number, cy: number, r = 5): HotspotShape => ({ kind: 'ellipse', cx, cy, rx: r, ry: r });

describe('validateShapes', () => {
  it('accepts well-placed ellipses and polygons', () => {
    const ok: ShapeMap = { a: e(30, 50), b: { kind: 'polygon', points: [[50, 40], [60, 40], [55, 50]] } };
    expect(validateShapes(ok)).toEqual([]);
  });
  it('rejects shapes outside the safe zone, under the HUD, or on the dialogue dock', () => {
    expect(validateShapes({ a: e(10, 50) })).toEqual(['a: outside the 4:3 safe zone (x 12.5-87.5)']);
    expect(validateShapes({ a: e(50, 12, 4) })).toEqual(['a: under the HUD band (y < 14)']);
    expect(validateShapes({ a: e(50, 85, 4) })).toEqual(['a: overlaps the dialogue dock']);
  });
  it('rejects overlapping hotspots and degenerate shapes', () => {
    expect(validateShapes({ a: e(40, 50), b: e(44, 50) })).toEqual(['a overlaps b']);
    expect(validateShapes({ a: { kind: 'ellipse', cx: 50, cy: 50, rx: 0, ry: 5 } })).toEqual(['a: radii must be > 0']);
    expect(validateShapes({ a: { kind: 'polygon', points: [[50, 50], [60, 60]] } })).toEqual([
      'a: a polygon needs at least 3 points',
    ]);
  });
});

describe('validateScene', () => {
  const def = (id: string, shape: HotspotShape): HotspotDef => ({
    id,
    label: id,
    target: 'library',
    shape,
    labelPos: 'below',
    state: () => IDLE_HOTSPOT,
  });
  it('reports duplicate ids and out-of-range layers', () => {
    const scene: SceneDef = {
      id: 'camp',
      title: 'Le camp',
      background: '/art/scenes/camp.webp',
      layers: [{ id: 'l', src: '/x.webp', alt: '', x: 120, y: 50, scale: 10, depth: 1, idle: 'none' }],
      hotspots: [def('a', e(30, 50)), def('a', e(60, 50))],
      ambience: { particles: 'none', music: null },
      narrator: { enter: null, firstVisit: null },
      preload: [],
    };
    expect(validateScene(scene)).toEqual(['duplicate hotspot id: a', 'layer l: position/scale out of range']);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `scripts/npm.sh run test -- src/lib/scene`
Expected: FAIL — cannot resolve `./geometry`, `./types`, `./validate`.

- [ ] **Step 3: Write the types**

`web/src/lib/scene/types.ts`:

```ts
// Scene data types (scenes UI spec §4). Coordinates are "art %": 0-100 of the 16:9 art frame,
// x left to right, y top to bottom, so scene data survives any art swap of the same framing.
import type { RouteName } from '../routes';
import type { CampResponse, WorldCatalog } from '../world/types';

export type Pt = [number, number];

export interface EllipseShape {
  kind: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface PolygonShape {
  kind: 'polygon';
  points: Pt[];
}

export type HotspotShape = EllipseShape | PolygonShape;

/** Hotspot id -> shape. The `<scene>.shapes.ts` files are exactly this, generated by `?edit`. */
export type ShapeMap = Record<string, HotspotShape>;

/** Axis-aligned box in art %. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Parallax plane: 0 = the background plane (never moves), 1-3 = cut-out layers (spec: ≤ 3). */
export type Depth = 0 | 1 | 2 | 3;
export type IdlePreset = 'none' | 'bob' | 'sway' | 'breathe';
export type FxPreset = 'none' | 'embers' | 'dust';
export type SceneId = 'camp';

/** A positioned cut-out image. `x` = horizontal centre, `y` = bottom edge (feet on the ground),
 *  `scale` = width, all in art %. */
export interface SceneLayerDef {
  id: string;
  src: string;
  /** '' for pure decoration. */
  alt: string;
  x: number;
  y: number;
  scale: number;
  depth: Depth;
  idle: IdlePreset;
}

/** What hotspot state functions may read. `camp` is null until /camp has loaded. */
export interface SceneContext {
  camp: CampResponse | null;
  catalog: WorldCatalog | null;
}

export interface HotspotState {
  visible: boolean;
  locked: boolean;
  /** Draws the stronger "something new here" glow. */
  isNew: boolean;
  badge: number | null;
  /** Short second line under the place name (dragon name, reward, counts). */
  caption: string | null;
}

export const IDLE_HOTSPOT: HotspotState = { visible: true, locked: false, isNew: false, badge: null, caption: null };

export interface HotspotDef {
  id: string;
  /** Place name shown on the label (Cinzel caps). */
  label: string;
  target: RouteName;
  shape: HotspotShape;
  labelPos: 'above' | 'below';
  state: (ctx: SceneContext) => HotspotState;
}

export interface SceneDef {
  id: SceneId;
  /** Marble plaque text. */
  title: string;
  background: string;
  layers: SceneLayerDef[];
  hotspots: HotspotDef[];
  ambience: { particles: FxPreset; music: string | null };
  /** Dialogue event keys for UI5 (content/dialogue/*.json); unused in UI1. */
  narrator: { enter: string | null; firstVisit: string | null };
  /** Backgrounds the player is likely to open next (spec §4 performance). */
  preload: string[];
}

export type SpeakerId = 'dragon' | 'pythia' | 'owl' | 'eris';

export interface DialogueLine {
  speaker: SpeakerId;
  name: string;
  portrait: string;
  portraitFilter?: string;
  text: string;
}
```

- [ ] **Step 4: Write geometry and validation**

`web/src/lib/scene/geometry.ts`:

```ts
// Stage geometry (scenes UI spec §4 + plan Ruling 3): the 16:9 art box, the centred 4:3 safe
// zone, hotspot shape boxes and the pointer parallax. Pure functions, art % unless noted.
import type { Box, Depth, HotspotShape } from './types';

export const ART_ASPECT = 16 / 9;
/** Centred 4:3 zone of the 16:9 art: always visible, so every interactive element lives here. */
export const SAFE_ZONE: Box = { x: 12.5, y: 0, w: 75, h: 100 };
/** Hotspots start below this y so the viewport-anchored HUD never covers them. */
export const HUD_BAND = 14;
/** Where the DialogueBox sits; hotspots must not overlap it. */
export const DIALOGUE_DOCK: Box = { x: 27, y: 80, w: 60.5, h: 20 };
/** Art % of horizontal travel per depth unit at full pointer deflection. */
export const PARALLAX_STEP = 0.6;

/** The art box in viewport pixels. */
export interface StageBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100 + 0;

/** Height-fit 16:9 box (= cover on every landscape viewport down to 4:3, side bands when wider
 *  than 16:9), shrunk when narrower than 4:3 so the safe zone is never cropped. */
export function stageBox(vw: number, vh: number): StageBox {
  const width = Math.min(vh * ART_ASPECT, vw / (SAFE_ZONE.w / 100));
  const height = width / ART_ASPECT;
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height };
}

export function shapeBox(s: HotspotShape): Box {
  if (s.kind === 'ellipse') {
    return { x: round2(s.cx - s.rx), y: round2(s.cy - s.ry), w: round2(2 * s.rx), h: round2(2 * s.ry) };
  }
  const xs = s.points.map((p) => p[0]);
  const ys = s.points.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: round2(Math.max(...xs) - x), h: round2(Math.max(...ys) - y) };
}

export function boxInside(inner: Box, outer: Box): boolean {
  const eps = 1e-9;
  return (
    inner.x >= outer.x - eps &&
    inner.y >= outer.y - eps &&
    inner.x + inner.w <= outer.x + outer.w + eps &&
    inner.y + inner.h <= outer.y + outer.h + eps
  );
}

/** Strict overlap: boxes that only touch along an edge do not overlap. */
export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** CSS clip-path for an element that covers exactly `shapeBox(s)`. */
export function clipPath(s: HotspotShape): string {
  if (s.kind === 'ellipse') return 'ellipse(50% 50% at 50% 50%)';
  const b = shapeBox(s);
  const pts = s.points.map(([x, y]) => `${round2(((x - b.x) / b.w) * 100)}% ${round2(((y - b.y) / b.h) * 100)}%`);
  return `polygon(${pts.join(', ')})`;
}

/** Offset in art % for a layer at `depth`, pointer at (nx, ny) in [-1, 1]. */
export function parallaxOffset(depth: Depth, nx: number, ny: number): { x: number; y: number } {
  return { x: round2(-nx * depth * PARALLAX_STEP), y: round2(-ny * depth * PARALLAX_STEP * 0.5) };
}

export function pointerToNorm(clientX: number, clientY: number, vw: number, vh: number): { nx: number; ny: number } {
  const c = (v: number) => Math.max(-1, Math.min(1, v)) + 0;
  return { nx: vw > 0 ? c((clientX / vw) * 2 - 1) : 0, ny: vh > 0 ? c((clientY / vh) * 2 - 1) : 0 };
}
```

`web/src/lib/scene/validate.ts`:

```ts
// Scene data checks (scenes UI spec §4, plan Ruling 3). Used by the scene unit tests and live by
// the ?edit hotspot editor. Returns human-readable problems; [] means valid.
import { DIALOGUE_DOCK, HUD_BAND, SAFE_ZONE, boxInside, boxesOverlap, shapeBox } from './geometry';
import type { SceneDef, ShapeMap } from './types';

export function validateShapes(shapes: ShapeMap): string[] {
  const problems: string[] = [];
  const entries = Object.entries(shapes);
  for (const [id, s] of entries) {
    if (s.kind === 'ellipse' && (s.rx <= 0 || s.ry <= 0)) problems.push(`${id}: radii must be > 0`);
    if (s.kind === 'polygon' && s.points.length < 3) problems.push(`${id}: a polygon needs at least 3 points`);
    const b = shapeBox(s);
    if (!boxInside(b, SAFE_ZONE)) {
      problems.push(`${id}: outside the 4:3 safe zone (x ${SAFE_ZONE.x}-${SAFE_ZONE.x + SAFE_ZONE.w})`);
    }
    if (b.y < HUD_BAND) problems.push(`${id}: under the HUD band (y < ${HUD_BAND})`);
    if (boxesOverlap(b, DIALOGUE_DOCK)) problems.push(`${id}: overlaps the dialogue dock`);
  }
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (boxesOverlap(shapeBox(entries[i][1]), shapeBox(entries[j][1]))) {
        problems.push(`${entries[i][0]} overlaps ${entries[j][0]}`);
      }
    }
  }
  return problems;
}

export function validateScene(scene: SceneDef): string[] {
  const problems: string[] = [];
  const ids = scene.hotspots.map((h) => h.id);
  for (const d of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) problems.push(`duplicate hotspot id: ${d}`);
  problems.push(...validateShapes(Object.fromEntries(scene.hotspots.map((h) => [h.id, h.shape]))));
  for (const l of scene.layers) {
    if (l.scale <= 0 || l.x < 0 || l.x > 100 || l.y < 0 || l.y > 100) {
      problems.push(`layer ${l.id}: position/scale out of range`);
    }
  }
  return problems;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `scripts/npm.sh run test -- src/lib/scene` → Expected: geometry 13 passed, validate 4 passed.
Run: `scripts/npm.sh run check` → Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
P="web/src/lib/scene/types.ts web/src/lib/scene/geometry.ts web/src/lib/scene/geometry.test.ts web/src/lib/scene/validate.ts web/src/lib/scene/validate.test.ts"
git add $P && git commit -m "UI1: scene data types, stage geometry and validation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

---

### Task 4: Camp scene data and the scene weight budget

**Files:**
- Create: `web/src/lib/world/scenes/camp.shapes.ts`
- Create: `web/src/lib/world/scenes/camp.ts`, `web/src/lib/world/scenes/camp.test.ts`
- Create: `web/src/lib/world/scenes/index.ts`, `web/src/lib/world/scenes/budget.test.ts`
- Modify: `web/src/lib/world/art.test.ts` (Ruling 12)

**Interfaces:**
- Consumes: Task 3 types and `validateScene`; `ART` (`web/src/lib/world/art.ts`); `stageLine`, `stageLabel`, `TINT_FILTERS` (`web/src/lib/world/dragon.ts`); `CampResponse`, `DragonOut`, `WorldCatalog` (`web/src/lib/world/types.ts`).
- Produces:
  - `camp.shapes.ts`: `CAMP_SHAPES` (keys `dragon, oracle, quests, parchemins, dossier, bestiary, cabin, boss`, in that order) — its text must stay byte-identical to `shapesToTs('camp', CAMP_SHAPES)` (Task 9 adds that round-trip test).
  - `camp.ts`: `type CampHotspotId`; `CAMP_HOTSPOTS: HotspotDef[]`; `CAMP_SCENE: SceneDef`; `CAMP_DRAGON_LAYER: Omit<SceneLayerDef, 'id' | 'src' | 'alt'>` = `{ x: 18, y: 80, scale: 9, depth: 2, idle: 'breathe' }`; `dragonCaption(d: DragonOut): string`; `bossRewardName(camp: CampResponse, catalog: WorldCatalog | null): string`; `campGreeting(profileName: string, camp: CampResponse): DialogueLine[]`.
  - `index.ts`: `SCENES: SceneDef[]`; `SCENE_BUDGET_BYTES = 600 * 1024`.
  - Hotspot → route: dragon→`dragon`, oracle→`oracle`, quests→`quests`, parchemins→`library`, dossier→`dossier`, bestiary→`bestiaire`, cabin→`cabin`, boss→`boss`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/world/scenes/camp.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateScene } from '../../scene/validate';
import type { CampResponse, LieutenantState, QuestOut, WorldCatalog } from '../types';
import { CAMP_HOTSPOTS, CAMP_SCENE, campGreeting, dragonCaption } from './camp';

function camp(over: Partial<CampResponse> = {}): CampResponse {
  return {
    profile: { id: 7, name: 'Ariane' } as CampResponse['profile'],
    xp: { total: 0, rank: 1, title: 'Recrue du camp', next_threshold: 150, rank_floor: 0 },
    dragon: { name: null, tint: 'bronze', stage: 'egg', neutralised: 0, available: 6, next_stage_at: 1, unlocked_tints: ['bronze'] },
    lieutenants: [],
    quests: [],
    oracle: { week: '2026-W39', status: 'sealed', reward_id: null },
    prophecies: [],
    weekly: { week: '2026-W39', target: 3, done: 0, reached: false },
    boss: { tier_available: null, tiers_won: [], active_quest_id: null },
    rewards_count: 0,
    small_tricks: { traps: 0, caught: 0 },
    ...over,
  };
}
const catalog = {
  boss_rewards: { '1': 'sandales' },
  rewards: { sandales: { id: 'sandales', kind: 'gear', name: "Sandales d'Hermès", desc: '', source: '' } },
} as unknown as WorldCatalog;
const state = (id: string, c: CampResponse | null, cat: WorldCatalog | null = null) =>
  CAMP_HOTSPOTS.find((h) => h.id === id)!.state({ camp: c, catalog: cat });

describe('camp hub scene', () => {
  it('is a valid scene: safe zone, HUD band, dialogue dock, no overlaps', () => {
    expect(validateScene(CAMP_SCENE)).toEqual([]);
  });

  it('routes every place to its existing screen', () => {
    expect(Object.fromEntries(CAMP_HOTSPOTS.map((h) => [h.id, h.target]))).toEqual({
      dragon: 'dragon',
      oracle: 'oracle',
      quests: 'quests',
      parchemins: 'library',
      dossier: 'dossier',
      bestiary: 'bestiaire',
      cabin: 'cabin',
      boss: 'boss',
    });
  });

  it('shows every place but the battle path before /camp has loaded', () => {
    for (const h of CAMP_HOTSPOTS) expect(h.state({ camp: null, catalog: null }).visible, h.id).toBe(h.id !== 'boss');
  });

  it('captions the dragon with its name, or its stage before it is named', () => {
    expect(dragonCaption(camp().dragon)).toBe('Un œuf de dragon');
    expect(dragonCaption({ ...camp().dragon, stage: 'hatchling' })).toBe('Dragonnet');
    expect(state('dragon', camp({ dragon: { ...camp().dragon, stage: 'hatchling', name: 'Braise' } })).caption).toBe('Braise');
  });

  it('marks the sealed Oracle as new, counts active quests, counts neutralised tricks', () => {
    expect(state('oracle', camp())).toMatchObject({ isNew: true, caption: 'Trois rouleaux scellés' });
    expect(state('oracle', camp({ oracle: { week: 'w', status: 'chosen', reward_id: null } }))).toMatchObject({
      isNew: false,
      caption: 'Quête en cours',
    });
    const quests = [
      { id: 1, kind: 'board', status: 'active' },
      { id: 2, kind: 'oracle', status: 'active' },
      { id: 3, kind: 'board', status: 'done' },
    ] as QuestOut[];
    expect(state('quests', camp({ quests })).badge).toBe(2);
    expect(state('quests', camp()).badge).toBeNull();
    const lieutenants = [
      { neutralised: true, available: true },
      { neutralised: false, available: true },
      { neutralised: false, available: false },
    ] as LieutenantState[];
    expect(state('bestiary', camp({ lieutenants })).caption).toBe('1 / 2 ruses neutralisées');
    expect(state('cabin', camp({ rewards_count: 3 })).caption).toBe('3 trésor(s)');
  });

  it('opens the battle path only when Éris can be fought, naming the reward known in advance', () => {
    expect(state('boss', camp()).visible).toBe(false);
    const ready = camp({ boss: { tier_available: 1, tiers_won: [], active_quest_id: null } });
    expect(state('boss', ready, catalog)).toMatchObject({ visible: true, isNew: true, caption: "Combat 1 : Sandales d'Hermès" });
    expect(state('boss', ready, null).caption).toBe('Combat 1 : une récompense');
    const engaged = camp({
      boss: { tier_available: 1, tiers_won: [], active_quest_id: 9 },
      quests: [{ id: 9, kind: 'boss', status: 'active' }] as QuestOut[],
    });
    expect(state('boss', engaged, catalog)).toMatchObject({ visible: true, isNew: false, caption: 'Un combat est déjà engagé contre Éris.' });
  });

  it('greets with two static dragon lines', () => {
    const lines = campGreeting('Ariane', camp());
    expect(lines.map((l) => l.text)).toEqual([
      'Bienvenue au camp, Ariane.',
      "L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.",
    ]);
    expect(lines[0]).toMatchObject({ speaker: 'dragon', name: "L'œuf", portrait: '/art/dragon/dragon_egg_cut.webp', portraitFilter: 'none' });
  });
});
```

`web/src/lib/world/scenes/budget.test.ts`:

```ts
// Scenes UI spec §4: "≤ 600 KB WebP per scene background [...] A test/script fails if a scene
// background exceeds the budget." Runs in scripts/check.sh via vitest.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { SCENES, SCENE_BUDGET_BYTES } from './index';

describe('scene weight budget', () => {
  it('keeps every scene background under public/art/scenes within 600 KB', () => {
    const files = readdirSync('public/art/scenes').filter((f) => f.endsWith('.webp'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(statSync(`public/art/scenes/${f}`).size, f).toBeLessThanOrEqual(SCENE_BUDGET_BYTES);
    }
  });

  it('points every scene background and preload at an existing WebP within budget', () => {
    for (const scene of SCENES) {
      for (const src of [scene.background, ...scene.preload]) {
        const file = 'public' + src;
        expect(existsSync(file), `${scene.id}: ${src}`).toBe(true);
        expect(src.endsWith('.webp'), src).toBe(true);
        expect(statSync(file).size, src).toBeLessThanOrEqual(SCENE_BUDGET_BYTES);
      }
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `scripts/npm.sh run test -- src/lib/world/scenes`
Expected: FAIL — cannot resolve `./camp` and `./index`.

- [ ] **Step 3: Write the camp geometry file (exact text; the editor regenerates it later)**

`web/src/lib/world/scenes/camp.shapes.ts`:

```ts
// Hotspot geometry of the camp scene, in art % (0-100) of the 16:9 art frame.
// Generated by the ?edit hotspot editor: paste its "Copier TS" output over this whole file.
import type { ShapeMap } from '../../scene/types';

export const CAMP_SHAPES = {
  dragon: { kind: 'ellipse', cx: 18, cy: 71, rx: 5, ry: 8.5 },
  oracle: { kind: 'ellipse', cx: 17, cy: 22, rx: 4.5, ry: 7 },
  quests: { kind: 'ellipse', cx: 64, cy: 38, rx: 5, ry: 7 },
  parchemins: { kind: 'ellipse', cx: 30, cy: 53, rx: 7.5, ry: 8 },
  dossier: { kind: 'ellipse', cx: 68.5, cy: 59, rx: 7, ry: 8.5 },
  bestiary: { kind: 'ellipse', cx: 50, cy: 50, rx: 7, ry: 6 },
  cabin: { kind: 'ellipse', cx: 81.5, cy: 64, rx: 6, ry: 10 },
  boss: { kind: 'ellipse', cx: 78, cy: 29, rx: 6, ry: 6 },
} satisfies ShapeMap;
```

- [ ] **Step 4: Write the camp scene definition**

`web/src/lib/world/scenes/camp.ts`:

```ts
// The camp as a hub scene (scenes UI spec §3 "Hub scene", §9 UI1): which places exist, where
// they lead (the pre-UI1 screens, unchanged), and what each shows from /camp. Geometry lives in
// camp.shapes.ts (pure data, regenerated by the ?edit editor when UI2 repaints the camp).
import { ART } from '../art';
import { TINT_FILTERS, stageLabel, stageLine } from '../dragon';
import type { CampResponse, DragonOut, WorldCatalog } from '../types';
import {
  IDLE_HOTSPOT,
  type DialogueLine,
  type HotspotDef,
  type HotspotState,
  type SceneDef,
  type SceneLayerDef,
} from '../../scene/types';
import { CAMP_SHAPES } from './camp.shapes';

export type CampHotspotId = keyof typeof CAMP_SHAPES;

const st = (p: Partial<HotspotState> = {}): HotspotState => ({ ...IDLE_HOTSPOT, ...p });

/** The dragon hotspot's caption: its name, else what it is. */
export function dragonCaption(d: DragonOut): string {
  return d.name ?? (d.stage === 'egg' ? 'Un œuf de dragon' : stageLabel(d.stage));
}

/** The boss reward "known in advance" (SP3 decisions 9/12), or a generic phrase. */
export function bossRewardName(camp: CampResponse, catalog: WorldCatalog | null): string {
  const tier = camp.boss.tier_available;
  if (tier === null) return 'une récompense';
  const rewardId = catalog?.boss_rewards[String(tier)];
  const name = rewardId ? catalog?.rewards[rewardId]?.name : undefined;
  return name ?? 'une récompense';
}

export const CAMP_HOTSPOTS: HotspotDef[] = [
  {
    id: 'dragon',
    label: 'Le nid du dragon',
    target: 'dragon',
    shape: CAMP_SHAPES.dragon,
    labelPos: 'below',
    state: ({ camp }) => st({ caption: camp ? dragonCaption(camp.dragon) : null }),
  },
  {
    id: 'oracle',
    label: 'Le chemin de Delphes',
    target: 'oracle',
    shape: CAMP_SHAPES.oracle,
    labelPos: 'below',
    state: ({ camp }) => {
      if (!camp) return st();
      const sealed = camp.oracle.status === 'sealed';
      return st({ isNew: sealed, caption: sealed ? 'Trois rouleaux scellés' : 'Quête en cours' });
    },
  },
  {
    id: 'quests',
    label: 'Le tableau des quêtes',
    target: 'quests',
    shape: CAMP_SHAPES.quests,
    labelPos: 'above',
    state: ({ camp }) => {
      const n = camp?.quests.filter((q) => q.status === 'active').length ?? 0;
      return st({ badge: n > 0 ? n : null });
    },
  },
  {
    id: 'parchemins',
    label: 'La tente des parchemins',
    target: 'library',
    shape: CAMP_SHAPES.parchemins,
    labelPos: 'above',
    state: () => st(),
  },
  {
    id: 'dossier',
    label: 'La tente de guerre',
    target: 'dossier',
    shape: CAMP_SHAPES.dossier,
    labelPos: 'below',
    state: () => st({ caption: "Le dossier d'Éris" }),
  },
  {
    id: 'bestiary',
    label: 'Le bestiaire',
    target: 'bestiaire',
    shape: CAMP_SHAPES.bestiary,
    labelPos: 'below',
    state: ({ camp }) => {
      if (!camp) return st();
      const available = camp.lieutenants.filter((l) => l.available).length;
      const neutralised = camp.lieutenants.filter((l) => l.neutralised).length;
      return st({ caption: `${neutralised} / ${available} ruses neutralisées` });
    },
  },
  {
    id: 'cabin',
    label: 'Ta cabane',
    target: 'cabin',
    shape: CAMP_SHAPES.cabin,
    labelPos: 'below',
    state: ({ camp }) => st({ caption: camp ? `${camp.rewards_count} trésor(s)` : null }),
  },
  {
    id: 'boss',
    label: 'Le sentier de la bataille',
    target: 'boss',
    shape: CAMP_SHAPES.boss,
    labelPos: 'below',
    state: ({ camp, catalog }) => {
      if (!camp || (camp.boss.tier_available === null && camp.boss.active_quest_id === null)) return st({ visible: false });
      const engaged = camp.quests.some((q) => q.kind === 'boss' && q.status === 'active');
      return st({
        isNew: !engaged,
        caption: engaged
          ? 'Un combat est déjà engagé contre Éris.'
          : `Combat ${camp.boss.tier_available} : ${bossRewardName(camp, catalog)}`,
      });
    },
  },
];

export const CAMP_SCENE: SceneDef = {
  id: 'camp',
  title: 'Le camp',
  background: ART.scenes.camp,
  layers: [],
  hotspots: CAMP_HOTSPOTS,
  ambience: { particles: 'embers', music: null },
  narrator: { enter: 'camp.enter', firstVisit: 'camp.first' },
  preload: [ART.scenes.delphes, ART.scenes.parchemins],
};

/** Where the player's dragon cut-out stands (its image depends on the stage, so Camp.svelte
 *  renders it as a SceneLayer with this placement). Matches CAMP_SHAPES.dragon. */
export const CAMP_DRAGON_LAYER: Omit<SceneLayerDef, 'id' | 'src' | 'alt'> = {
  x: 18,
  y: 80,
  scale: 9,
  depth: 2,
  idle: 'breathe',
};

/** UI1's static greeting (dialogue content files arrive in UI5). */
export function campGreeting(profileName: string, camp: CampResponse): DialogueLine[] {
  const d = camp.dragon;
  const who = {
    speaker: 'dragon' as const,
    name: d.name ?? (d.stage === 'egg' ? "L'œuf" : 'Ton dragon'),
    portrait: ART.dragon[d.stage],
    portraitFilter: TINT_FILTERS[d.tint],
  };
  return [
    { ...who, text: `Bienvenue au camp, ${profileName}.` },
    { ...who, text: stageLine(d.stage, d.name, Math.max(0, d.available - d.neutralised)) },
  ];
}
```

`web/src/lib/world/scenes/index.ts`:

```ts
// Registry of every scene definition (UI3 adds title, library, Delphi, war tent, nest, cabin).
import type { SceneDef } from '../../scene/types';
import { CAMP_SCENE } from './camp';

/** Scenes UI spec §4: "≤ 600 KB WebP per scene background". */
export const SCENE_BUDGET_BYTES = 600 * 1024;

export const SCENES: SceneDef[] = [CAMP_SCENE];
```

- [ ] **Step 5: Split the art budget test (Ruling 12)**

Replace the first two `it(...)` blocks of `web/src/lib/world/art.test.ts` (keep the imports, `flat()` and the `artFor` test) with:

```ts
  // Scene backgrounds have their own 600 KB budget (scenes UI spec §4, scenes/budget.test.ts).
  const nonScene = () => flat(ART).filter((p) => !p.startsWith('/art/scenes/'));

  it('every path exists under public/, non-scene art is under 150 KB', () => {
    for (const p of flat(ART)) expect(existsSync('public' + p), p).toBe(true);
    for (const p of nonScene()) expect(statSync('public' + p).size, p).toBeLessThan(150 * 1024);
  });

  it('total non-scene art payload stays under 2.5 MB', () => {
    expect(nonScene().reduce((s, p) => s + statSync('public' + p).size, 0)).toBeLessThan(2.5 * 1024 * 1024);
  });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `scripts/npm.sh run test -- src/lib/world` → Expected: camp 7 passed, budget 2 passed, art 3 passed, the other world tests unchanged and green.
Run: `scripts/npm.sh run check` → Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
P="web/src/lib/world/scenes web/src/lib/world/art.test.ts"
git add $P && git commit -m "UI1: camp hub scene data and the scene weight budget

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

---

### Task 5: Stage engine — runtime, SceneStage, SceneLayer, SceneTransition, FxCanvas, RotateScreen

**Files:**
- Modify: `web/src/lib/juice/motion.ts`; Create: `web/src/lib/juice/motion.test.ts`
- Create: `web/src/lib/scene/editMode.ts`, `web/src/lib/scene/editMode.test.ts`
- Create: `web/src/lib/scene/runtime.svelte.ts`
- Create: `web/src/lib/scene/fx.ts`, `web/src/lib/scene/fx.test.ts`
- Create: `web/src/components/scene/SceneStage.svelte`, `SceneLayer.svelte`, `SceneTransition.svelte`, `FxCanvas.svelte`, `RotateScreen.svelte`
- Modify: `web/index.html` (status bar), `web/public/manifest.json`; Create: `web/src/pwa.test.ts`

**Interfaces:**
- Consumes: Task 3 (`SceneDef`, `SceneLayerDef`, `FxPreset`, `stageBox`, `parallaxOffset`, `pointerToNorm`), `router` (`web/src/lib/router.svelte.ts`), `reducedMotion()` (`web/src/lib/juice/motion.ts`), Task 2 classes (`kit-plaque`, `idle-*`).
- Produces:
  - `watchReducedMotion(onChange: (reduced: boolean) => void): () => void` (calls `onChange` immediately with the current value).
  - `isEditMode(search: string, query: Record<string, string>): boolean`.
  - `runtime.svelte.ts`: `interface SceneRuntime { nx: number; ny: number; reduced: boolean; editing: boolean }`; `createSceneRuntime(init?: Partial<SceneRuntime>): SceneRuntime` (a `$state` object); `provideSceneRuntime(rt: SceneRuntime): void`; `useSceneRuntime(): SceneRuntime` (falls back to a static `{ nx: 0, ny: 0, reduced: true, editing: false }` outside a stage).
  - `fx.ts`: `type AmbientPreset = Exclude<FxPreset, 'none'>`; `interface Mote { x; y; vx; vy; age; life; size; color }`; `FX_COUNTS: Record<AmbientPreset, number>`; `spawnMote(preset, w, h, rand: () => number, scatter?: boolean): Mote`; `stepMotes(motes: Mote[], preset, w, h, dtMs: number, rand): Mote[]`; `moteAlpha(m: Mote): number`.
  - `SceneStage.svelte` props `{ scene: SceneDef; children?: Snippet; hud?: Snippet }`. Renders `<main class="scene-stage" data-testid="scene-{scene.id}" data-reduced-motion="true|false">`, the art box `.art` (children render **inside the art box**, so absolute `%` positions are art %), the plaque `<h1 class="kit-plaque stage-plaque">{scene.title}</h1>`, the `hud` snippet outside the art box, and `RotateScreen`. Provides the `SceneRuntime` context to descendants.
  - `SceneLayer.svelte` props `{ layer: SceneLayerDef; filter?: string; testId?: string }`; renders an `<img>` with `data-offset="<x>,<y>"` (current parallax offset in art %; `"0,0"` under reduced motion).
  - `SceneTransition.svelte` props `{ kind?: 'fade' | 'zoom'; children: Snippet }`.
  - `FxCanvas.svelte` props `{ preset: FxPreset }`; `<canvas data-testid="fx-canvas">`. SceneStage does not render it under reduced motion.
  - `RotateScreen.svelte` (no props) `data-testid="rotate-screen"`, visible only in `(orientation: portrait)`; the stage hides `.stage-content` in portrait.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/juice/motion.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reducedMotion, watchReducedMotion } from './motion';

type Listener = (e: { matches: boolean }) => void;

function fakeMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mq = {
    matches: initial,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
  };
  vi.stubGlobal('matchMedia', () => mq);
  return {
    set(m: boolean) {
      mq.matches = m;
      for (const l of listeners) l({ matches: m });
    },
    listeners: () => listeners.size,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('watchReducedMotion', () => {
  it('reports false once when matchMedia does not exist (node, SSR)', () => {
    const seen: boolean[] = [];
    const stop = watchReducedMotion((v) => seen.push(v));
    stop();
    expect(seen).toEqual([false]);
  });

  it('emits the current value, then every change, until stopped', () => {
    const mm = fakeMatchMedia(true);
    const seen: boolean[] = [];
    const stop = watchReducedMotion((v) => seen.push(v));
    mm.set(false);
    stop();
    mm.set(true);
    expect(seen).toEqual([true, false]);
    expect(mm.listeners()).toBe(0);
  });

  it('agrees with reducedMotion()', () => {
    fakeMatchMedia(true);
    expect(reducedMotion()).toBe(true);
  });
});
```

`web/src/lib/scene/editMode.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isEditMode } from './editMode';

describe('isEditMode (Ruling 9)', () => {
  it('is on with ?edit before the hash or inside the hash query', () => {
    expect(isEditMode('?edit', {})).toBe(true);
    expect(isEditMode('?a=1&edit=1', {})).toBe(true);
    expect(isEditMode('', { edit: '' })).toBe(true);
  });
  it('is off otherwise', () => {
    expect(isEditMode('', {})).toBe(false);
    expect(isEditMode('?editor=1', { panel: 'heros' })).toBe(false);
  });
});
```

`web/src/lib/scene/fx.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FX_COUNTS, moteAlpha, spawnMote, stepMotes } from './fx';

function seeded(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('ambient particles', () => {
  it('spawns embers in the bottom quarter, rising', () => {
    const rand = seeded();
    for (let i = 0; i < 50; i++) {
      const m = spawnMote('embers', 1000, 600, rand);
      expect(m.y).toBeGreaterThanOrEqual(450);
      expect(m.y).toBeLessThanOrEqual(600);
      expect(m.vy).toBeLessThan(0);
      expect(m.age).toBe(0);
    }
  });

  it('moves living motes and respawns expired ones', () => {
    const rand = seeded(7);
    const m = { ...spawnMote('embers', 1000, 600, rand), age: 0, life: 3000 };
    const [moved] = stepMotes([m], 'embers', 1000, 600, 100, rand);
    expect(moved.y).toBeLessThan(m.y);
    expect(moved.age).toBe(100);
    const [fresh] = stepMotes([{ ...m, age: 2999 }], 'embers', 1000, 600, 10, rand);
    expect(fresh.age).toBe(0);
  });

  it('keeps a constant, finite population', () => {
    const rand = seeded(3);
    let motes = Array.from({ length: FX_COUNTS.dust }, () => spawnMote('dust', 800, 450, rand, true));
    for (let i = 0; i < 500; i++) motes = stepMotes(motes, 'dust', 800, 450, 16, rand);
    expect(motes).toHaveLength(FX_COUNTS.dust);
    for (const m of motes) expect(Number.isFinite(m.x) && Number.isFinite(m.y)).toBe(true);
  });

  it('fades in over the first fifth of a life and out after', () => {
    const m = spawnMote('dust', 100, 100, seeded());
    expect(moteAlpha({ ...m, age: 0, life: 1000 })).toBe(0);
    expect(moteAlpha({ ...m, age: 200, life: 1000 })).toBeCloseTo(1, 5);
    expect(moteAlpha({ ...m, age: 1000, life: 1000 })).toBe(0);
  });
});
```

`web/src/pwa.test.ts`:

```ts
// Scenes UI spec §4: standalone PWA, black-translucent status bar, full-bleed, landscape.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('standalone PWA shell', () => {
  it('draws under a translucent status bar with safe-area support', () => {
    const html = readFileSync('index.html', 'utf-8');
    expect(html).toMatch(/name="apple-mobile-web-app-status-bar-style" content="black-translucent"/);
    expect(html).toMatch(/viewport-fit=cover/);
  });
  it('installs as a landscape standalone app with a night splash', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf-8'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.background_color).toBe('#15121a');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `scripts/npm.sh run test -- src/lib/juice/motion.test.ts src/lib/scene/editMode.test.ts src/lib/scene/fx.test.ts src/pwa.test.ts`
Expected: FAIL — `watchReducedMotion` is not exported, `./editMode` and `./fx` cannot be resolved, the status bar still says `default`.

- [ ] **Step 3: Implement the pure modules**

Append to `web/src/lib/juice/motion.ts`:

```ts

/** Calls `onChange` now with the current preference, then on every change; returns the
 *  unsubscribe function. Scene components use it so an OS toggle applies without a reload. */
export function watchReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof matchMedia !== 'function') {
    onChange(false);
    return () => {};
  }
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  onChange(mq.matches);
  const listener = (e: { matches: boolean }) => onChange(e.matches);
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}
```

`web/src/lib/scene/editMode.ts`:

```ts
// The hotspot editor flag (scenes UI spec §4, plan Ruling 9): `?edit` before the hash
// (`/?edit#/p/1/camp`) or in the hash query (`#/p/1/camp?edit`).
export function isEditMode(search: string, query: Record<string, string>): boolean {
  return new URLSearchParams(search).has('edit') || Object.prototype.hasOwnProperty.call(query, 'edit');
}
```

`web/src/lib/scene/runtime.svelte.ts`:

```ts
// Per-stage reactive runtime shared with every scene component through Svelte context: the
// pointer position for parallax, reduced motion, and the ?edit flag.
import { getContext, setContext } from 'svelte';

export interface SceneRuntime {
  /** Pointer position in [-1, 1] across the viewport (0 = centre). */
  nx: number;
  ny: number;
  reduced: boolean;
  editing: boolean;
}

const KEY = Symbol('scene-runtime');
const STATIC: SceneRuntime = { nx: 0, ny: 0, reduced: true, editing: false };

export function createSceneRuntime(init: Partial<SceneRuntime> = {}): SceneRuntime {
  const rt = $state<SceneRuntime>({ nx: 0, ny: 0, reduced: false, editing: false, ...init });
  return rt;
}

export function provideSceneRuntime(rt: SceneRuntime): void {
  setContext(KEY, rt);
}

export function useSceneRuntime(): SceneRuntime {
  return getContext<SceneRuntime | undefined>(KEY) ?? STATIC;
}
```

`web/src/lib/scene/fx.ts`:

```ts
// Ambient particles for the FxCanvas layer (scenes UI spec §2.1 "a small canvas FX layer"):
// embers rising from the camp fire, slow dust motes. Pure simulation; the component draws.
import type { FxPreset } from './types';

export type AmbientPreset = Exclude<FxPreset, 'none'>;

export interface Mote {
  x: number;
  y: number;
  /** px per second */
  vx: number;
  vy: number;
  /** ms */
  age: number;
  life: number;
  size: number;
  color: string;
}

export const FX_COUNTS: Record<AmbientPreset, number> = { embers: 26, dust: 18 };

// Gold, Éris-free orange and pale gold: never a red (parent spec "orange rather than red").
const COLORS: Record<AmbientPreset, string[]> = {
  embers: ['#f1dc9a', '#e07b2a', '#c9a227'],
  dust: ['#fff7e6', '#f1dc9a'],
};

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length) % list.length];
}

/** `scatter` spreads initial ages so the first frame isn't a synchronised burst. */
export function spawnMote(preset: AmbientPreset, w: number, h: number, rand: () => number, scatter = false): Mote {
  if (preset === 'embers') {
    return {
      x: rand() * w,
      y: h * (0.75 + rand() * 0.25),
      vx: (rand() - 0.5) * 12,
      vy: -(18 + rand() * 30),
      age: scatter ? rand() * 2500 : 0,
      life: 2500 + rand() * 2500,
      size: 1 + rand() * 1.8,
      color: pick(COLORS.embers, rand),
    };
  }
  return {
    x: rand() * w,
    y: rand() * h,
    vx: (rand() - 0.5) * 6,
    vy: (rand() - 0.5) * 4,
    age: scatter ? rand() * 4000 : 0,
    life: 4000 + rand() * 4000,
    size: 0.8 + rand() * 1.2,
    color: pick(COLORS.dust, rand),
  };
}

export function stepMotes(
  motes: Mote[],
  preset: AmbientPreset,
  w: number,
  h: number,
  dtMs: number,
  rand: () => number,
): Mote[] {
  const dt = dtMs / 1000;
  return motes.map((m) => {
    const age = m.age + dtMs;
    if (age >= m.life) return spawnMote(preset, w, h, rand);
    return { ...m, age, x: m.x + m.vx * dt, y: m.y + m.vy * dt };
  });
}

export function moteAlpha(m: Mote): number {
  const t = m.age / m.life;
  return Math.max(0, Math.min(1, t < 0.2 ? t / 0.2 : (1 - t) / 0.8));
}
```

- [ ] **Step 4: PWA shell**

`web/index.html`: change the status bar meta to

```html
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

`web/public/manifest.json`: set `"background_color": "#15121a"` and add `"orientation": "landscape",` after the `"display"` line.

- [ ] **Step 5: Run the unit tests to verify they pass**

Run: `scripts/npm.sh run test -- src/lib/juice/motion.test.ts src/lib/scene/editMode.test.ts src/lib/scene/fx.test.ts src/pwa.test.ts`
Expected: 3 + 2 + 4 + 2 passed.

- [ ] **Step 6: Write the stage components**

`web/src/components/scene/SceneTransition.svelte`:

```svelte
<script lang="ts">
  // Scene entry (scenes UI spec §4): a gentle zoom-in, or a plain fade under reduced motion
  // ("fades only"). Svelte transitions run on the Web Animations API, which the global CSS
  // reduced-motion rule does not reach, hence the explicit check.
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { reducedMotion } from '../../lib/juice/motion';

  let { kind = 'fade', children }: { kind?: 'fade' | 'zoom'; children: Snippet } = $props();

  function enter(node: Element) {
    return kind === 'zoom' && !reducedMotion()
      ? scale(node, { start: 1.04, opacity: 0, duration: 450 })
      : fade(node, { duration: 300 });
  }
</script>

<div class="scene-transition" in:enter|global>{@render children()}</div>

<style>
  .scene-transition {
    position: absolute;
    inset: 0;
  }
</style>
```

`web/src/components/scene/SceneLayer.svelte`:

```svelte
<script lang="ts">
  // A positioned cut-out (scenes UI spec §4): x = centre, y = bottom edge, scale = width, in art %.
  // Parallax offset by depth; no parallax and no idle animation under reduced motion.
  import { parallaxOffset } from '../../lib/scene/geometry';
  import { useSceneRuntime } from '../../lib/scene/runtime.svelte';
  import type { SceneLayerDef } from '../../lib/scene/types';

  let { layer, filter = 'none', testId }: { layer: SceneLayerDef; filter?: string; testId?: string } = $props();

  const rt = useSceneRuntime();
  const off = $derived(rt.reduced || rt.editing ? { x: 0, y: 0 } : parallaxOffset(layer.depth, rt.nx, rt.ny));
</script>

<img
  class="scene-layer idle-{rt.reduced ? 'none' : layer.idle}"
  src={layer.src}
  alt={layer.alt}
  data-testid={testId}
  data-offset="{off.x},{off.y}"
  draggable="false"
  style="left:{layer.x - layer.scale / 2 + off.x}%;bottom:{100 - layer.y - off.y}%;width:{layer.scale}%;filter:{filter}"
/>

<style>
  .scene-layer {
    position: absolute;
    z-index: 1;
    height: auto;
    pointer-events: none;
    transition:
      left 0.35s ease-out,
      bottom 0.35s ease-out;
  }
</style>
```

`web/src/components/scene/FxCanvas.svelte`:

```svelte
<script lang="ts">
  // Ambient particle layer (scenes UI spec §2.1). SceneStage never mounts it under reduced motion.
  import { FX_COUNTS, moteAlpha, spawnMote, stepMotes, type Mote } from '../../lib/scene/fx';
  import type { FxPreset } from '../../lib/scene/types';

  let { preset }: { preset: FxPreset } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();

  $effect(() => {
    const el = canvas;
    const kind = preset;
    if (!el || kind === 'none') return;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    let w = 1;
    let h = 1;
    const resize = () => {
      const r = el.getBoundingClientRect();
      w = el.width = Math.max(1, Math.round(r.width));
      h = el.height = Math.max(1, Math.round(r.height));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let motes: Mote[] = Array.from({ length: FX_COUNTS[kind] }, () => spawnMote(kind, w, h, Math.random, true));
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      motes = stepMotes(motes, kind, w, h, dt, Math.random);
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        ctx.globalAlpha = moteAlpha(m);
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  });
</script>

<canvas bind:this={canvas} class="fx-canvas" data-testid="fx-canvas" aria-hidden="true"></canvas>

<style>
  .fx-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
  }
</style>
```

`web/src/components/scene/RotateScreen.svelte`:

```svelte
<script lang="ts">
  // Portrait → "tourne ton iPad" (scenes UI spec §1, §4). Pure CSS: hidden unless the viewport
  // is in portrait orientation; SceneStage hides its content at the same breakpoint.
</script>

<div class="rotate-screen" data-testid="rotate-screen" role="status">
  <div class="rotate-icon" aria-hidden="true"></div>
  <p class="kit-plaque">Tourne ton iPad</p>
  <p class="rotate-hint">Le camp se découvre à l'horizontale.</p>
</div>

<style>
  .rotate-screen {
    display: none;
  }
  @media (orientation: portrait) {
    .rotate-screen {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 24px;
      background: var(--night);
      color: var(--bronze-ink);
      text-align: center;
    }
  }
  .rotate-icon {
    width: 64px;
    height: 96px;
    border: 4px solid var(--bronze-light);
    border-radius: 12px;
    animation: rotate-hint 2.4s ease-in-out infinite;
  }
  .rotate-hint {
    margin: 0;
    font-family: var(--font-body);
    font-size: 20px;
  }
  @keyframes rotate-hint {
    0%,
    30% {
      transform: rotate(0);
    }
    60%,
    100% {
      transform: rotate(-90deg);
    }
  }
</style>
```

`web/src/components/scene/SceneStage.svelte`:

```svelte
<script lang="ts">
  // The scene stage (scenes UI spec §4, plan Ruling 3): fixed full-screen, a 16:9 art box sized to
  // the viewport height (sides cropped on iPad, blurred bands on ultra-wide), the 4:3 safe zone
  // inside it, pointer parallax, reduced motion, and the portrait rotate screen. Children render
  // inside the art box, so their absolute % positions are art %. The HUD snippet renders over the
  // viewport, outside the art box.
  import { onMount, type Snippet } from 'svelte';
  import SceneLayer from './SceneLayer.svelte';
  import SceneTransition from './SceneTransition.svelte';
  import FxCanvas from './FxCanvas.svelte';
  import RotateScreen from './RotateScreen.svelte';
  import { pointerToNorm, stageBox } from '../../lib/scene/geometry';
  import { createSceneRuntime, provideSceneRuntime } from '../../lib/scene/runtime.svelte';
  import { isEditMode } from '../../lib/scene/editMode';
  import { reducedMotion, watchReducedMotion } from '../../lib/juice/motion';
  import { router } from '../../lib/router.svelte';
  import type { SceneDef } from '../../lib/scene/types';

  let { scene, children, hud }: { scene: SceneDef; children?: Snippet; hud?: Snippet } = $props();

  const runtime = createSceneRuntime({ reduced: reducedMotion() });
  provideSceneRuntime(runtime);

  let vw = $state(typeof innerWidth === 'number' ? innerWidth : 1280);
  let vh = $state(typeof innerHeight === 'number' ? innerHeight : 720);
  const box = $derived(stageBox(vw, vh));

  $effect(() =>
    watchReducedMotion((r) => {
      runtime.reduced = r;
      if (r) {
        runtime.nx = 0;
        runtime.ny = 0;
      }
    }),
  );

  $effect(() => {
    runtime.editing = isEditMode(location.search, router.route.query);
  });

  onMount(() => {
    // Warm the cache for the scenes the player is likely to open next (spec §4 performance).
    const t = setTimeout(() => {
      for (const src of scene.preload) {
        const img = new Image();
        img.src = src;
      }
    }, 800);
    return () => clearTimeout(t);
  });

  function onPointerMove(e: PointerEvent) {
    if (runtime.reduced || runtime.editing) return;
    const n = pointerToNorm(e.clientX, e.clientY, vw, vh);
    runtime.nx = n.nx;
    runtime.ny = n.ny;
  }
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<main
  class="scene-stage"
  data-testid="scene-{scene.id}"
  data-reduced-motion={runtime.reduced ? 'true' : 'false'}
  onpointermove={onPointerMove}
>
  <img class="stage-backdrop" src={scene.background} alt="" aria-hidden="true" />
  <div class="stage-content">
    <SceneTransition kind="zoom">
      <div class="art" style="left:{box.left}px;top:{box.top}px;width:{box.width}px;height:{box.height}px">
        <img class="art-bg" src={scene.background} alt="" draggable="false" />
        {#each scene.layers as layer (layer.id)}
          <SceneLayer {layer} />
        {/each}
        {#if !runtime.reduced}
          <FxCanvas preset={scene.ambience.particles} />
        {/if}
        <h1 class="kit-plaque stage-plaque">{scene.title}</h1>
        {@render children?.()}
      </div>
    </SceneTransition>
    {@render hud?.()}
  </div>
  <RotateScreen />
</main>

<style>
  .scene-stage {
    position: fixed;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    background: var(--night);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .stage-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(14px) brightness(0.55);
    transform: scale(1.08);
  }
  .stage-content {
    position: absolute;
    inset: 0;
  }
  .art {
    position: absolute;
    overflow: hidden;
  }
  .art-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .stage-plaque {
    position: absolute;
    left: 50%;
    top: 9.5%;
    transform: translateX(-50%);
    margin: 0;
    z-index: 3;
    white-space: nowrap;
  }
  @media (orientation: portrait) {
    .stage-content {
      display: none;
    }
  }
</style>
```

- [ ] **Step 7: Type-check and run the unit suite**

Run: `scripts/npm.sh run check` → Expected: `svelte-check found 0 errors` (the components are not mounted yet; Tasks 7–8 cover them end to end).
Run: `scripts/npm.sh run test` → Expected: all vitest files pass.

- [ ] **Step 8: Commit**

```bash
P="web/src/lib/juice/motion.ts web/src/lib/juice/motion.test.ts web/src/lib/scene/editMode.ts web/src/lib/scene/editMode.test.ts web/src/lib/scene/runtime.svelte.ts web/src/lib/scene/fx.ts web/src/lib/scene/fx.test.ts web/src/components/scene web/index.html web/public/manifest.json web/src/pwa.test.ts"
git add $P && git commit -m "UI1: scene stage engine (stage box, layers, parallax, FX, rotate screen)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

---

### Task 6: Hotspot, DialogueBox and Overlay

**Files:**
- Create: `web/src/lib/scene/typewriter.ts`, `web/src/lib/scene/typewriter.test.ts`
- Create: `web/src/lib/scene/greeting.ts`, `web/src/lib/scene/greeting.test.ts`
- Create: `web/src/components/scene/Hotspot.svelte`, `DialogueBox.svelte`, `Overlay.svelte`

**Interfaces:**
- Consumes: Task 3 (`HotspotDef`, `HotspotState`, `DialogueLine`, `shapeBox`, `clipPath`, `DIALOGUE_DOCK`), Task 5 (`useSceneRuntime`), `reducedMotion()`, Task 2 classes (`kit-parchment`, `kit-scroll`, `kit-bronze`, `sr-only`, keyframes `kit-glow`, `kit-label-bob`, `kit-flash`).
- Produces:
  - `typewriter.ts`: `TYPE_CPS = 45`; `typedLength(text: string, elapsedMs: number, cps?: number): number`; `interface TypeState { index: number; shown: number }`; `advance(s: TypeState, lines: { text: string }[]): TypeState & { done: boolean }`.
  - `greeting.ts`: `shouldGreet(profileId: number): boolean`; `markGreeted(profileId: number): void`; `resetGreetings(): void`.
  - `Hotspot.svelte` props `{ def: HotspotDef; status: HotspotState; sceneId: string; onActivate: (def: HotspotDef) => void }`. Renders nothing when `!status.visible`; otherwise `<button class="hotspot" data-testid="{sceneId}-{def.id}">` positioned on `shapeBox(def.shape)` (art %), containing `.hotspot-glow`, `.hotspot-label` (`.hotspot-name`, optional `.hotspot-caption`), optional `.hotspot-badge`. Class `bob` only when not reduced; `onActivate` fires after a 160 ms flash (0 ms when reduced); does nothing when locked or in edit mode.
  - `DialogueBox.svelte` props `{ lines: DialogueLine[]; onDone: () => void }`; test ids `dialogue-box`, `dialogue-text` (the typed part of the current line), `dialogue-advance` (tap: finish the line, else next line, else `onDone`), `dialogue-skip` (« Passer », calls `onDone`). Positioned in `DIALOGUE_DOCK` of its (art box) parent.
  - `Overlay.svelte` props `{ variant: 'scroll' | 'codex' | 'table'; title: string; testId: string; onClose: () => void; children: Snippet }`; `role="dialog"`, `aria-modal="true"`, `aria-label={title}`, `data-testid={testId}`; close button `data-testid="overlay-close"` « Fermer »; Escape and backdrop tap call `onClose`.

- [ ] **Step 1: Write the failing tests**

`web/src/lib/scene/typewriter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TYPE_CPS, advance, typedLength } from './typewriter';

const lines = [{ text: 'Bonjour.' }, { text: 'Au revoir.' }];

describe('typewriter', () => {
  it('types TYPE_CPS characters per second and stops at the end', () => {
    expect(TYPE_CPS).toBe(45);
    expect(typedLength('Bonjour.', 0)).toBe(0);
    expect(typedLength('Bonjour.', 100)).toBe(4);
    expect(typedLength('Bonjour.', 10_000)).toBe(8);
    expect(typedLength('Bonjour.', -50)).toBe(0);
  });

  it('a tap first completes the line, then moves to the next, then finishes', () => {
    expect(advance({ index: 0, shown: 3 }, lines)).toEqual({ index: 0, shown: 8, done: false });
    expect(advance({ index: 0, shown: 8 }, lines)).toEqual({ index: 1, shown: 0, done: false });
    expect(advance({ index: 1, shown: 10 }, lines)).toEqual({ index: 1, shown: 10, done: true });
  });

  it('is done on an empty script', () => {
    expect(advance({ index: 0, shown: 0 }, []).done).toBe(true);
  });
});
```

`web/src/lib/scene/greeting.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { markGreeted, resetGreetings, shouldGreet } from './greeting';

describe('greet once per profile per page load (Ruling 10)', () => {
  beforeEach(() => resetGreetings());

  it('greets each profile once', () => {
    expect(shouldGreet(1)).toBe(true);
    markGreeted(1);
    expect(shouldGreet(1)).toBe(false);
    expect(shouldGreet(2)).toBe(true);
  });

  it('forgets on reset (a new page load)', () => {
    markGreeted(1);
    resetGreetings();
    expect(shouldGreet(1)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `scripts/npm.sh run test -- src/lib/scene/typewriter.test.ts src/lib/scene/greeting.test.ts`
Expected: FAIL — cannot resolve `./typewriter`, `./greeting`.

- [ ] **Step 3: Implement the pure modules**

`web/src/lib/scene/typewriter.ts`:

```ts
// DialogueBox typing (scenes UI spec §4 "typewriter, tap to advance/skip"). Pure: the component
// owns the clock and just asks how much of the line is visible and what a tap does.
export const TYPE_CPS = 45;

export function typedLength(text: string, elapsedMs: number, cps = TYPE_CPS): number {
  if (elapsedMs <= 0) return 0;
  return Math.min(text.length, Math.floor((elapsedMs * cps) / 1000));
}

export interface TypeState {
  index: number;
  shown: number;
}

/** One tap: complete the current line if still typing, else go to the next line, else done. */
export function advance(s: TypeState, lines: { text: string }[]): TypeState & { done: boolean } {
  const cur = lines[s.index];
  if (!cur) return { ...s, done: true };
  if (s.shown < cur.text.length) return { index: s.index, shown: cur.text.length, done: false };
  if (s.index + 1 < lines.length) return { index: s.index + 1, shown: 0, done: false };
  return { index: s.index, shown: s.shown, done: true };
}
```

`web/src/lib/scene/greeting.ts`:

```ts
// The dragon greets once per profile per page load (plan Ruling 10). Module state on purpose: a
// reload is a new visit, a hash navigation back to the camp is not.
const greeted = new Set<number>();

export function shouldGreet(profileId: number): boolean {
  return !greeted.has(profileId);
}

export function markGreeted(profileId: number): void {
  greeted.add(profileId);
}

/** Test helper: forget every greeting (what a page reload does). */
export function resetGreetings(): void {
  greeted.clear();
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `scripts/npm.sh run test -- src/lib/scene/typewriter.test.ts src/lib/scene/greeting.test.ts`
Expected: 3 + 2 passed.

- [ ] **Step 5: Write the three components**

`web/src/components/scene/Hotspot.svelte`:

```svelte
<script lang="ts">
  // One clickable place of a scene (scenes UI spec §4): a real <button> covering the shape's box,
  // a glow clipped to the shape, a visible Cinzel label (+ caption, badge), idle glow + bob, a
  // flash on tap. Test id `<sceneId>-<hotspot id>` (plan Ruling 4), e.g. `camp-parchemins`.
  import { clipPath, shapeBox } from '../../lib/scene/geometry';
  import { useSceneRuntime } from '../../lib/scene/runtime.svelte';
  import type { HotspotDef, HotspotState } from '../../lib/scene/types';

  let {
    def,
    status,
    sceneId,
    onActivate,
  }: { def: HotspotDef; status: HotspotState; sceneId: string; onActivate: (def: HotspotDef) => void } = $props();

  const rt = useSceneRuntime();
  const box = $derived(shapeBox(def.shape));
  let flashing = $state(false);

  function onclick() {
    if (rt.editing || status.locked || flashing) return;
    flashing = true;
    setTimeout(
      () => {
        flashing = false;
        onActivate(def);
      },
      rt.reduced ? 0 : 160,
    );
  }
</script>

{#if status.visible}
  <button
    type="button"
    class="hotspot label-{def.labelPos}"
    class:bob={!rt.reduced}
    class:is-new={status.isNew}
    class:locked={status.locked}
    class:flash={flashing}
    data-testid="{sceneId}-{def.id}"
    aria-disabled={status.locked ? 'true' : undefined}
    style="left:{box.x}%;top:{box.y}%;width:{box.w}%;height:{box.h}%"
    {onclick}
  >
    <span class="hotspot-glow" style="clip-path:{clipPath(def.shape)}" aria-hidden="true"></span>
    <span class="hotspot-label">
      <span class="hotspot-name">{def.label}</span>
      {#if status.caption}<span class="hotspot-caption">{status.caption}</span>{/if}
    </span>
    {#if status.badge !== null}<span class="hotspot-badge">{status.badge}</span>{/if}
    {#if status.locked}<span class="sr-only">(fermé pour l'instant)</span>{/if}
  </button>
{/if}

<style>
  .hotspot {
    position: absolute;
    z-index: 3;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    appearance: none;
    -webkit-appearance: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .hotspot-glow {
    position: absolute;
    inset: 0;
    background: radial-gradient(closest-side, rgba(241, 220, 154, 0.7), rgba(241, 220, 154, 0.15) 70%, rgba(241, 220, 154, 0));
    opacity: 0.3;
    transition: opacity 0.2s ease;
  }
  .hotspot.is-new .hotspot-glow {
    background: radial-gradient(closest-side, rgba(255, 236, 170, 0.9), rgba(201, 162, 39, 0.25) 70%, rgba(201, 162, 39, 0));
  }
  .hotspot:hover .hotspot-glow,
  .hotspot:focus-visible .hotspot-glow {
    opacity: 0.85;
  }
  .hotspot.bob .hotspot-glow {
    animation: kit-glow 3.2s ease-in-out infinite;
  }
  .hotspot.bob .hotspot-label {
    animation: kit-label-bob 3.2s ease-in-out infinite;
  }
  .hotspot.flash .hotspot-glow {
    opacity: 1;
    animation: kit-flash 0.16s ease-out;
  }
  .hotspot-label {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 12px;
    white-space: nowrap;
    border-radius: 8px;
    border: 1px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.66);
    color: var(--bronze-ink);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
  }
  .label-below .hotspot-label {
    top: calc(100% + 4px);
  }
  .label-above .hotspot-label {
    bottom: calc(100% + 4px);
  }
  .hotspot-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .hotspot-caption {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 14px;
  }
  .hotspot-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: var(--gold);
    color: var(--ink);
    font-weight: 700;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  }
  .hotspot.locked {
    cursor: default;
  }
  .hotspot.locked .hotspot-glow {
    opacity: 0.1;
    filter: grayscale(1);
  }
  .hotspot:focus-visible {
    outline: none;
  }
  .hotspot:focus-visible .hotspot-label {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
</style>
```

`web/src/components/scene/DialogueBox.svelte`:

```svelte
<script lang="ts">
  // Narrator box (scenes UI spec §4, §2.5): portrait + typewriter, tap to finish / advance,
  // « Passer » to close. UI1 takes static lines from props; UI5 feeds it dialogue content files.
  // Sits in the art box's dialogue dock, which hotspots never overlap (plan Ruling 3).
  import { reducedMotion } from '../../lib/juice/motion';
  import { DIALOGUE_DOCK } from '../../lib/scene/geometry';
  import { advance, typedLength } from '../../lib/scene/typewriter';
  import type { DialogueLine } from '../../lib/scene/types';

  let { lines, onDone }: { lines: DialogueLine[]; onDone: () => void } = $props();

  let index = $state(0);
  let shown = $state(0);
  const line = $derived(lines[index]);
  const complete = $derived(shown >= line.text.length);

  $effect(() => {
    const text = line.text;
    if (reducedMotion()) {
      shown = text.length;
      return;
    }
    shown = 0;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      shown = Math.max(shown, typedLength(text, now - start));
      if (shown < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  function next() {
    const r = advance({ index, shown }, lines);
    if (r.done) {
      onDone();
      return;
    }
    index = r.index;
    shown = r.shown;
  }
</script>

<div
  class="dialogue kit-parchment"
  role="group"
  aria-label="Dialogue"
  data-testid="dialogue-box"
  style="left:{DIALOGUE_DOCK.x}%;width:{DIALOGUE_DOCK.w}%;max-height:{DIALOGUE_DOCK.h - 2}%"
>
  <img class="portrait" src={line.portrait} alt="" style="filter:{line.portraitFilter ?? 'none'}" />
  <button
    type="button"
    class="advance"
    data-testid="dialogue-advance"
    aria-label={complete ? 'Suite' : 'Tout afficher'}
    onclick={next}
  >
    <span class="speaker">{line.name}</span>
    <span class="text" data-testid="dialogue-text" aria-hidden="true">{line.text.slice(0, shown)}</span>
    <span class="sr-only" aria-live="polite">{line.text}</span>
    {#if complete}<span class="more" aria-hidden="true">▸</span>{/if}
  </button>
  <button type="button" class="kit-bronze skip" data-testid="dialogue-skip" onclick={onDone}>Passer</button>
</div>

<style>
  .dialogue {
    position: absolute;
    bottom: 2%;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px;
    overflow: hidden;
  }
  .portrait {
    width: 84px;
    height: 84px;
    flex-shrink: 0;
    object-fit: contain;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(241, 220, 154, 0.55), rgba(241, 220, 154, 0) 70%);
  }
  .advance {
    flex: 1;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    border: 0;
    background: transparent;
    padding: 0;
    text-align: left;
    cursor: pointer;
    color: var(--ink);
  }
  .speaker {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  .text {
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.35;
    min-height: 1.35em;
  }
  .more {
    align-self: flex-end;
    color: var(--bronze);
  }
  .skip {
    flex-shrink: 0;
  }
</style>
```

`web/src/components/scene/Overlay.svelte`:

```svelte
<script lang="ts">
  // In-world overlay (scenes UI spec §2.2, §4): an object sliding over the dimmed scene, variants
  // scroll / codex / table. The caller gives it a route (plan Ruling 6), so Back closes it too.
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { reducedMotion } from '../../lib/juice/motion';

  let {
    variant,
    title,
    testId,
    onClose,
    children,
  }: { variant: 'scroll' | 'codex' | 'table'; title: string; testId: string; onClose: () => void; children: Snippet } =
    $props();

  const reduced = reducedMotion();
  let panel: HTMLElement | undefined = $state();

  $effect(() => {
    panel?.focus();
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKey} />

<button
  type="button"
  class="overlay-backdrop"
  aria-label="Fermer"
  tabindex="-1"
  onclick={onClose}
  transition:fade|global={{ duration: 200 }}
></button>
<div
  bind:this={panel}
  class="overlay-panel overlay-{variant}"
  class:kit-parchment={variant === 'scroll'}
  class:kit-scroll={variant === 'scroll'}
  role="dialog"
  aria-modal="true"
  aria-label={title}
  data-testid={testId}
  tabindex="-1"
  in:fly|global={{ y: reduced ? 0 : 40, duration: reduced ? 200 : 280, opacity: 0 }}
>
  <header class="overlay-head">
    <h2 class="overlay-title">{title}</h2>
    <button type="button" class="kit-bronze" data-testid="overlay-close" onclick={onClose}>Fermer</button>
  </header>
  <div class="overlay-body">{@render children()}</div>
</div>

<style>
  .overlay-backdrop {
    position: fixed;
    inset: 0;
    z-index: 39;
    border: 0;
    padding: 0;
    background: var(--scrim);
    cursor: pointer;
  }
  .overlay-panel {
    position: fixed;
    z-index: 40;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(640px, calc(100vw - 32px));
    max-height: calc(100dvh - 64px);
    overflow: auto;
    padding: 24px 28px;
    outline: none;
  }
  .overlay-codex {
    background:
      linear-gradient(90deg, rgba(0, 0, 0, 0.08), transparent 6%, transparent 94%, rgba(0, 0, 0, 0.08)),
      var(--parchment-solid);
    border: 10px solid #5a3b22;
    border-radius: 10px 16px 16px 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  }
  .overlay-table {
    background:
      radial-gradient(ellipse at center, var(--parchment-solid) 0 62%, transparent 63%),
      repeating-linear-gradient(90deg, #6b4a2b 0 14px, #5e4026 14px 28px);
    border-radius: 14px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  }
  .overlay-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }
  .overlay-title {
    margin: 0;
    font-family: var(--font-display);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
</style>
```

- [ ] **Step 6: Type-check and run the unit suite**

Run: `scripts/npm.sh run check` → Expected: 0 errors.
Run: `scripts/npm.sh run test` → Expected: all pass.

- [ ] **Step 7: Commit**

```bash
P="web/src/lib/scene/typewriter.ts web/src/lib/scene/typewriter.test.ts web/src/lib/scene/greeting.ts web/src/lib/scene/greeting.test.ts web/src/components/scene/Hotspot.svelte web/src/components/scene/DialogueBox.svelte web/src/components/scene/Overlay.svelte"
git add $P && git commit -m "UI1: hotspot, dialogue box and overlay components

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

---

### Task 7: HUD and the Camp hub scene (+ migrating the e2e specs)

**Files:**
- Create: `web/src/lib/scene/hud.ts`, `web/src/lib/scene/hud.test.ts`
- Create: `web/src/components/scene/Hud.svelte`
- Rewrite: `web/src/screens/Camp.svelte`
- Modify: `web/e2e/helpers.ts`, `web/e2e/profiles.spec.ts`, `web/e2e/happy-path.spec.ts`, `web/e2e/world.spec.ts`, `web/e2e/playability.spec.ts`, `web/e2e/playability-sp3.spec.ts`

**Interfaces:**
- Consumes: Tasks 2–6 (`LaurelBar`, `SceneStage`, `SceneLayer`, `Hotspot`, `DialogueBox`, `Overlay`, `CAMP_SCENE`, `CAMP_DRAGON_LAYER`, `campGreeting`, `shouldGreet`, `markGreeted`, `isEditMode`); `campStore`, `refreshCamp`, `loadCatalog` (`web/src/lib/world/campStore.svelte.ts`); `soundStore`, `setMuted`, `initSound`; `playSfx`, `unlockAudio`; `clearProfile`; `href`, `navigate`, `router`; `Avatar.svelte` (`{ avatar, size }`); `Onboarding.svelte` (`{ profile }`).
- Produces:
  - `hudXp(xp: CampResponse['xp']): { label: string; value: number; max: number }` — label is `` `${title} · ${total} XP` ``.
  - `Hud.svelte` props `{ profile: Profile; camp: CampResponse | null; onHero: () => void }`; test ids `hud-hero`, `hud-xp` (the LaurelBar), `hud-dragon` (link to `dragon`), `hud-mute` (`aria-pressed`).
  - Camp DOM contract (Ruling 5): `scene-camp`, `camp-<hotspot id>`, `camp-dragon-layer`, `camp-weekly`, `camp-prophecy`, `overlay-heros` (route `?panel=heros`) with links « Réglages », « Progrès », « Changer de héros », greeting `dialogue-*`.
  - e2e helpers: `expectCamp(page: Page): Promise<void>`; `createProfileApi(request: APIRequestContext, name: string, level?: string): Promise<number>` (profile already onboarded).

- [ ] **Step 1: Write the failing unit test**

`web/src/lib/scene/hud.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hudXp } from './hud';

describe('hudXp', () => {
  it('shows progress inside the current rank', () => {
    expect(hudXp({ total: 220, rank: 2, title: 'Écuyère du camp', next_threshold: 400, rank_floor: 150 })).toEqual({
      label: 'Écuyère du camp · 220 XP',
      value: 70,
      max: 250,
    });
  });
  it('shows a full laurel at the last rank', () => {
    expect(hudXp({ total: 9000, rank: 10, title: 'Légende', next_threshold: null, rank_floor: 8000 })).toEqual({
      label: 'Légende · 9000 XP',
      value: 1,
      max: 1,
    });
  });
});
```

- [ ] **Step 2: Migrate the e2e specs to the hub DOM (they become the failing tests)**

In `web/e2e/helpers.ts`, add after `skipOnboarding`:

```ts
// UI1 (scenes spec §9): the camp is a hub scene. The old « Bienvenue au camp, X. » heading is now
// the dragon's first dialogue line, so specs wait for the scene stage itself.
export async function expectCamp(page: Page) {
  await expect(page.getByTestId('scene-camp')).toBeVisible();
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
```

and in `createProfile` replace `await expect(page.getByRole('heading', { name: /Bienvenue au camp/ })).toBeVisible();` with `await expectCamp(page);`.

Apply these mechanical replacements (add `expectCamp` to each file's `./helpers` import):

| File | Line(s) today | Change |
|---|---|---|
| `web/e2e/profiles.spec.ts` | 12, 28, 35 | `await expect(page.getByRole('heading', { name: /Bienvenue au camp/ })).toBeVisible();` → `await expectCamp(page);` |
| `web/e2e/profiles.spec.ts` | 30 | insert `await page.getByTestId('hud-hero').click();` before the « Changer de héros » link click |
| `web/e2e/happy-path.spec.ts` | 17 | heading assertion → `await expectCamp(page);` |
| `web/e2e/world.spec.ts` | 57, 107, 383 | heading assertion → `await expectCamp(page);` |
| `web/e2e/world.spec.ts` | 66 | `getByTestId('camp-xp')` → `getByTestId('hud-xp')` |
| `web/e2e/playability.spec.ts` | 160, 317, 410, 425 | heading assertion (both `/Bienvenue au camp/` and `/^Bienvenue au camp/`) → `await expectCamp(page);` |
| `web/e2e/playability-sp3.spec.ts` | 258 | heading assertion → `await expectCamp(page);` |
| `web/e2e/playability-sp3.spec.ts` | 340 | `'camp-xp'` → `'hud-xp'` |
| `web/e2e/playability-sp3.spec.ts` | 342, 524, 722, 750 | `page.locator('.camp')` → `page.getByTestId('scene-camp')` |
| `web/e2e/playability-sp3.spec.ts` | 343 | `page.locator('.camp .scene')` → `page.getByTestId('scene-camp').locator('.art')` |
| `web/e2e/playability-sp3.spec.ts` | 350 | `'topbar-mute'` → `'hud-mute'` |
| `web/e2e/playability-sp3.spec.ts` | 730 | selector `'.camp .card, .camp .scene h1, .camp .eris-panel'` → `'[data-testid="scene-camp"] .hotspot, [data-testid="scene-camp"] .stage-plaque'` |

Leave every other assertion as is: `camp-parchemins`, `camp-oracle`, `camp-quests`, `camp-bestiary`, `camp-cabin`, `camp-boss`, `camp-dragon` (its text is now the caption), `camp-weekly`, `camp-prophecy` and `topbar-camp` (other screens keep the TopBar) keep working by design (Ruling 4). Check with `grep -rn "Bienvenue au camp\|camp-xp\|topbar-mute\|'\.camp" web/e2e`: the only hits left must be the onboarding dialog name `'Bienvenue au camp'` in `playability-sp3.spec.ts`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `scripts/npm.sh run test -- src/lib/scene/hud.test.ts` → Expected: FAIL (cannot resolve `./hud`).
Run: `scripts/playwright.sh profiles` → Expected: FAIL — `getByTestId('scene-camp')` not found.

- [ ] **Step 4: Implement `hud.ts` and `Hud.svelte`**

`web/src/lib/scene/hud.ts`:

```ts
// HUD XP laurel data (scenes UI spec §4 "Hud (slim: hero, XP laurel, ...)").
import type { CampResponse } from '../world/types';

export function hudXp(xp: CampResponse['xp']): { label: string; value: number; max: number } {
  const label = `${xp.title} · ${xp.total} XP`;
  if (xp.next_threshold === null) return { label, value: 1, max: 1 };
  return { label, value: xp.total - xp.rank_floor, max: xp.next_threshold - xp.rank_floor };
}
```

`web/src/components/scene/Hud.svelte`:

```svelte
<script lang="ts">
  // The slim scene HUD (scenes UI spec §4): hero chip (opens the hero panel), XP laurel, dragon
  // mini-portrait, sound toggle. Viewport-anchored over the stage, inside the safe-area insets.
  // Audio channels and their sliders arrive in UI5; UI1 keeps the existing single mute.
  import Avatar from '../Avatar.svelte';
  import LaurelBar from '../ui/LaurelBar.svelte';
  import { ART } from '../../lib/world/art';
  import { TINT_FILTERS } from '../../lib/world/dragon';
  import { hudXp } from '../../lib/scene/hud';
  import { setMuted, soundStore } from '../../lib/juice/soundStore.svelte';
  import { unlockAudio } from '../../lib/juice/sfx';
  import { href } from '../../lib/routes';
  import type { CampResponse } from '../../lib/world/types';
  import type { Profile } from '../../lib/types';

  let { profile, camp, onHero }: { profile: Profile; camp: CampResponse | null; onHero: () => void } = $props();

  const xp = $derived(camp ? hudXp(camp.xp) : null);

  function toggleMute() {
    unlockAudio();
    void setMuted(profile.id, !soundStore.muted);
  }
</script>

<header class="hud">
  <button type="button" class="hud-hero" data-testid="hud-hero" aria-label="Ton héros : {profile.name}" onclick={onHero}>
    <Avatar avatar={profile.avatar} size={40} />
    <span class="hud-name">{profile.name}</span>
  </button>
  <div class="hud-center">
    {#if xp}
      <LaurelBar value={xp.value} max={xp.max} label={xp.label} testId="hud-xp" />
    {/if}
  </div>
  <div class="hud-right">
    {#if camp}
      <a class="hud-round hud-dragon" data-testid="hud-dragon" href={href('dragon', { profileId: String(profile.id) })} aria-label="Ton dragon">
        <img src={ART.dragon[camp.dragon.stage]} alt="" style="filter:{TINT_FILTERS[camp.dragon.tint]}" />
      </a>
    {/if}
    <button type="button" class="hud-round" data-testid="hud-mute" aria-pressed={soundStore.muted} aria-label="Son" onclick={toggleMute}>
      <span aria-hidden="true">{soundStore.muted ? '🔇' : '🔊'}</span>
    </button>
  </div>
</header>

<style>
  .hud {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 5;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    padding: calc(8px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) 8px
      calc(12px + env(safe-area-inset-left));
    background: linear-gradient(rgba(21, 18, 26, 0.7), rgba(21, 18, 26, 0));
    pointer-events: none;
  }
  .hud > * {
    pointer-events: auto;
  }
  .hud-hero {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 4px 14px 4px 4px;
    border-radius: 999px;
    border: 1px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.6);
    color: var(--bronze-ink);
    cursor: pointer;
  }
  .hud-name {
    font-family: var(--font-display);
    font-weight: 700;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hud-right {
    justify-self: end;
    display: flex;
    gap: 10px;
  }
  .hud-round {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 2px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.6);
    font-size: 22px;
    cursor: pointer;
  }
  .hud-dragon img {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
</style>
```

- [ ] **Step 5: Rewrite the Camp screen**

Replace the whole of `web/src/screens/Camp.svelte` with:

```svelte
<script lang="ts">
  // The camp as a hub scene (scenes UI spec §3 "Hub scene", §9 UI1): the painted camp with its
  // places (CAMP_SCENE hotspots, each routing to its unchanged pre-UI1 screen), the slim HUD, the
  // weekly goal banner, the Oracle's prophecy, the dragon's greeting and the hero panel overlay on
  // its own route (`?panel=heros`, plan Ruling 6).
  import SceneStage from '../components/scene/SceneStage.svelte';
  import SceneLayer from '../components/scene/SceneLayer.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Hud from '../components/scene/Hud.svelte';
  import DialogueBox from '../components/scene/DialogueBox.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Onboarding from '../components/Onboarding.svelte';
  import Avatar from '../components/Avatar.svelte';
  import { CAMP_DRAGON_LAYER, CAMP_SCENE, campGreeting } from '../lib/world/scenes/camp';
  import { campStore, loadCatalog, refreshCamp } from '../lib/world/campStore.svelte';
  import { TINT_FILTERS } from '../lib/world/dragon';
  import { ART } from '../lib/world/art';
  import { markGreeted, shouldGreet } from '../lib/scene/greeting';
  import { isEditMode } from '../lib/scene/editMode';
  import type { DialogueLine, HotspotDef, SceneContext, SceneLayerDef } from '../lib/scene/types';
  import { initSound } from '../lib/juice/soundStore.svelte';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { clearProfile } from '../lib/profileStore.svelte';
  import { formatSwissDate } from '../lib/dates';
  import { href } from '../lib/routes';
  import { navigate, router } from '../lib/router.svelte';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  const profileId = $derived(String(profile.id));

  $effect(() => {
    initSound(profile);
    void refreshCamp(profile.id);
    void loadCatalog();
  });

  // campStore is shared across profiles: ignore a snapshot that belongs to the previous hero.
  const camp = $derived(campStore.data && campStore.data.profile.id === profile.id ? campStore.data : null);
  const ctx = $derived<SceneContext>({ camp, catalog: campStore.catalog });
  const panel = $derived(router.route.query.panel ?? null);
  const editing = $derived(isEditMode(typeof location === 'undefined' ? '' : location.search, router.route.query));

  let greeting = $state<DialogueLine[] | null>(null);
  $effect(() => {
    if (!camp || !profile.settings.onboarded || editing || !shouldGreet(profile.id)) return;
    markGreeted(profile.id);
    greeting = campGreeting(profile.name, camp);
  });

  const dragonLayer = $derived<SceneLayerDef | null>(
    camp
      ? { id: 'dragon', src: ART.dragon[camp.dragon.stage], alt: camp.dragon.name ?? 'Ton dragon', ...CAMP_DRAGON_LAYER }
      : null,
  );

  const nearestProphecy = $derived.by(() => {
    const list = camp?.prophecies ?? [];
    return list.length ? [...list].sort((a, b) => a.due_date.localeCompare(b.due_date))[0] : null;
  });

  function activate(def: HotspotDef) {
    unlockAudio();
    playSfx('tap');
    navigate(href(def.target, { profileId }));
  }

  function openHero() {
    unlockAudio();
    playSfx('tap');
    navigate(href('camp', { profileId }, { panel: 'heros' }));
  }

  function closePanel() {
    navigate(href('camp', { profileId }));
  }

  function review(textId: number) {
    navigate(href('play', { profileId, textId: String(textId) }));
  }
</script>

{#if !profile.settings.onboarded}
  <Onboarding {profile} />
{/if}

<SceneStage scene={CAMP_SCENE}>
  {#snippet hud()}
    <Hud {profile} {camp} onHero={openHero} />
  {/snippet}

  {#if dragonLayer && camp}
    <SceneLayer layer={dragonLayer} filter={TINT_FILTERS[camp.dragon.tint]} testId="camp-dragon-layer" />
  {/if}

  {#each CAMP_SCENE.hotspots as def (def.id)}
    <Hotspot {def} status={def.state(ctx)} sceneId="camp" onActivate={activate} />
  {/each}

  <div class="camp-column">
    {#if camp}
      <p class="kit-banner weekly" data-testid="camp-weekly">
        <span class="leaves" aria-hidden="true">
          {#each Array.from({ length: camp.weekly.target }, (_, i) => i) as i (i)}<span
              class="leaf"
              class:filled={i < camp.weekly.done}>🌿</span
            >{/each}
        </span>
        <span>
          {#if camp.weekly.reached}
            Objectif atteint ! Les Muses sont fières.
          {:else}
            Objectif de la semaine : {camp.weekly.done} / {camp.weekly.target} textes
          {/if}
        </span>
      </p>
      {#if nearestProphecy}
        <div class="kit-parchment prophecy" data-testid="camp-prophecy">
          <p>
            Prophétie de l'Oracle : {nearestProphecy.title} — dictée le {formatSwissDate(nearestProphecy.due_date)}
            ({nearestProphecy.days_left === 0 ? "aujourd'hui" : `dans ${nearestProphecy.days_left} jour(s)`})
          </p>
          <button type="button" class="kit-bronze" onclick={() => review(nearestProphecy!.text_id)}>Réviser</button>
        </div>
      {/if}
    {:else if campStore.loading}
      <p class="kit-parchment status">Les Muses préparent le camp…</p>
    {:else if campStore.error}
      <div class="kit-parchment status">
        <p>Impossible de rejoindre le camp : {campStore.error}</p>
        <button type="button" class="kit-bronze" onclick={() => refreshCamp(profile.id)}>Réessayer</button>
      </div>
    {/if}
  </div>

  {#if greeting}
    <DialogueBox lines={greeting} onDone={() => (greeting = null)} />
  {/if}
</SceneStage>

{#if panel === 'heros'}
  <Overlay variant="scroll" title="Ton héros" testId="overlay-heros" onClose={closePanel}>
    <div class="hero-panel">
      <Avatar avatar={profile.avatar} size={64} />
      <p class="hero-name">{profile.name}</p>
      <a class="kit-bronze" href={href('settings', { profileId })}>Réglages</a>
      <a class="kit-bronze" href={href('stats', { profileId })}>Progrès</a>
      <a class="kit-bronze" href={href('profiles')} onclick={() => clearProfile()}>Changer de héros</a>
    </div>
  </Overlay>
{/if}

<style>
  .camp-column {
    position: absolute;
    left: 28%;
    top: 16%;
    width: 24%;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .weekly {
    margin: 0;
    flex-wrap: wrap;
    font-size: 15px;
  }
  .leaf {
    filter: grayscale(1) opacity(0.5);
  }
  .leaf.filled {
    filter: none;
  }
  .prophecy {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    font-size: 15px;
  }
  .prophecy p,
  .status p {
    margin: 0;
  }
  .status {
    margin: 0;
    padding: 8px 12px;
    font-size: 15px;
  }
  .hero-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .hero-name {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
  }
</style>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `scripts/npm.sh run test -- src/lib/scene/hud.test.ts` → Expected: 2 passed.
Run: `scripts/npm.sh run check` → Expected: 0 errors.
Run: `scripts/playwright.sh profiles happy-path world smoke seed` → Expected: all passed (the camp-dependent functional specs on the existing desktop project).
Run: `scripts/playwright.sh grimoire alexandria scan` → Expected: all passed (they go through `createProfile`).

- [ ] **Step 7: Commit**

```bash
P="web/src/lib/scene/hud.ts web/src/lib/scene/hud.test.ts web/src/components/scene/Hud.svelte web/src/screens/Camp.svelte web/e2e/helpers.ts web/e2e/profiles.spec.ts web/e2e/happy-path.spec.ts web/e2e/world.spec.ts web/e2e/playability.spec.ts web/e2e/playability-sp3.spec.ts"
git add $P && git commit -m "UI1: the camp becomes a hub scene with HUD, greeting and hero panel

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

---

### Task 8: WebKit iPad project and the hub e2e (hotspots, Back, overlay route, portrait, reduced motion)

**Files:**
- Modify: `web/playwright.config.ts`, `web/playwright.playability.config.ts`
- Create: `web/e2e/scenes-camp.spec.ts`

**Interfaces:**
- Consumes: the Task 7 DOM contract; helpers `expectCamp`, `createProfileApi`, `createText`, `makeResult`, `postSession`.
- Produces: Playwright projects `desktop` and `ipad` (the `ipad` project only runs `**/scenes-*.spec.ts`); every future scene spec must be named `scenes-*.spec.ts`.

- [ ] **Step 1: Write the failing spec**

`web/e2e/scenes-camp.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { createProfileApi, createText, expectCamp, makeResult, postSession } from './helpers';

// UI1 (scenes spec §9, §10): the camp as a hub scene, in both WebKit projects (desktop 1280x720
// and iPad landscape 1180x820). Every place is a real button that routes to its (unchanged)
// screen, Back returns to the hub, the hero panel has its own route, portrait shows the rotate
// screen, reduced motion removes parallax, bob and particles.

const PLACES: { id: string; path: RegExp; name: RegExp }[] = [
  { id: 'dragon', path: /\/dragon$/, name: /Le nid du dragon/ },
  { id: 'oracle', path: /\/delphes$/, name: /Le chemin de Delphes/ },
  { id: 'quests', path: /\/quetes$/, name: /Le tableau des quêtes/ },
  { id: 'parchemins', path: /\/parchemins$/, name: /La tente des parchemins/ },
  { id: 'dossier', path: /\/dossier$/, name: /La tente de guerre/ },
  { id: 'bestiary', path: /\/bestiaire$/, name: /Le bestiaire/ },
  { id: 'cabin', path: /\/cabane$/, name: /Ta cabane/ },
];

const heroName = (project: string) => `Hub-${project}-${Date.now() % 1e6}`;

async function openCamp(page: Page, profileId: number) {
  await page.goto(`/#/p/${profileId}/camp`);
  await expectCamp(page);
  await expect(page.getByTestId('hud-xp')).toBeVisible(); // /camp has loaded
}

test('every place routes to its screen and Back returns to the hub', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  for (const place of PLACES) {
    const spot = page.getByTestId(`camp-${place.id}`);
    await expect(spot).toBeVisible();
    await expect(spot).toHaveAccessibleName(place.name);
    await spot.click();
    await expect(page).toHaveURL(place.path);
    await page.goBack();
    await expectCamp(page);
  }
  await expect(page.getByTestId('camp-boss')).toHaveCount(0);
});

test('places sit inside the visible safe zone and work from the keyboard', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  const vp = page.viewportSize()!;
  for (const place of PLACES) {
    const b = (await page.getByTestId(`camp-${place.id}`).boundingBox())!;
    expect(b.x, place.id).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, place.id).toBeLessThanOrEqual(vp.width);
    expect(b.y, place.id).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height, place.id).toBeLessThanOrEqual(vp.height);
    expect(Math.min(b.width, b.height), place.id).toBeGreaterThanOrEqual(48);
  }
  await page.getByTestId('camp-parchemins').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/parchemins$/);
});

test('HUD: laurel, dragon, sound toggle, and the hero panel on its own route', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  await expect(page.getByTestId('hud-xp')).toContainText('Recrue du camp');

  const mute = page.getByTestId('hud-mute');
  const before = await mute.getAttribute('aria-pressed');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', before ?? 'false');

  await page.getByTestId('hud-dragon').click();
  await expect(page).toHaveURL(/\/dragon$/);
  await page.goBack();
  await expectCamp(page);

  const panel = page.getByTestId('overlay-heros');
  await page.getByTestId('hud-hero').click();
  await expect(page).toHaveURL(/\/camp\?panel=heros$/);
  await expect(panel).toBeVisible();
  for (const name of ['Réglages', 'Progrès', 'Changer de héros']) {
    await expect(panel.getByRole('link', { name })).toBeVisible();
  }
  await page.goBack();
  await expect(panel).toHaveCount(0);

  await page.getByTestId('hud-hero').click();
  await page.getByTestId('overlay-close').click();
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/\/camp$/);

  await page.goto(`/#/p/${id}/camp?panel=heros`);
  await expect(panel).toBeVisible();
  await panel.getByRole('link', { name: 'Réglages' }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test('the dragon greets once per visit; a tap advances, « Passer » closes', async ({ page, request }, testInfo) => {
  const name = heroName(testInfo.project.name);
  const id = await createProfileApi(request, name);
  await openCamp(page, id);
  const text = page.getByTestId('dialogue-text');
  await expect(text).toHaveText(`Bienvenue au camp, ${name}.`);
  await page.getByTestId('dialogue-advance').click();
  await expect(text).toHaveText("L'œuf frémit chaque fois qu'un piège d'Éris est déjoué.");
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);

  await page.getByTestId('camp-parchemins').click();
  await expect(page).toHaveURL(/\/parchemins$/);
  await page.goBack();
  await expectCamp(page);
  await expect(page.getByTestId('hud-xp')).toBeVisible();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
});

test('portrait shows the rotate screen instead of the scene', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await openCamp(page, id);
  const landscape = page.viewportSize()!;
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByTestId('rotate-screen')).toBeVisible();
  await expect(page.getByTestId('rotate-screen')).toContainText('Tourne ton iPad');
  await expect(page.getByTestId('camp-parchemins')).toBeHidden();
  await page.setViewportSize(landscape);
  await expect(page.getByTestId('rotate-screen')).toBeHidden();
  await expect(page.getByTestId('camp-parchemins')).toBeVisible();
});

test('reduced motion: no parallax, no idle bob, no particles', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCamp(page, id);
  const stage = page.getByTestId('scene-camp');
  const label = page.getByTestId('camp-parchemins').locator('.hotspot-label');
  const dragon = page.getByTestId('camp-dragon-layer');
  await expect(stage).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.getByTestId('fx-canvas')).toHaveCount(0);
  expect(await label.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await expect(dragon).toBeVisible();
  await page.mouse.move(20, 20);
  await page.mouse.move(60, 40);
  await expect(dragon).toHaveAttribute('data-offset', '0,0');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(stage).toHaveAttribute('data-reduced-motion', 'false');
  await expect(page.getByTestId('fx-canvas')).toHaveCount(1);
  expect(await label.evaluate((el) => getComputedStyle(el).animationName)).not.toBe('none');
  if (testInfo.project.name === 'desktop') {
    // Hover parallax is a pointer-device behaviour; on the iPad it follows a touch drag.
    await page.mouse.move(10, 10);
    await expect(dragon).not.toHaveAttribute('data-offset', '0,0');
  }
});

test('the path to battle appears once Éris can be fought', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const text = await createText(request, {
    title: `Veillée ${testInfo.project.name} ${Date.now()}`,
    body: 'Les héros reviennent au camp. Ils racontent leurs voyages et les Muses les écoutent.',
    level: '10H',
  });
  // Neutralise two lieutenants over three days (SP3 decision 3) -> boss tier 1 (decision 8).
  for (const day of ['2026-08-03', '2026-08-04', '2026-08-05']) {
    for (const category of ['agreement:verb', 'homophone']) {
      await postSession(request, { profileId: id, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category }) });
    }
  }
  await openCamp(page, id);
  const boss = page.getByTestId('camp-boss');
  await expect(boss).toBeVisible();
  await expect(boss).toContainText('Combat 1');
  await expect(page.getByTestId('camp-dragon')).not.toContainText('Un œuf de dragon');
  await boss.click();
  await expect(page).toHaveURL(/\/eris$/);
});
```

- [ ] **Step 2: Run it to verify the iPad project does not exist yet**

Run: `scripts/playwright.sh scenes-camp --project=ipad`
Expected: FAIL — `Project(s) "ipad" not found`.

- [ ] **Step 3: Add the projects**

Replace `web/playwright.config.ts` with:

```ts
import { defineConfig, devices } from '@playwright/test';

// Main e2e run (scripts/playwright.sh, part of scripts/check.sh), two WebKit projects (scenes
// spec §10): `desktop` runs every functional spec (Desktop Safari 1280x720, the pre-UI1 setup);
// `ipad` runs the scene specs (scenes-*.spec.ts) at iPad landscape 1180x820 with touch.
// Playability walks (playability*.spec.ts) write review screenshots and only run through
// playwright.playability.config.ts.
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/playability*.spec.ts'],
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    locale: 'fr-CH',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Safari'] } },
    {
      name: 'ipad',
      testMatch: ['**/scenes-*.spec.ts'],
      use: {
        ...devices['iPad Pro 11 landscape'],
        viewport: { width: 1180, height: 820 },
        deviceScaleFactor: 1,
        hasTouch: true,
      },
    },
  ],
});
```

In `web/playwright.playability.config.ts` replace the comment block and `testMatch` with:

```ts
// Playability walks (spec §6.2, scenes spec §10): one long test per iPad orientation, screenshots
// into docs/reviews/<milestone>/ (playability.spec.ts = sp1, -sp2, -sp3, -ui1).
// Run with scripts/playwright.sh --config playwright.playability.config.ts [playability-ui1]
```

```ts
  testMatch: ['**/playability*.spec.ts'],
```

- [ ] **Step 4: Run the hub spec in both projects**

Run: `scripts/playwright.sh scenes-camp`
Expected: 14 passed (7 tests × `desktop` and `ipad`).
If a hotspot click fails with "element intercepts pointer events", a label or the column overlaps another place's centre on that viewport: fix the layout (label side in `camp.ts`, or `.camp-column` placement in `Camp.svelte`), never the test.

- [ ] **Step 5: Run the whole main e2e suite**

Run: `scripts/playwright.sh`
Expected: every spec passes; the list shows `[desktop]` for all specs and `[ipad]` only for `scenes-camp.spec.ts`; no `playability*` spec runs.

- [ ] **Step 6: Commit**

```bash
P="web/playwright.config.ts web/playwright.playability.config.ts web/e2e/scenes-camp.spec.ts"
git add $P && git commit -m "UI1: WebKit iPad landscape project and camp hub e2e

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

---

### Task 9: The `?edit` hotspot editor

> **Superseded (2026-09-24, user decision):** this editor was dropped and replaced by Task 9b's read-only `?debug` overlay (Ruling 9 as amended). The steps below are kept as the historical record only.

**Files:**
- Create: `web/src/lib/scene/editor.ts`, `web/src/lib/scene/editor.test.ts`
- Create: `web/src/components/scene/SceneEditor.svelte`
- Modify: `web/src/components/scene/SceneStage.svelte` (render the editor in edit mode)
- Create: `web/e2e/scenes-editor.spec.ts`

**Interfaces:**
- Consumes: Task 3 (`ShapeMap`, `HotspotShape`, `EllipseShape`, `PolygonShape`, `Pt`, `shapeBox`, `SAFE_ZONE`, `HUD_BAND`, `DIALOGUE_DOCK`, `validateShapes`), Task 4 (`CAMP_SHAPES`, the exact `camp.shapes.ts` text), Task 5 (`SceneRuntime.editing`).
- Produces:
  - `editor.ts`: `interface RectLike { left: number; top: number; width: number; height: number }`; `clientToArt(clientX: number, clientY: number, rect: RectLike): Pt` (0.1 precision, clamped 0–100); `translateShape(s: HotspotShape, dx: number, dy: number): HotspotShape`; `setRadius(s: EllipseShape, axis: 'rx' | 'ry', to: Pt): EllipseShape` (min 0.5); `movePoint(s: PolygonShape, index: number, to: Pt): PolygonShape`; `toPolygon(s: HotspotShape, n?: number): PolygonShape`; `toEllipse(s: HotspotShape): EllipseShape`; `shapesToTs(sceneId: string, shapes: ShapeMap): string` (the full `<scene>.shapes.ts` file); `shapesToJson(shapes: ShapeMap): string`.
  - `SceneEditor.svelte` props `{ sceneId: string; initial: ShapeMap }`; test ids `scene-editor`, `editor-shape-<id>`, `editor-pick-<id>`, `editor-to-ellipse`, `editor-to-polygon`, `editor-copy-ts`, `editor-copy-json`, `editor-output` (readonly textarea), `editor-problems` / `editor-ok`.

- [ ] **Step 1: Write the failing unit test**

`web/src/lib/scene/editor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAMP_SHAPES } from '../world/scenes/camp.shapes';
import {
  clientToArt,
  movePoint,
  setRadius,
  shapesToJson,
  shapesToTs,
  toEllipse,
  toPolygon,
  translateShape,
} from './editor';

const rect = { left: 100, top: 50, width: 1000, height: 500 };

describe('hotspot editor maths', () => {
  it('maps client pixels to art % with 0.1 precision, clamped', () => {
    expect(clientToArt(600, 300, rect)).toEqual([50, 50]);
    expect(clientToArt(101.234, 50, rect)).toEqual([0.1, 0]);
    expect(clientToArt(0, 9999, rect)).toEqual([0, 100]);
  });

  it('moves, resizes and reshapes', () => {
    expect(translateShape({ kind: 'ellipse', cx: 30, cy: 53, rx: 7.5, ry: 8 }, 1.23, -3)).toEqual({
      kind: 'ellipse',
      cx: 31.2,
      cy: 50,
      rx: 7.5,
      ry: 8,
    });
    expect(translateShape({ kind: 'polygon', points: [[10, 10], [20, 10], [15, 20]] }, 5, 5)).toEqual({
      kind: 'polygon',
      points: [[15, 15], [25, 15], [20, 25]],
    });
    const e = { kind: 'ellipse' as const, cx: 50, cy: 50, rx: 5, ry: 5 };
    expect(setRadius(e, 'rx', [58.26, 0])).toEqual({ ...e, rx: 8.3 });
    expect(setRadius(e, 'ry', [0, 50.1])).toEqual({ ...e, ry: 0.5 });
    expect(movePoint({ kind: 'polygon', points: [[1, 1], [2, 2], [3, 1]] }, 1, [4.44, 5.56])).toEqual({
      kind: 'polygon',
      points: [[1, 1], [4.4, 5.6], [3, 1]],
    });
  });

  it('converts ellipse <-> polygon', () => {
    expect(toPolygon({ kind: 'ellipse', cx: 50, cy: 50, rx: 10, ry: 5 }, 4)).toEqual({
      kind: 'polygon',
      points: [[60, 50], [50, 55], [40, 50], [50, 45]],
    });
    expect(toEllipse({ kind: 'polygon', points: [[40, 45], [60, 45], [50, 55]] })).toEqual({
      kind: 'ellipse',
      cx: 50,
      cy: 50,
      rx: 10,
      ry: 5,
    });
  });

  it('serialises the drop-in camp.shapes.ts file byte for byte', () => {
    const file = readFileSync('src/lib/world/scenes/camp.shapes.ts', 'utf-8').replace(/\r\n/g, '\n');
    expect(shapesToTs('camp', CAMP_SHAPES)).toBe(file);
  });

  it('serialises JSON that parses back to the same shapes', () => {
    expect(JSON.parse(shapesToJson(CAMP_SHAPES))).toEqual(CAMP_SHAPES);
  });
});
```

- [ ] **Step 2: Write the failing e2e spec**

`web/e2e/scenes-editor.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createProfileApi, expectCamp } from './helpers';

// Scenes spec §4 hotspot editor, plan Ruling 9: dev aid behind ?edit, hidden otherwise.

const heroName = (project: string) => `Edit-${project}-${Date.now() % 1e6}`;

test('the editor is hidden without the flag', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  await expect(page.getByTestId('hud-xp')).toBeVisible();
  await expect(page.getByTestId('scene-editor')).toHaveCount(0);
});

test('?edit before the hash or in the hash query shows the editor, no greeting', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/?edit#/p/${id}/camp`);
  await expect(page.getByTestId('scene-editor')).toBeVisible();
  await expect(page.getByTestId('editor-output')).toHaveValue(/export const CAMP_SHAPES = \{/);
  await expect(page.getByTestId('editor-output')).toHaveValue(/parchemins: \{ kind: 'ellipse', cx: 30, cy: 53, rx: 7\.5, ry: 8 \}/);
  await expect(page.getByTestId('editor-ok')).toBeVisible();
  await expect(page.getByTestId('hud-xp')).toBeVisible();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);

  await page.goto(`/#/p/${id}/camp?edit`);
  await expect(page.getByTestId('scene-editor')).toBeVisible();
});

test('dragging a shape and converting it rewrites the output', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'the editor is a desktop dev aid (mouse drag)');
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await page.goto(`/?edit#/p/${id}/camp`);
  const shape = page.getByTestId('editor-shape-parchemins');
  await expect(shape).toBeVisible();
  const b = (await shape.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();
  const out = await page.getByTestId('editor-output').inputValue();
  const cx = Number(out.match(/parchemins: \{ kind: 'ellipse', cx: ([\d.]+)/)![1]);
  expect(cx).toBeGreaterThan(33);

  await page.getByTestId('editor-pick-oracle').click();
  await page.getByTestId('editor-to-polygon').click();
  await expect(page.getByTestId('editor-output')).toHaveValue(/oracle: \{ kind: 'polygon', points: \[\[/);
  await page.getByTestId('editor-copy-json').click();
  await expect(page.getByTestId('editor-output')).toHaveValue(/"oracle": \{\s*"kind": "polygon"/);
});
```

- [ ] **Step 3: Run both to verify they fail**

Run: `scripts/npm.sh run test -- src/lib/scene/editor.test.ts` → Expected: FAIL (cannot resolve `./editor`).
Run: `scripts/playwright.sh scenes-editor` → Expected: the flag tests FAIL (`scene-editor` not found); "hidden without the flag" passes.

- [ ] **Step 4: Implement `editor.ts`**

`web/src/lib/scene/editor.ts`:

```ts
// Hotspot editor maths and serialisation (scenes UI spec §4 "draw/drag hotspot shapes over a
// scene, copy the data as TS/JSON"). shapesToTs() emits the whole `<scene>.shapes.ts` file, so
// UI2's new art only needs a paste; editor.test.ts pins the format against camp.shapes.ts.
import { shapeBox } from './geometry';
import type { EllipseShape, HotspotShape, PolygonShape, Pt, ShapeMap } from './types';

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10 + 0;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function clientToArt(clientX: number, clientY: number, rect: RectLike): Pt {
  return [r1(clamp(((clientX - rect.left) / rect.width) * 100)), r1(clamp(((clientY - rect.top) / rect.height) * 100))];
}

export function translateShape(s: HotspotShape, dx: number, dy: number): HotspotShape {
  if (s.kind === 'ellipse') return { ...s, cx: r1(s.cx + dx), cy: r1(s.cy + dy) };
  return { kind: 'polygon', points: s.points.map(([x, y]) => [r1(x + dx), r1(y + dy)] as Pt) };
}

export function setRadius(s: EllipseShape, axis: 'rx' | 'ry', to: Pt): EllipseShape {
  const v = axis === 'rx' ? Math.abs(to[0] - s.cx) : Math.abs(to[1] - s.cy);
  return { ...s, [axis]: r1(Math.max(0.5, v)) };
}

export function movePoint(s: PolygonShape, index: number, to: Pt): PolygonShape {
  return { kind: 'polygon', points: s.points.map((p, i) => (i === index ? ([r1(to[0]), r1(to[1])] as Pt) : p)) };
}

export function toPolygon(s: HotspotShape, n = 8): PolygonShape {
  if (s.kind === 'polygon') return s;
  const points: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    points.push([r1(s.cx + s.rx * Math.cos(a)), r1(s.cy + s.ry * Math.sin(a))]);
  }
  return { kind: 'polygon', points };
}

export function toEllipse(s: HotspotShape): EllipseShape {
  if (s.kind === 'ellipse') return s;
  const b = shapeBox(s);
  return { kind: 'ellipse', cx: r1(b.x + b.w / 2), cy: r1(b.y + b.h / 2), rx: r1(b.w / 2), ry: r1(b.h / 2) };
}

function shapeLiteral(s: HotspotShape): string {
  if (s.kind === 'ellipse') return `{ kind: 'ellipse', cx: ${s.cx}, cy: ${s.cy}, rx: ${s.rx}, ry: ${s.ry} }`;
  return `{ kind: 'polygon', points: [${s.points.map(([x, y]) => `[${x}, ${y}]`).join(', ')}] }`;
}

export function shapesToTs(sceneId: string, shapes: ShapeMap): string {
  const body = Object.entries(shapes)
    .map(([id, s]) => `  ${id}: ${shapeLiteral(s)},`)
    .join('\n');
  return [
    `// Hotspot geometry of the ${sceneId} scene, in art % (0-100) of the 16:9 art frame.`,
    `// Generated by the ?edit hotspot editor: paste its "Copier TS" output over this whole file.`,
    `import type { ShapeMap } from '../../scene/types';`,
    ``,
    `export const ${sceneId.toUpperCase()}_SHAPES = {`,
    body,
    `} satisfies ShapeMap;`,
    ``,
  ].join('\n');
}

export function shapesToJson(shapes: ShapeMap): string {
  return JSON.stringify(shapes, null, 2) + '\n';
}
```

Run: `scripts/npm.sh run test -- src/lib/scene/editor.test.ts` → Expected: 5 passed.

- [ ] **Step 5: Write the editor component and mount it**

`web/src/components/scene/SceneEditor.svelte`:

```svelte
<script lang="ts">
  // Dev-only hotspot editor (scenes UI spec §4, plan Ruling 9), rendered by SceneStage only with
  // `?edit`: drag shapes over the art, resize ellipses (handles), move polygon points, switch a
  // shape between ellipse and polygon, then copy the geometry as the drop-in `<scene>.shapes.ts`
  // file (or JSON). Guides: the 4:3 safe zone, the HUD band and the dialogue dock.
  import {
    clientToArt,
    movePoint,
    setRadius,
    shapesToJson,
    shapesToTs,
    toEllipse,
    toPolygon,
    translateShape,
  } from '../../lib/scene/editor';
  import { DIALOGUE_DOCK, HUD_BAND, SAFE_ZONE } from '../../lib/scene/geometry';
  import { validateShapes } from '../../lib/scene/validate';
  import type { HotspotShape, Pt, ShapeMap } from '../../lib/scene/types';

  let { sceneId, initial }: { sceneId: string; initial: ShapeMap } = $props();

  type Drag =
    | { kind: 'move'; id: string; start: Pt; orig: HotspotShape }
    | { kind: 'rx' | 'ry'; id: string }
    | { kind: 'point'; id: string; index: number };

  // A private working copy: edits never touch the scene's real data.
  let shapes = $state<ShapeMap>(JSON.parse(JSON.stringify(initial)));
  let selected = $state<string>(Object.keys(initial)[0] ?? '');
  let format = $state<'ts' | 'json'>('ts');
  let svg: SVGSVGElement | undefined = $state();
  let drag: Drag | null = null;

  const output = $derived(format === 'ts' ? shapesToTs(sceneId, shapes) : shapesToJson(shapes));
  const problems = $derived(validateShapes(shapes));

  function artPt(e: PointerEvent): Pt {
    return clientToArt(e.clientX, e.clientY, svg!.getBoundingClientRect());
  }

  function begin(e: PointerEvent, d: Drag) {
    e.stopPropagation();
    e.preventDefault();
    selected = d.id;
    drag = d;
    svg?.setPointerCapture(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (!drag) return;
    const p = artPt(e);
    const s = shapes[drag.id];
    if (drag.kind === 'move') shapes[drag.id] = translateShape(drag.orig, p[0] - drag.start[0], p[1] - drag.start[1]);
    else if ((drag.kind === 'rx' || drag.kind === 'ry') && s.kind === 'ellipse') shapes[drag.id] = setRadius(s, drag.kind, p);
    else if (drag.kind === 'point' && s.kind === 'polygon') shapes[drag.id] = movePoint(s, drag.index, p);
  }

  function end() {
    drag = null;
  }

  async function copy(f: 'ts' | 'json') {
    format = f;
    try {
      await navigator.clipboard.writeText(f === 'ts' ? shapesToTs(sceneId, shapes) : shapesToJson(shapes));
    } catch {
      // Clipboard refused (permissions, http): the textarea below still shows the text to copy.
    }
  }
</script>

<div class="scene-editor" data-testid="scene-editor">
  <svg
    bind:this={svg}
    class="editor-svg"
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    role="application"
    aria-label="Éditeur de zones"
    onpointermove={onMove}
    onpointerup={end}
    onpointercancel={end}
  >
    <rect class="guide" x={SAFE_ZONE.x} y={SAFE_ZONE.y} width={SAFE_ZONE.w} height={SAFE_ZONE.h} />
    <line class="guide" x1="0" x2="100" y1={HUD_BAND} y2={HUD_BAND} />
    <rect class="guide dock" x={DIALOGUE_DOCK.x} y={DIALOGUE_DOCK.y} width={DIALOGUE_DOCK.w} height={DIALOGUE_DOCK.h} />
    {#each Object.entries(shapes) as [id, s] (id)}
      {#if s.kind === 'ellipse'}
        <ellipse
          class="shape"
          class:selected={id === selected}
          data-testid="editor-shape-{id}"
          cx={s.cx}
          cy={s.cy}
          rx={s.rx}
          ry={s.ry}
          role="presentation"
          onpointerdown={(e) => begin(e, { kind: 'move', id, start: artPt(e), orig: $state.snapshot(s) as HotspotShape })}
        />
        {#if id === selected}
          <ellipse class="handle" cx={s.cx + s.rx} cy={s.cy} rx="0.6" ry="1" role="presentation" onpointerdown={(e) => begin(e, { kind: 'rx', id })} />
          <ellipse class="handle" cx={s.cx} cy={s.cy + s.ry} rx="0.6" ry="1" role="presentation" onpointerdown={(e) => begin(e, { kind: 'ry', id })} />
        {/if}
      {:else}
        <polygon
          class="shape"
          class:selected={id === selected}
          data-testid="editor-shape-{id}"
          points={s.points.map((p) => p.join(',')).join(' ')}
          role="presentation"
          onpointerdown={(e) => begin(e, { kind: 'move', id, start: artPt(e), orig: $state.snapshot(s) as HotspotShape })}
        />
        {#if id === selected}
          {#each s.points as p, i (i)}
            <ellipse class="handle" cx={p[0]} cy={p[1]} rx="0.6" ry="1" role="presentation" onpointerdown={(e) => begin(e, { kind: 'point', id, index: i })} />
          {/each}
        {/if}
      {/if}
    {/each}
  </svg>

  <aside class="editor-panel kit-parchment" aria-label="Zones de la scène">
    <p class="editor-title">Zones · {sceneId}</p>
    <div class="editor-row">
      {#each Object.keys(shapes) as id (id)}
        <button type="button" class="chip" class:chip-active={id === selected} data-testid="editor-pick-{id}" onclick={() => (selected = id)}>{id}</button>
      {/each}
    </div>
    {#if selected}
      <div class="editor-row">
        <button type="button" class="kit-bronze" data-testid="editor-to-ellipse" onclick={() => (shapes[selected] = toEllipse(shapes[selected]))}>Ellipse</button>
        <button type="button" class="kit-bronze" data-testid="editor-to-polygon" onclick={() => (shapes[selected] = toPolygon(shapes[selected]))}>Polygone</button>
      </div>
    {/if}
    <div class="editor-row">
      <button type="button" class="kit-bronze" data-testid="editor-copy-ts" onclick={() => copy('ts')}>Copier TS</button>
      <button type="button" class="kit-bronze" data-testid="editor-copy-json" onclick={() => copy('json')}>Copier JSON</button>
    </div>
    <textarea readonly rows="10" data-testid="editor-output" value={output}></textarea>
    {#if problems.length}
      <ul class="editor-problems" data-testid="editor-problems">
        {#each problems as p (p)}<li>{p}</li>{/each}
      </ul>
    {:else}
      <p class="editor-ok" data-testid="editor-ok">Aucun problème.</p>
    {/if}
  </aside>
</div>

<style>
  .editor-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 10;
    touch-action: none;
  }
  .guide {
    fill: none;
    stroke: rgba(255, 255, 255, 0.7);
    stroke-dasharray: 1 1;
    vector-effect: non-scaling-stroke;
  }
  .guide.dock {
    stroke: rgba(241, 220, 154, 0.9);
  }
  .shape {
    fill: rgba(44, 110, 143, 0.25);
    stroke: #d8e8ef;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
    cursor: move;
  }
  .shape.selected {
    fill: rgba(201, 162, 39, 0.35);
    stroke: #f1dc9a;
  }
  .handle {
    fill: #fff7e6;
    stroke: #15121a;
    vector-effect: non-scaling-stroke;
    cursor: crosshair;
  }
  .editor-panel {
    position: fixed;
    right: 12px;
    top: 80px;
    z-index: 30;
    width: 340px;
    max-height: calc(100dvh - 100px);
    overflow: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 14px;
  }
  .editor-title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
  }
  .editor-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  textarea {
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 12px;
    width: 100%;
  }
  .editor-problems {
    margin: 0;
    padding-left: 18px;
    color: var(--orange);
  }
  .editor-ok {
    margin: 0;
    color: var(--olive);
  }
</style>
```

In `web/src/components/scene/SceneStage.svelte`:
- add `import SceneEditor from './SceneEditor.svelte';` to the imports;
- right after `{@render children?.()}` inside `.art`, add:

```svelte
        {#if runtime.editing}
          <SceneEditor sceneId={scene.id} initial={Object.fromEntries(scene.hotspots.map((h) => [h.id, h.shape]))} />
        {/if}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `scripts/npm.sh run check` → Expected: 0 errors.
Run: `scripts/npm.sh run test` → Expected: all pass (including the byte-for-byte `camp.shapes.ts` round trip).
Run: `scripts/playwright.sh scenes-editor` → Expected: `desktop` 3 passed; `ipad` 2 passed, 1 skipped.

- [ ] **Step 7: Commit**

```bash
P="web/src/lib/scene/editor.ts web/src/lib/scene/editor.test.ts web/src/components/scene/SceneEditor.svelte web/src/components/scene/SceneStage.svelte web/e2e/scenes-editor.spec.ts"
git add $P && git commit -m "UI1: ?edit hotspot editor with TS/JSON export

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

---

### Task 10: iPad-size screenshots for the playability review, and the full gate

**Files:**
- Create: `web/e2e/playability-ui1.spec.ts`
- Create (generated): `docs/reviews/ui1/*.png`

**Interfaces:**
- Consumes: everything above; helpers `stubSpeech`, `skipOnboarding`, `expectCamp`, `createText`, `makeResult`, `postSession`; the playability config's `ipad-landscape` (1180×820) and `ipad-portrait` (820×1180) projects.
- Produces: `docs/reviews/ui1/ipad-landscape-NN-<name>.png` (16 shots) and `docs/reviews/ui1/ipad-portrait-01-rotate-screen.png`, plus a `NOTES` block in the run log for the Opus playability/immersion review (spec §10: "does anything still look like a school form?").

- [ ] **Step 1: Write the walk**

`web/e2e/playability-ui1.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { createText, expectCamp, makeResult, postSession, skipOnboarding, stubSpeech } from './helpers';

// Playability walk for the UI1 review (scenes spec §10): iPad-size screenshots of the camp hub
// into docs/reviews/ui1/<project>-NN-<name>.png for the Opus playability/immersion review ("does
// anything still look like a school form?"). Landscape walks the hub; portrait only records the
// rotate screen. Run: scripts/playwright.sh --config playwright.playability.config.ts playability-ui1

const OUT = '/work/docs/reviews/ui1';

async function shot(page: Page, project: string, name: string, settleMs = 900) {
  // Longer than the 450 ms scene zoom-in and the 280 ms overlay slide.
  await page.waitForTimeout(settleMs);
  await page.screenshot({ path: `${OUT}/${project}-${name}.png` });
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

async function dismissGreeting(page: Page) {
  await expect(page.getByTestId('dialogue-box')).toBeVisible();
  await page.getByTestId('dialogue-skip').click();
  await expect(page.getByTestId('dialogue-box')).toHaveCount(0);
}

test('UI1 playability walk', async ({ page, request }, testInfo) => {
  test.setTimeout(300_000);
  const project = testInfo.project.name;
  const notes: string[] = [];
  const origins = new Set<string>();
  page.on('request', (req) => {
    try {
      origins.add(new URL(req.url()).origin);
    } catch {
      // data: URLs etc.
    }
  });
  await stubSpeech(page);
  try {
    await walk();
  } finally {
    notes.push(`request origins: ${JSON.stringify([...origins])}`);
    console.log(`\n===== NOTES ${project} =====\n${notes.join('\n')}\n`);
  }

  async function walk() {
    // ---- 01 New hero lands on the hub, onboarding on top ------------------------------------
    const name = `Ariane-${project}`;
    await page.goto('/');
    await page.getByRole('button', { name: /Nouveau héros/ }).click();
    await page.getByLabel('Ton prénom').fill(name);
    await page.getByLabel('Ton niveau').selectOption('10H');
    await page.getByRole('button', { name: 'Rejoindre le camp' }).click();
    await expectCamp(page);
    const profileId = Number(page.url().match(/#\/p\/(\d+)\//)?.[1]);
    expect(profileId).toBeGreaterThan(0);

    if (project === 'ipad-portrait') {
      await expect(page.getByTestId('rotate-screen')).toBeVisible();
      await shot(page, project, '01-rotate-screen');
      return;
    }

    await shot(page, project, '01-camp-onboarding', 1500);
    await skipOnboarding(page);

    // ---- 02-04 The dragon's greeting, then the fresh hub -------------------------------------
    const line = page.getByTestId('dialogue-text');
    await expect(line).toHaveText(`Bienvenue au camp, ${name}.`);
    await shot(page, project, '02-camp-greeting');
    await page.getByTestId('dialogue-advance').click();
    await expect(line).toHaveText(/L'œuf frémit/);
    await shot(page, project, '03-camp-greeting-2');
    await page.getByTestId('dialogue-skip').click();
    await shot(page, project, '04-camp-hub-egg');
    const boxes = await page
      .locator('.hotspot')
      .evaluateAll((els) => els.map((e) => `${e.getAttribute('data-testid')} ${JSON.stringify(e.getBoundingClientRect())}`));
    notes.push(`hotspot boxes: ${boxes.join(' | ')}`);
    notes.push(
      `fonts loaded: ${JSON.stringify(
        await page.evaluate(async () => {
          await document.fonts.ready;
          return {
            cinzel: document.fonts.check('700 16px Cinzel'),
            alegreya: document.fonts.check('400 16px Alegreya'),
            literata: document.fonts.check('400 16px Literata'),
          };
        }),
      )}`,
    );

    // ---- 05 Keyboard focus on a place -------------------------------------------------------
    await page.getByTestId('camp-oracle').focus();
    await shot(page, project, '05-camp-focus');

    // ---- 06 Hero panel (overlay on its own route) -------------------------------------------
    await page.getByTestId('hud-hero').click();
    await expect(page.getByTestId('overlay-heros')).toBeVisible();
    await shot(page, project, '06-hero-panel');
    await page.getByTestId('overlay-close').click();

    // ---- 07-08 A lived-in camp: dragon hatched and named, a board quest, the battle path -----
    const text = await createText(request, {
      title: `Veillée ${project}`,
      body: 'Les héros reviennent au camp. Ils racontent leurs voyages et les Muses les écoutent.',
      level: '10H',
    });
    for (const day of ['2026-08-03', '2026-08-04', '2026-08-05']) {
      for (const category of ['agreement:verb', 'homophone']) {
        await postSession(request, { profileId, textId: text.id, day, result: makeResult({ draft: 4, caught: 4, category }) });
      }
    }
    expect((await request.patch(`/api/profiles/${profileId}/dragon`, { data: { name: 'Braise' } })).ok()).toBeTruthy();
    expect((await request.post(`/api/profiles/${profileId}/quests`, { data: { target: 'chimere' } })).ok()).toBeTruthy();
    await page.reload();
    await expectCamp(page);
    await expect(page.getByTestId('camp-boss')).toBeVisible();
    await expect(page.getByTestId('camp-dragon')).toContainText('Braise');
    await expect(page.getByTestId('dialogue-box')).toBeVisible();
    await shot(page, project, '07-camp-hatchling-greeting');
    await dismissGreeting(page);
    await shot(page, project, '08-camp-lived-in');
    notes.push(`camp lived-in text: ${clean(await page.getByTestId('scene-camp').textContent())}`);

    // ---- 09-12 Where the places lead (legacy screens, restaged in UI3) -----------------------
    const places = ['parchemins', 'oracle', 'dossier', 'cabin'];
    for (let i = 0; i < places.length; i++) {
      await page.getByTestId(`camp-${places[i]}`).click();
      await expect(page).not.toHaveURL(/\/camp$/);
      await shot(page, project, `${String(9 + i).padStart(2, '0')}-place-${places[i]}`);
      await page.goBack();
      await expectCamp(page);
    }

    // ---- 13 Reduced motion ------------------------------------------------------------------
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.getByTestId('scene-camp')).toHaveAttribute('data-reduced-motion', 'true');
    await shot(page, project, '13-camp-reduced-motion');
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    // ---- 14 Hotspot editor --------------------------------------------------------------------
    await page.goto(`/?edit#/p/${profileId}/camp`);
    await expect(page.getByTestId('scene-editor')).toBeVisible();
    await shot(page, project, '14-hotspot-editor');

    // ---- 15-16 Laptop and ultra-wide framings ---------------------------------------------------
    await page.goto(`/#/p/${profileId}/camp`);
    await expectCamp(page);
    await dismissGreeting(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await shot(page, project, '15-laptop-1440x900');
    await page.setViewportSize({ width: 2560, height: 1080 });
    await shot(page, project, '16-ultrawide-2560x1080');
  }
});
```

- [ ] **Step 2: Run the walk**

Run: `scripts/playwright.sh --config playwright.playability.config.ts playability-ui1`
Expected: 2 passed (`ipad-landscape`, `ipad-portrait`); `ls docs/reviews/ui1` lists 17 PNGs (`ipad-landscape-01…16`, `ipad-portrait-01-rotate-screen.png`); the log's `NOTES` blocks show `request origins` containing only `http://app:8080` and `fonts loaded` all `true`.

- [ ] **Step 3: Look at the screenshots**

Open each PNG (Read tool). Check: the hub fills the screen with no white margins; every place label is readable and none is clipped by the screen edge on the iPad crop; the HUD does not cover a place; the dialogue box does not cover a place; the rotate screen is centred; Cinzel shows on labels and plaque. Fix any layout defect in code (then re-run Step 2) before committing. Paste the NOTES block into your report.

- [ ] **Step 4: Run the full gate**

Run: `scripts/check.sh`
Expected: ends with `== ALL GREEN`.

- [ ] **Step 5: Commit**

```bash
P="web/e2e/playability-ui1.spec.ts docs/reviews/ui1"
git add $P && git commit -m "UI1: playability walk and iPad screenshots for the review

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $P
```

---

## Self-review

**Spec coverage (UI1 scope, §2, §4, §6, §9, §10):**

| Requirement | Task |
|---|---|
| Fonts Cinzel/Alegreya/Literata, woff2, OFL, latin + latin-ext, no runtime Google Fonts (§2.7) | 1 |
| UI kit: parchment, bronze, marble plaque, laurel XP bar, CSS first (§6) | 2 |
| Scene data typed: background, layers (x/y/scale/depth/idle), hotspots (polygon/ellipse, label, route, locked/new/badge, visibility predicate), ambience, narrator keys (§4) | 3, 4 |
| `SceneStage`, `SceneLayer`, `FxCanvas`, `SceneTransition`, `RotateScreen` (§4) | 5 |
| `Hotspot` (real button, glow + bob, flash, label, focusable, test ids), `Overlay` (scroll/codex/table), `DialogueBox` (portrait, typewriter, tap/skip) (§4) | 6 |
| `Hud` (hero, XP laurel, dragon mini-portrait, audio quick toggle) (§4) | 7 |
| 16:9 cover stage, 4:3 safe zone, portrait rotate, standalone black-translucent, safe-area insets (§4) | 3, 5, 7 |
| Parallax ≤ 3 depths, pointer; reduced motion: no parallax, no bob, fades only (§4) | 3, 5, 6, 8 |
| `?edit` hotspot editor, copy TS/JSON, hidden without flag (§4) | 9 |
| Scene weight budget ≤ 600 KB test; preload next scenes (§4) | 4, 5 |
| Camp as hub scene on existing art, hotspots to unchanged screens, routing unchanged, every overlay routed (§2.3, §3, §9.1) | 4, 7 |
| GSAP only if used (§2.1) | Ruling 2 (not used) |
| WebKit iPad landscape 1180×820 project + desktop; hotspots reachable, Back, portrait, reduced motion (§10) | 8 |
| Existing tests green, old camp e2e migrated (§10) | 7, 8, 10 |
| iPad-size screenshots for the playability review (§10) | 10 |
| `scripts/check.sh` ALL GREEN (§10) | 10 |

Out of UI1 by the spec: battle compact mode (UI4), Howler/audio channels and dialogue content (UI5), device tilt (Ruling 7 → UI3), other places as scenes (UI3).

**Placeholder scan:** no TBD/TODO; every code step carries full code; the only "edit these lines" step (Task 7 Step 2) gives exact before/after per line.

**Type consistency:** `HotspotState` fields (`visible, locked, isNew, badge, caption`) are the same in Tasks 3, 4, 6, 7; the Hotspot prop is `status` (Tasks 6, 7); `SceneLayerDef.y` is the bottom edge in Tasks 3, 4, 5; `useSceneRuntime` / `createSceneRuntime` / `provideSceneRuntime` (Task 5) are used in Tasks 6 and 9; `shapesToTs('camp', CAMP_SHAPES)` (Task 9) matches the literal file of Task 4, pinned by a test; test ids `scene-camp`, `camp-*`, `hud-*`, `overlay-heros`, `overlay-close`, `dialogue-*`, `rotate-screen`, `fx-canvas`, `camp-dragon-layer`, `scene-editor`, `editor-*` are identical between the components and Tasks 7–10.
