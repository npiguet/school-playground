# La Discorde — The living dragon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the nest and on the camp, the hatchling, young, adult, illustre and ancestral dragons move slowly and slightly (head, wings, tail, breath, on non-repeating periods, feet still), with their worn pieces riding along as rigid passengers and the tint exactly as today; the egg, reduced motion, no WebGL2, a lost context or a failed shader keep today's still picture.

**Architecture:** The spike's WebGL2 mesh skinning is ported into pure TypeScript modules under `web/src/lib/living/` (tint matrices, bone maths, mesh and weights, rigs, piece atlas: all unit-tested in node) plus one GL class (`renderer.ts`) and one Svelte 5 component (`components/LivingDragon.svelte`) that `DragonFigure` mounts in place of its base `<img>` when the scene layer asks for it. Rigs are hand-authored in `tools/art/rig.json` and baked by `tools/art/rig.py` (numpy/scipy/Pillow in the art tools' throwaway container) into per-vertex weights the game imports lazily (`web/src/lib/living/rig/dragon_<stage>.json`). A dev-only lab page (`web/lab.html`, its own Vite config, never shipped) shows every stage live for the rig review; e2e runs the canvas checks on a new Chromium project with SwiftShader WebGL2, while the WebKit projects keep passing whichever form their browser gets.

**Tech Stack:** Svelte 5 (runes) + TypeScript + Vite 7, vitest 5 (node env, no DOM, no WebGL: the GL class and the component are proven by e2e only), Playwright 1.63 (WebKit `desktop` and `ipad`, Chromium), WebGL2 (GLSL ES 3.00), Python 3.12 + numpy 2.5.3 + scipy 1.18.1 + Pillow 12.3.0 (already pinned in `tools/art/run_docker.sh`). No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-02-living-dragon-design.md` (binding). The proven spike (throwaway, ported not copied): `C:\Users\nicol\.claude\jobs\9ac9a508\tmp\spike-living` (`FINDINGS.md`, `index.html`, `rig.json`, `tools/make_weights.py`, `tools/check.py`). Repo-root `CLAUDE.md` is binding for every agent.

## Global Constraints

- Amplitude: **1.5x the spike's 1x** (head about 2.25 + 0.75 deg, wings about 2.4-2.7 deg, tail about 3.6 + 0.9 deg, chest +2.4 % wide / +1.2 % tall, lift 3.6 px on the 1024 frame). The default lives in one constant, `AMPLITUDE = 1.5` (`web/src/lib/living/pose.ts`).
- Technique: one canvas per dragon, WebGL2, a 64x64 grid mesh with a 3.5 % margin over the 1024 frame, six bones (head, wingL, wingR, tail: rotations about pivots; chest: scale; lift: vertical translation), linear-blend skinning in the vertex shader; alpha below about 4 % dropped (`smoothstep(0.02, 0.05, a)`).
- The feet never move: every mesh vertex inside a stage's feet box has weight 0 for all six bones.
- **The ancestral's horn tip takes the head's weight** (it lags in the spike).
- The worn pieces are rigid passengers (dragon weights at the piece's anchor), drawn in `DRAW_ORDER` (`queue`, `dos`, `cou`, `tete`), never tinted, never stretched (the saddle included).
- The tint looks exactly as today: `TINT_FILTERS` (`web/src/lib/world/dragon.ts`) stays the single source; its CSS functions become colour matrices in the fragment shader, on the dragon texture only.
- The egg, reduced motion, no WebGL2, a lost context, a failed shader: today's still picture (`DragonFigure`'s markup: `img.dragon-base` + `img.dragon-overlay`), unchanged.
- `LivingDragon` keeps the box, sizing and `.dragon-figure` wrapper (mood animations still apply); `role="img"`, the alt as `aria-label`; the worn pieces listed in a data attribute (`data-worn`) for tests.
- The battle combatants (`Combatant.svelte`, `BattleStage.svelte`), the victory's and the camp reveal's `Dragon.svelte`, and the HUD's portrait keep their still picture. The camp dragon's size does not change.
- Cost control: the loop stops when the page is hidden or the canvas is off-screen, and draws at most 30 frames a second.
- Out of scope: big flaps, a true head turn, the battle combatants, the camp dragon's size.
- `CLAUDE.md`: no "pre-existing" problems (fix or report as an open item, never dismiss); vitest and `svelte-check` (plus the e2e `tsc`) clean with **zero errors and zero warnings**; **no emoji** anywhere the player can see (the lab page included).
- Commands (Git Bash, from the worktree root `C:\Users\nicol\IdeaProjects\school-playground\.claude\worktrees\art-skills`): `STACK=living scripts/npm.sh run test`, `STACK=living scripts/npm.sh run check`, e2e `PW_WORKERS=1 STACK=living scripts/playwright.sh <spec names>` (one run per stack; the Playwright lock is machine-wide; the machine is low on RAM: never two e2e runs at once). Long runs log to `/c/Users/nicol/.claude/jobs/9ac9a508/tmp/<name>.log`.
- Never push, never open a PR. Commit messages follow the repo's style (one descriptive sentence or more, what and why) and end with the attribution trailer the session's system reminder gives.

## Review Focus

1. **A tint or a piece changed while the dragon is on screen** (the care panel open over the nest, a refused change reverting): the canvas updates in place (no remount, no flash to the still picture), `data-filter`/`data-worn` follow, the dragon keeps living. Pinned by `living-dragon.spec.ts` "a tint picked in the care panel..." and "a piece put on in the care panel..." (Task 8).
2. **Reduced motion toggled live** (the OS switch, no reload): the canvas goes, the still picture comes, and back, with exactly one `.dragon-base` at any time (no strict-mode double match, no leaked context). Pinned by "reduced motion switched on and off..." (Task 8).
3. **A lost WebGL context or a shader that fails to compile** (an iPad under memory pressure, a driver bug): the still picture appears, never a blank box. Pinned by "a lost context..." and "a shader that fails..." (Task 8).
4. **Many visits** (camp to nest and back twenty times in one session): every mount releases its context, so the browser never hits its live-context cap ("Too many active WebGL contexts") and the dragon still lives at the end. Pinned by "twenty visits..." (Task 8).
5. **The page hidden or the dragon off-screen** (another app over Safari, a scrolled view): no frame drawn while it is, frames again when it is back, never more than 30 a second. Pinned by "the loop stops when hidden or off-screen..." (Task 8).

---

## Rulings on the spec's open points

- **R1 Weights format.** The spec allows one RGBA PNG or per-vertex weights, whichever is smaller: per-vertex weights win (65 x 65 vertices x 6 bones = 25 350 bytes, against about 120 KB for one PNG). They ship as base64 inside `web/src/lib/living/rig/dragon_<stage>.json` (with the pivots and the feet box), imported lazily (`import.meta.glob`, one chunk per stage), not under `web/public/art` (the README size test requires that folder to be all WebP) and never decoded through a canvas (no colour management can touch the bytes).
- **R2 Rigid pieces.** The pieces are composited into a second texture, a 1024 atlas of four 512 px cells (one piece per slot, at most four); each piece is drawn as its own quad, in `DRAW_ORDER`, after the dragon, skinned with one uniform weight vector: the dragon's per-vertex weights interpolated at the piece's **anchor = the centre of its manifest box**. Every manifest crop fits a cell (largest: about 253 px), and a unit test guards it.
- **R3 Loading.** While the rig, sprite and pieces load, `DragonFigure` shows its still markup and the living canvas waits hidden; the first drawn frame swaps them (`data-motion` on `.dragon-figure`: `pending`, `living` or `still`). The class `dragon-base` sits on exactly one element at a time: the `<img>` until the swap, the living wrapper after it.
- **R4 Failure is final for a mount.** No WebGL2, a shader or link error, a rig/sprite/piece that fails to load, a tint the matrices cannot express, a lost context: the still picture, for the life of that mount (no context restore). A new stage or reduced motion lifted mounts a fresh try.
- **R5 Reduced motion** comes from the scene runtime (`useSceneRuntime().reduced`, live with the OS switch): `SceneLayer` passes no living stage under it.
- **R6 Pin and feet.** A rig's pin is a rectangle with a blur; its feet box is the rectangle inset by 3 x blur on the top and both sides (snapped inward to the 16 px vertex grid), down to the frame's bottom; the baker hard-zeroes every weight there. The hatchling, whose tail is hidden in its shell, has no tail region (zero tail weight); its pin is the shell.
- **R7 Tooling.** The baker and its debug helpers go into a sibling skill, `.claude/skills/dragon-rig/SKILL.md` (art-overlays is about painting pieces; it gets a one-line pointer). `tools/art/rig.py` runs in the art tools' container: `tools/art/run_docker.sh rig <grid|bake|debug|sheet>`. Its scratch output (`tools/art/rig-out/`) is gitignored; the five debug views are kept as one sheet, `docs/art/dragon-rig.png`.
- **R8 Live review.** The spike-style page is ported as a dev-only lab (`web/lab.html` + `web/src/lab/`), built by `web/vite.lab.config.ts` into the gitignored `web/dist-lab/` and served with the host's `python -m http.server`; the game's own build never includes it.
- **R9 e2e browsers.** The canvas checks run on a new Playwright project, `chromium-gl` (Desktop Chrome, SwiftShader WebGL2, `living-dragon.spec.ts` only). The WebKit projects (`desktop`, `ipad`) may or may not have WebGL2: their specs read the dragon through helpers that accept either form, and one test asserts that what they show matches what the browser offers (living exactly when WebGL2 is there).

## File structure

| File | Responsibility |
|---|---|
| `web/src/lib/living/tint.ts` (+ `tint.test.ts`) | CSS filter string to two column-major 3x3 colour matrices; the CPU reference of the shader's tint |
| `web/src/lib/living/skin.ts` (+ `skin.test.ts`) | Frame/grid constants, bone order, 2D affine maps, CPU skinning, per-vertex weight lookup, the mesh buffers |
| `web/src/lib/living/pose.ts` (+ `pose.test.ts`) | `AMPLITUDE`, the idle motion `poseAt(t)`, the 30 fps gate `frameDue` |
| `web/src/lib/living/rigs.ts` (+ `rigs.test.ts`) | Living stages, the `Motion` type, rig file decoding, lazy loading, `livingStage()` |
| `web/src/lib/living/rig/dragon_<stage>.json` | Baked by `tools/art/rig.py`; never edited by hand |
| `web/src/lib/living/atlas.ts` (+ `atlas.test.ts`) | Piece placement in the atlas, the anchor weights (rigid pieces), the atlas canvas |
| `web/src/lib/living/renderer.ts` | The WebGL2 class (programs, buffers, textures, draw, dispose); no unit test (no GL in node) |
| `web/src/components/LivingDragon.svelte` | One canvas: loading, the loop, visibility, live tint/pieces, failure to still |
| `web/src/components/DragonFigure.svelte` | Mounts `LivingDragon` when given a `living` stage; keeps today's markup otherwise and as the fallback |
| `web/src/components/scene/SceneLayer.svelte`, `screens/Nest.svelte`, `screens/Camp.svelte` | Pass the living stage (none under reduced motion, none for the egg) |
| `web/lab.html`, `web/src/lab/main.ts`, `web/src/lab/DragonLab.svelte`, `web/vite.lab.config.ts` | The dev-only lab |
| `tools/art/rig.json`, `tools/art/rig.py`, `tools/art/run_docker.sh` | Rig source, baker, its runner |
| `.claude/skills/dragon-rig/SKILL.md` | How to author, bake and check a rig |
| `web/e2e/dragon.ts` | e2e helpers: the dragon's settled form, its src/filter/worn either way, screenshot comparison |
| `web/e2e/living-dragon.spec.ts` | The canvas e2e (chromium-gl) |
| `web/playwright.config.ts` | The `chromium-gl` project; `desktop` ignores `living-dragon.spec.ts` |

## Tasks

| # | Task | Recommended model | Why |
|---|---|---|---|
| 1 | Tint matrices | sonnet | Pure maths, fully specified |
| 2 | Bone maths, skinning, mesh, idle pose, 30 fps gate | sonnet | Pure maths, fully specified |
| 3 | Rig baker, the adult and ancestral rigs (horn tip fixed), rig loading, the dragon-rig skill | opus | Python port plus a cross-language hash and an eye check |
| 4 | Piece atlas and the WebGL2 renderer | opus | GL code no unit test can prove; read against the spike |
| 5 | `LivingDragon` and the dev lab | opus | Lifecycle, loop, failure paths; first live run |
| 6 | Rigs for the hatchling, the young and the illustre; debug overlays; **STOP: the user sees each stage live** | opus | Hand authoring by eye |
| 7 | The nest and the camp come alive; existing e2e adapted; README | opus | Touches five specs on two browsers |
| 8 | The canvas e2e on Chromium with WebGL2 | opus | Pixel comparisons, failure injection |
| 9 | Full gate and **STOP: the human look in the browser** | sonnet | Runs and reports |

---

### Task 1: Tint matrices

**Files:**
- Create: `web/src/lib/living/tint.ts`
- Test: `web/src/lib/living/tint.test.ts`

**Interfaces:**
- Consumes: `TINT_FILTERS: Record<Tint, string>` from `web/src/lib/world/dragon.ts`.
- Produces: `type Mat3` (9 numbers), `IDENTITY: Mat3`, `filterStep(fn: string, value: number): Mat3` (row-major), `parseFilter(css: string): { fn: string; value: number }[]`, `filterMatrices(css: string): [Mat3, Mat3]` (column-major, for `uniformMatrix3fv(loc, false, m)`; throws on anything it cannot express), `applyTint(ms: [Mat3, Mat3], rgb: readonly [number, number, number]): [number, number, number]` (the shader's tint on one colour, 0..1, clamped after each step).

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/living/tint.test.ts
// The living dragon's tint (spec 2026-10-02 living dragon, "Tint"): TINT_FILTERS stay the single source;
// their CSS functions become the Filter Effects colour matrices the fragment shader applies. The
// browser's own CSS filter is the reference for the pixels: living-dragon.spec.ts compares the canvas
// with the still picture under the same tint.
import { describe, expect, it } from 'vitest';
import { TINT_FILTERS } from '../world/dragon';
import { IDENTITY, applyTint, filterMatrices, filterStep, parseFilter, type Mat3 } from './tint';

const close = (a: readonly number[], b: readonly number[], eps = 1e-9) => a.forEach((v, i) => expect(Math.abs(v - b[i]), `index ${i}`).toBeLessThan(eps));
const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

describe('tint matrices', () => {
  it('reads « none » as no tint at all', () => {
    expect(filterMatrices('none')).toEqual([IDENTITY, IDENTITY]);
  });

  it('expresses every dragon tint in at most two steps', () => {
    for (const [tint, css] of Object.entries(TINT_FILTERS)) expect(() => filterMatrices(css), tint).not.toThrow();
  });

  it('keeps the neutral steps neutral', () => {
    close(filterStep('saturate', 1), IDENTITY);
    close(filterStep('hue-rotate', 0), IDENTITY);
    close(filterStep('hue-rotate', 360), IDENTITY);
    close(filterStep('brightness', 1), IDENTITY);
  });

  it('uses the Filter Effects coefficients (hue-rotate(180deg) as the spec writes it)', () => {
    close(filterStep('hue-rotate', 180), [-0.574, 1.43, 0.144, 0.426, 0.43, 0.144, 0.426, 1.43, -0.856], 1e-12);
    close(filterStep('saturate', 0), [0.213, 0.715, 0.072, 0.213, 0.715, 0.072, 0.213, 0.715, 0.072], 1e-12);
  });

  it('hands the shader column-major matrices', () => {
    const [a] = filterMatrices('hue-rotate(90deg)');
    close(a, transpose(filterStep('hue-rotate', 90)));
  });

  it('keeps a grey grey under a hue rotation or a desaturation (rows sum to one)', () => {
    for (const css of [TINT_FILTERS.ecume, TINT_FILTERS.olivier, TINT_FILTERS.jade, TINT_FILTERS.braise]) {
      close(applyTint(filterMatrices(css), [0.5, 0.5, 0.5]), [0.5, 0.5, 0.5], 1e-9);
    }
  });

  it('turns the bronze swatch to a lighter grey under argent, clamping as CSS does', () => {
    // #b8863b: luminance 0.213 R + 0.715 G + 0.072 B = 0.546078, times 1.15.
    close(applyTint(filterMatrices(TINT_FILTERS.argent), [184 / 255, 134 / 255, 59 / 255]), [0.62799, 0.62799, 0.62799], 1e-4);
    close(applyTint(filterMatrices('brightness(3)'), [0.5, 0.2, 0.9]), [1, 0.6, 1], 1e-9);
  });

  it('reads percentages as fractions', () => {
    expect(parseFilter('saturate(90%)')).toEqual([{ fn: 'saturate', value: 0.9 }]);
    expect(parseFilter(' hue-rotate(-25deg)  saturate(1.3) ')).toEqual([
      { fn: 'hue-rotate', value: -25 },
      { fn: 'saturate', value: 1.3 },
    ]);
  });

  it('refuses what the shader cannot do (the dragon then keeps its still picture)', () => {
    for (const css of ['blur(2px)', 'grayscale(1)', 'hue-rotate(10rad)', 'hue-rotate(10deg) saturate(1) brightness(1)', 'saturate(', 'saturate(1) junk']) {
      expect(() => filterMatrices(css), css).toThrow();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `STACK=living scripts/npm.sh run test -- src/lib/living/tint.test.ts`
Expected: FAIL, `Failed to resolve import "./tint"`.

- [ ] **Step 3: Write the implementation**

```ts
// web/src/lib/living/tint.ts
// The living dragon's tint (spec 2026-10-02 living dragon, "Tint"). TINT_FILTERS (world/dragon.ts) stay
// the single source: their CSS functions are turned into the Filter Effects 1 colour matrices
// (hue-rotate, saturate; brightness is a plain scale), applied in order with a clamp between steps as
// the CSS chain is, by the fragment shader on the dragon's texture only (never on its pieces). The
// spike measured the result against Chrome's own ctx.filter: mean error 0.25-0.54/255, at most 2/255.
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];
export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** One step's matrix, row-major, as the Filter Effects spec writes it. */
export function filterStep(fn: string, value: number): Mat3 {
  switch (fn) {
    case 'hue-rotate': {
      const a = (value * Math.PI) / 180;
      const c = Math.cos(a);
      const s = Math.sin(a);
      return [
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
      ];
    }
    case 'saturate':
      return [
        0.213 + 0.787 * value, 0.715 - 0.715 * value, 0.072 - 0.072 * value,
        0.213 - 0.213 * value, 0.715 + 0.285 * value, 0.072 - 0.072 * value,
        0.213 - 0.213 * value, 0.715 - 0.715 * value, 0.072 + 0.928 * value,
      ];
    case 'brightness':
      return [value, 0, 0, 0, value, 0, 0, 0, value];
    default:
      throw new Error(`unsupported filter function: ${fn}`);
  }
}

const STEP = /([a-z-]+)\(\s*([-+]?(?:\d+\.?\d*|\.\d+))(deg|%)?\s*\)/y;

/** The steps of a CSS filter string; throws on anything else than `fn(number[unit])` steps. */
export function parseFilter(css: string): { fn: string; value: number }[] {
  const s = css.trim();
  if (s === '' || s === 'none') return [];
  const out: { fn: string; value: number }[] = [];
  let i = 0;
  while (i < s.length) {
    while (s[i] === ' ') i++;
    if (i >= s.length) break;
    STEP.lastIndex = i;
    const m = STEP.exec(s);
    if (!m) throw new Error(`cannot read the filter « ${css} »`);
    const [, fn, num, unit] = m;
    let value = Number(num);
    if (fn === 'hue-rotate') {
      if (unit !== 'deg' && !(unit === undefined && value === 0)) throw new Error(`hue-rotate needs degrees: « ${css} »`);
    } else {
      if (unit === 'deg') throw new Error(`${fn} takes no angle: « ${css} »`);
      if (unit === '%') value /= 100;
    }
    out.push({ fn, value });
    i = STEP.lastIndex;
  }
  return out;
}

const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

/** The shader's two tint steps, column-major (GLSL mat3); identity for a missing step. */
export function filterMatrices(css: string): [Mat3, Mat3] {
  const steps = parseFilter(css).map(({ fn, value }) => transpose(filterStep(fn, value)));
  if (steps.length > 2) throw new Error(`at most two filter steps: « ${css} »`);
  while (steps.length < 2) steps.push(IDENTITY);
  return [steps[0], steps[1]];
}

/** The fragment shader's tint on one colour (0..1), clamped after each step. */
export function applyTint([a, b]: [Mat3, Mat3], rgb: readonly [number, number, number]): [number, number, number] {
  const mul = (m: Mat3, v: readonly number[]): [number, number, number] =>
    [0, 1, 2].map((r) => Math.min(1, Math.max(0, m[r] * v[0] + m[3 + r] * v[1] + m[6 + r] * v[2]))) as [number, number, number];
  return mul(b, mul(a, rgb));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `STACK=living scripts/npm.sh run test -- src/lib/living/tint.test.ts` then `STACK=living scripts/npm.sh run check`
Expected: all tint tests PASS; svelte-check and the e2e tsc: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/living/tint.ts web/src/lib/living/tint.test.ts
git commit -m "Living dragon, tint: TINT_FILTERS' CSS functions become the Filter Effects colour matrices the shader will apply (two steps, clamped between them as the CSS chain is, column-major for GLSL); anything they cannot express throws so the dragon keeps its still picture"
```

---

### Task 2: Bone maths, skinning, mesh, idle pose, 30 fps gate

**Files:**
- Create: `web/src/lib/living/skin.ts`, `web/src/lib/living/pose.ts`
- Test: `web/src/lib/living/skin.test.ts`, `web/src/lib/living/pose.test.ts`

**Interfaces:**
- Produces (`skin.ts`): `FRAME = 1024`, `GRID = 64`, `VERTS = 65`, `CELL = 16`, `MARGIN = 0.035`, `BONES = ['head', 'wingL', 'wingR', 'tail', 'chest', 'lift'] as const`, `type Bone`, `type Point = readonly [number, number]`, `type Affine` (9 numbers, column-major), `rotAbout(p: Point, a: number): Affine`, `scaleAbout(p: Point, sx: number, sy: number): Affine`, `translate(dx: number, dy: number): Affine`, `skinPoint(p: Point, w: ArrayLike<number>, bones: Float32Array): [number, number]`, `weightsAt(weights: Uint8Array, x: number, y: number): Float32Array` (6 bones, bilinear over the vertex grid, frame px), `buildMesh(weights: Uint8Array): Mesh` with `interface Mesh { pos: Float32Array; uv: Float32Array; w0: Float32Array; w1: Float32Array; indices: Uint16Array }`.
- Produces (`pose.ts`): `AMPLITUDE = 1.5`, `type Pivots = Record<Bone, Point>`, `poseAt(t: number, pivots: Pivots, amplitude?: number): Float32Array` (54 floats, six column-major mat3 in `BONES` order), `FPS = 30`, `frameDue(now: number, last: number | null, fps?: number): boolean`.
- Weights layout (shared with Task 3's baker): `weights[(j * VERTS + i) * 6 + b]`, vertex `(i, j)` at frame px `(i * CELL, j * CELL)`, bone `b` in `BONES` order, 0..255 for 0..1.

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/lib/living/skin.test.ts
import { describe, expect, it } from 'vitest';
import { BONES, CELL, FRAME, GRID, VERTS, buildMesh, rotAbout, scaleAbout, skinPoint, translate, weightsAt, type Affine } from './skin';

const apply = (m: Affine, [x, y]: readonly [number, number]) => [m[0] * x + m[3] * y + m[6], m[1] * x + m[4] * y + m[7]];
const bonesOf = (...ms: Affine[]) => Float32Array.from(ms.flat());
const I = translate(0, 0);
const patterned = () => Uint8Array.from({ length: VERTS * VERTS * BONES.length }, (_, n) => n % 251);

describe('bones and skinning', () => {
  it('turns about the pivot, which stays put', () => {
    expect(apply(rotAbout([630, 480], 0.3), [630, 480]).map((v) => +v.toFixed(9))).toEqual([630, 480]);
    expect(apply(scaleAbout([640, 620], 1.1, 0.9), [640, 620]).map((v) => +v.toFixed(9))).toEqual([640, 620]);
    expect(apply(translate(0, -3.6), [10, 20])).toEqual([10, 16.4]);
  });

  it('leaves a point with no weight where it is', () => {
    const bones = bonesOf(rotAbout([0, 0], 1), I, I, I, I, translate(5, 5));
    expect(skinPoint([100, 200], [0, 0, 0, 0, 0, 0], bones)).toEqual([100, 200]);
  });

  it('moves a fully weighted point with its bone, half weighted halfway (the rest bone is implicit)', () => {
    const head = rotAbout([500, 500], 0.1);
    const bones = bonesOf(head, I, I, I, I, I);
    const full = skinPoint([600, 300], [1, 0, 0, 0, 0, 0], bones);
    const [hx, hy] = apply(head, [600, 300]);
    expect(full[0]).toBeCloseTo(hx, 3);
    expect(full[1]).toBeCloseTo(hy, 3);
    const half = skinPoint([600, 300], [0.5, 0, 0, 0, 0, 0], bones);
    expect(half[0]).toBeCloseTo((600 + hx) / 2, 3);
    expect(half[1]).toBeCloseTo((300 + hy) / 2, 3);
  });
});

describe('the vertex grid', () => {
  it('reads a vertex weight exactly and interpolates between vertices', () => {
    const w = patterned();
    const at = (i: number, j: number, b: number) => w[(j * VERTS + i) * BONES.length + b] / 255;
    expect(weightsAt(w, 3 * CELL, 5 * CELL)[2]).toBeCloseTo(at(3, 5, 2), 6);
    expect(weightsAt(w, 3.5 * CELL, 5 * CELL)[2]).toBeCloseTo((at(3, 5, 2) + at(4, 5, 2)) / 2, 6);
    expect(weightsAt(w, FRAME, FRAME)[5]).toBeCloseTo(at(GRID, GRID, 5), 6);
    expect(weightsAt(w, -40, 2000)[0]).toBeCloseTo(at(0, GRID, 0), 6);
  });

  it('builds 65 x 65 vertices over the frame, 8192 triangles, and carries each vertex weights', () => {
    const w = patterned();
    const m = buildMesh(w);
    expect(m.pos.length).toBe(VERTS * VERTS * 2);
    expect(m.indices.length).toBe(GRID * GRID * 6);
    expect(Math.max(...m.indices)).toBe(VERTS * VERTS - 1);
    expect([m.pos[0], m.pos[1], m.uv[0], m.uv[1]]).toEqual([0, 0, 0, 0]);
    const last = VERTS * VERTS - 1;
    expect([m.pos[2 * last], m.pos[2 * last + 1], m.uv[2 * last], m.uv[2 * last + 1]]).toEqual([FRAME, FRAME, 1, 1]);
    const k = 7 * VERTS + 9;
    expect(m.w0[4 * k + 3]).toBeCloseTo(w[k * 6 + 3] / 255, 6);
    expect(m.w1[2 * k + 1]).toBeCloseTo(w[k * 6 + 5] / 255, 6);
  });
});
```

```ts
// web/src/lib/living/pose.test.ts
import { describe, expect, it } from 'vitest';
import { AMPLITUDE, frameDue, poseAt, type Pivots } from './pose';

const PIVOTS: Pivots = { head: [630, 480], wingL: [520, 525], wingR: [715, 335], tail: [330, 610], chest: [640, 620], lift: [640, 900] };
const DEG = 180 / Math.PI;
const angle = (p: Float32Array, bone: number) => Math.atan2(p[bone * 9 + 1], p[bone * 9]) * DEG;

function peaks(amplitude: number) {
  const out = { head: 0, wingL: 0, wingR: 0, tail: 0, chestX: 0, chestY: 0, lift: 0 };
  for (let t = 0; t < 120; t += 0.005) {
    const p = poseAt(t, PIVOTS, amplitude);
    out.head = Math.max(out.head, Math.abs(angle(p, 0)));
    out.wingL = Math.max(out.wingL, Math.abs(angle(p, 1)));
    out.wingR = Math.max(out.wingR, Math.abs(angle(p, 2)));
    out.tail = Math.max(out.tail, Math.abs(angle(p, 3)));
    out.chestX = Math.max(out.chestX, p[4 * 9] - 1);
    out.chestY = Math.max(out.chestY, p[4 * 9 + 4] - 1);
    out.lift = Math.max(out.lift, Math.abs(p[5 * 9 + 7]));
  }
  return out;
}

describe('the idle motion', () => {
  it('defaults to 1.5 times the spike', () => {
    expect(AMPLITUDE).toBe(1.5);
    expect(poseAt(2.3, PIVOTS)).toEqual(poseAt(2.3, PIVOTS, 1.5));
  });

  it('moves as far as the spec says at 1.5x, and no further', () => {
    const p = peaks(AMPLITUDE);
    expect(p.head).toBeLessThanOrEqual(3.0 + 1e-6); // 2.25 + 0.75 deg
    expect(p.head).toBeGreaterThan(2.7);
    expect(p.wingL).toBeCloseTo(2.7, 2);
    expect(p.wingR).toBeCloseTo(2.4, 2);
    expect(p.tail).toBeLessThanOrEqual(4.5 + 1e-6); // 3.6 + 0.9 deg
    expect(p.tail).toBeGreaterThan(4.0);
    expect(p.chestX).toBeCloseTo(0.024, 3);
    expect(p.chestY).toBeCloseTo(0.012, 3);
    expect(p.lift).toBeCloseTo(3.6, 2);
  });

  it('stands still at amplitude 0', () => {
    const p = poseAt(7.7, PIVOTS, 0);
    for (let b = 0; b < 6; b++) expect(Array.from(p.slice(b * 9, b * 9 + 9)).map((v) => Math.abs(v) < 1e-9 ? 0 : v)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('never repeats on the breath period (the parts are out of step)', () => {
    expect(angle(poseAt(1, PIVOTS), 0)).not.toBeCloseTo(angle(poseAt(1 + 4.8, PIVOTS), 0), 3);
  });
});

describe('the 30 fps gate', () => {
  it('draws the first frame, then one frame in two at 60 Hz', () => {
    expect(frameDue(1000, null)).toBe(true);
    expect(frameDue(1016.7, 1000)).toBe(false);
    expect(frameDue(1033.4, 1000)).toBe(true);
    expect(frameDue(1030, 1000)).toBe(true); // rAF jitter: up to 4 ms early still counts
    expect(frameDue(1020, 1000)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `STACK=living scripts/npm.sh run test -- src/lib/living/skin.test.ts src/lib/living/pose.test.ts`
Expected: FAIL, `Failed to resolve import "./skin"` and `"./pose"`.

- [ ] **Step 3: Write the implementation**

```ts
// web/src/lib/living/skin.ts
// The living dragon's mesh and bones (spec 2026-10-02 living dragon, "Technique"): a 64 x 64 grid over
// the 1024 px frame (3.5 % margin around it so wing tips may move out a little), six bones as 2D
// affine maps (y down), linear-blend skinning with an implicit rest bone: p + sum w_i (M_i p - p).
// The vertex shader (renderer.ts) does the same sum as skinPoint below; the weights are baked per
// vertex by tools/art/rig.py: weights[(j * VERTS + i) * 6 + b], vertex (i, j) at (i * CELL, j * CELL).
export const FRAME = 1024;
export const GRID = 64;
export const VERTS = GRID + 1;
export const CELL = FRAME / GRID;
export const MARGIN = 0.035;
export const BONES = ['head', 'wingL', 'wingR', 'tail', 'chest', 'lift'] as const;
export type Bone = (typeof BONES)[number];
export type Point = readonly [number, number];
/** A 2D affine map as a column-major mat3 (GLSL order): columns (a, b, 0), (c, d, 0), (tx, ty, 1). */
export type Affine = readonly [number, number, number, number, number, number, number, number, number];

export function rotAbout([cx, cy]: Point, a: number): Affine {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c, s, 0, -s, c, 0, cx - (c * cx - s * cy), cy - (s * cx + c * cy), 1];
}

export function scaleAbout([cx, cy]: Point, sx: number, sy: number): Affine {
  return [sx, 0, 0, 0, sy, 0, cx - sx * cx, cy - sy * cy, 1];
}

export function translate(dx: number, dy: number): Affine {
  return [1, 0, 0, 0, 1, 0, dx, dy, 1];
}

/** Where a frame point goes under the pose (`bones`: six column-major mat3, BONES order). */
export function skinPoint([x, y]: Point, w: ArrayLike<number>, bones: Float32Array): [number, number] {
  let dx = 0;
  let dy = 0;
  for (let b = 0; b < BONES.length; b++) {
    const m = b * 9;
    dx += w[b] * (bones[m] * x + bones[m + 3] * y + bones[m + 6] - x);
    dy += w[b] * (bones[m + 1] * x + bones[m + 4] * y + bones[m + 7] - y);
  }
  return [x + dx, y + dy];
}

/** The six bone weights (0..1) at a frame point, bilinear between the grid's vertices, clamped to it. */
export function weightsAt(weights: Uint8Array, x: number, y: number): Float32Array {
  const gx = Math.min(GRID, Math.max(0, x / CELL));
  const gy = Math.min(GRID, Math.max(0, y / CELL));
  const i0 = Math.min(GRID - 1, Math.floor(gx));
  const j0 = Math.min(GRID - 1, Math.floor(gy));
  const fx = gx - i0;
  const fy = gy - j0;
  const out = new Float32Array(BONES.length);
  for (let b = 0; b < BONES.length; b++) {
    const at = (i: number, j: number) => weights[(j * VERTS + i) * BONES.length + b] / 255;
    out[b] = (1 - fx) * (1 - fy) * at(i0, j0) + fx * (1 - fy) * at(i0 + 1, j0) + (1 - fx) * fy * at(i0, j0 + 1) + fx * fy * at(i0 + 1, j0 + 1);
  }
  return out;
}

export interface Mesh {
  /** Frame px, two per vertex. */
  pos: Float32Array;
  /** Texture coordinates, two per vertex. */
  uv: Float32Array;
  /** head, wingL, wingR, tail. */
  w0: Float32Array;
  /** chest, lift. */
  w1: Float32Array;
  indices: Uint16Array;
}

export function buildMesh(weights: Uint8Array): Mesh {
  const n = VERTS * VERTS;
  const pos = new Float32Array(n * 2);
  const uv = new Float32Array(n * 2);
  const w0 = new Float32Array(n * 4);
  const w1 = new Float32Array(n * 2);
  for (let j = 0; j < VERTS; j++) {
    for (let i = 0; i < VERTS; i++) {
      const k = j * VERTS + i;
      pos[2 * k] = i * CELL;
      pos[2 * k + 1] = j * CELL;
      uv[2 * k] = i / GRID;
      uv[2 * k + 1] = j / GRID;
      const o = k * BONES.length;
      for (let b = 0; b < 4; b++) w0[4 * k + b] = weights[o + b] / 255;
      w1[2 * k] = weights[o + 4] / 255;
      w1[2 * k + 1] = weights[o + 5] / 255;
    }
  }
  const indices = new Uint16Array(GRID * GRID * 6);
  let t = 0;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const a = j * VERTS + i;
      const b = a + 1;
      const c = a + VERTS;
      const d = c + 1;
      // The diagonal alternates, so the mesh has no directional bias.
      const quad = (i + j) & 1 ? [a, b, d, a, d, c] : [a, b, c, b, d, c];
      for (const v of quad) indices[t++] = v;
    }
  }
  return { pos, uv, w0, w1, indices };
}
```

```ts
// web/src/lib/living/pose.ts
// The living dragon's idle motion (spec 2026-10-02 living dragon, "What she sees"): breath 4.8 s; the
// wings follow it with a lag, left and right slightly apart; the head on its own 6.2 s sway with a
// 2.9 s nod; the tail on 3.7 s + 1.9 s. No common period on purpose: a beat that never quite repeats
// reads as alive rather than as a looping gif. The base values are the spike's 1x; the game plays
// them at AMPLITUDE (the user's choice, 1.5x).
import { BONES, rotAbout, scaleAbout, translate, type Affine, type Bone, type Point } from './skin';

export const AMPLITUDE = 1.5;
export type Pivots = Record<Bone, Point>;

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;

/** The six bones at time `t` (s): six column-major mat3 in BONES order. */
export function poseAt(t: number, pivots: Pivots, amplitude: number = AMPLITUDE): Float32Array {
  const a = amplitude;
  const breath = Math.sin((TAU * t) / 4.8);
  const m: Record<Bone, Affine> = {
    head: rotAbout(pivots.head, a * (1.5 * DEG * Math.sin((TAU * t) / 6.2 + 0.7) + 0.5 * DEG * Math.sin((TAU * t) / 2.9))),
    wingL: rotAbout(pivots.wingL, a * 1.8 * DEG * Math.sin((TAU * t) / 4.8 - 0.9)),
    wingR: rotAbout(pivots.wingR, -a * 1.6 * DEG * Math.sin((TAU * t) / 4.8 - 1.15)),
    tail: rotAbout(pivots.tail, a * (2.4 * DEG * Math.sin((TAU * t) / 3.7 + 1.3) + 0.6 * DEG * Math.sin((TAU * t) / 1.9))),
    chest: scaleAbout(pivots.chest, 1 + 0.016 * a * breath, 1 + 0.008 * a * breath),
    lift: translate(0, -2.4 * a * breath),
  };
  return Float32Array.from(BONES.flatMap((b) => m[b]));
}

export const FPS = 30;

/** Whether a frame is due at `now` (ms) after the last drawn at `last`, at `fps`; 4 ms of rAF jitter
 *  still counts, so a 60 Hz display draws one frame in two. */
export function frameDue(now: number, last: number | null, fps: number = FPS): boolean {
  return last === null || now - last >= 1000 / fps - 4;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `STACK=living scripts/npm.sh run test -- src/lib/living` then `STACK=living scripts/npm.sh run check`
Expected: all PASS; 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/living/skin.ts web/src/lib/living/skin.test.ts web/src/lib/living/pose.ts web/src/lib/living/pose.test.ts
git commit -m "Living dragon, bones: the 64 x 64 mesh over the 1024 frame, six bones as affine maps with the shader's skinning sum on the CPU, per-vertex weight lookup, the idle motion at 1.5x the spike (head 2.25 + 0.75 deg, wings 2.4-2.7, tail 3.6 + 0.9, chest +2.4/+1.2 %, lift 3.6 px) and the 30 fps gate"
```

---

### Task 3: Rig baker, the adult and ancestral rigs, rig loading, the dragon-rig skill

**Files:**
- Create: `tools/art/rig.json`, `tools/art/rig.py`, `web/src/lib/living/rigs.ts`, `web/src/lib/living/rigs.test.ts`, `.claude/skills/dragon-rig/SKILL.md`
- Generated (committed): `web/src/lib/living/rig/dragon_adult.json`, `web/src/lib/living/rig/dragon_ancestral.json`
- Modify: `tools/art/run_docker.sh` (a `rig` mode), `.gitignore` (`tools/art/rig-out/`), `.claude/skills/art-overlays/SKILL.md` (one pointer line)

**Interfaces:**
- Consumes: `BONES`, `GRID`, `VERTS`, `CELL`, `FRAME`, `weightsAt`, `type Bone`, `type Point` (Task 2, `skin.ts`); `type Pivots` (Task 2, `pose.ts`); `DragonStage` (`web/src/lib/world/types.ts`).
- Produces (`rigs.ts`): `LIVING_STAGES = ['hatchling', 'young', 'adult', 'illustre', 'ancestral'] as const`, `type LivingStage`, `type Motion = 'pending' | 'living' | 'still'`, `interface RigFile { stage: string; source: string; grid: number; pivots: Record<Bone, [number, number]>; feet: [number, number, number, number]; weights: string }`, `interface Rig { stage: LivingStage; pivots: Pivots; feet: readonly [number, number, number, number]; weights: Uint8Array }`, `decodeRig(f: RigFile): Rig`, `loadRig(stage: LivingStage): Promise<Rig>`, `livingStage(stage: DragonStage): LivingStage | null`.
- Rig file format (`tools/art/rig.json`, integers and booleans only): `{ "_doc": "...", <stage>: { "bones": { <bone>: { "pivot": [x, y], "poly"?: [[x, y], ...] | "ellipse"?: [cx, cy, rx, ry] | "all"?: true, "ramp"?: [y0, y1], "ramp_from_pivot"?: [r0, r1], "blur"?: px } }, "pin": { "rect": [x0, y0, x1, y1], "blur": px } } }`. A bone with no `poly`/`ellipse`/`all` has no weight. `ramp: [lo, hi]` is weight 0 at y = lo, 1 at y = hi; `ramp_from_pivot: [r0, r1]` is 0 within r0 of the pivot, 1 beyond r1.
- Baked file: `{ "stage", "source": sha256 hex, "grid": 64, "pivots", "feet": [x0, y0, x1, y1] (frame px, feet box, y1 = 1024), "weights": base64 of 25 350 bytes }`. `source` = sha256 of `json.dumps(block, sort_keys=True, separators=(',', ':'), ensure_ascii=False)` UTF-8, then `\n`, then the sprite file's bytes.
- CLI: `tools/art/run_docker.sh rig grid [--stage S]`, `rig bake [--stage S]`, `rig debug [--stage S]`, `rig sheet`; scratch output in `tools/art/rig-out/`.

- [ ] **Step 1: Write the rig source with the two proven stages**

`tools/art/rig.json` (the spike's adult and ancestral, pins as rectangles, lift as `"all": true`; **the ancestral's head polygon now reaches the frame's top edge from x 380 to x 700, so the tip of its right-hand horn, at about (606, 22), takes the head's weight**: the spike's polygon ran `[380,10],[520,10],[640,60]` and left the tip out):

```json
{
  "_doc": "The living dragon's rigs (the dragon-rig skill). 1024 px frame coordinates, y down, integers only. Per stage: six bones, each with its pivot and an optional region (poly, ellipse, or all: true), times an optional ramp (along y, or by distance from the pivot), pushed into the background and blurred by tools/art/rig.py; the pin rectangle keeps the feet still. Bake with tools/art/run_docker.sh rig bake; never edit web/src/lib/living/rig/*.json by hand.",
  "adult": {
    "bones": {
      "head":  { "pivot": [630, 480], "poly": [[410,40],[420,0],[600,0],[600,10],[720,100],[800,160],[800,250],[700,262],[660,285],[700,380],[745,440],[745,500],[540,500],[540,420],[505,330],[480,240]], "ramp": [500, 270], "blur": 14 },
      "wingL": { "pivot": [520, 525], "poly": [[0,560],[40,400],[150,250],[260,150],[370,95],[455,95],[475,160],[470,420],[520,470],[560,520],[540,565],[480,575],[400,555],[330,570],[250,555],[200,600],[150,700],[125,865],[60,845],[0,640]], "ramp_from_pivot": [40, 220], "blur": 10 },
      "wingR": { "pivot": [715, 335], "poly": [[688,300],[760,250],[850,170],[925,170],[955,350],[965,600],[935,700],[905,765],[880,700],[820,650],[762,625],[752,500],[748,440],[705,380],[676,322]], "ramp_from_pivot": [30, 180], "blur": 8 },
      "tail":  { "pivot": [330, 610], "poly": [[130,780],[140,700],[180,620],[250,570],[320,555],[345,600],[300,650],[272,720],[255,800],[245,860],[205,885],[150,860]], "ramp_from_pivot": [30, 230], "blur": 10 },
      "chest": { "pivot": [640, 620], "ellipse": [630, 600, 165, 230], "blur": 30 },
      "lift":  { "pivot": [640, 900], "all": true, "ramp": [905, 560], "blur": 0 }
    },
    "pin": { "rect": [200, 885, 830, 1024], "blur": 22 }
  },
  "ancestral": {
    "bones": {
      "head":  { "pivot": [650, 500], "poly": [[380,0],[700,0],[760,80],[800,150],[845,210],[835,270],[812,300],[822,400],[800,452],[740,462],[702,432],[700,485],[560,485],[528,400],[518,300],[528,200],[380,35]], "ramp": [520, 300], "blur": 12 },
      "wingL": { "pivot": [560, 500], "poly": [[0,720],[0,560],[110,330],[250,200],[400,125],[505,115],[522,160],[472,300],[432,420],[540,448],[582,500],[540,540],[470,540],[380,560],[330,585],[280,598],[220,640],[150,720],[120,910],[70,900],[0,780]], "ramp_from_pivot": [40, 230], "blur": 10 },
      "wingR": { "pivot": [850, 430], "poly": [[800,330],[840,250],[900,185],[950,160],[978,182],[942,250],[932,380],[880,398],[828,398]], "ramp_from_pivot": [20, 200], "blur": 8 },
      "tail":  { "pivot": [330, 620], "poly": [[118,830],[128,740],[170,668],[230,608],[300,578],[352,590],[330,640],[282,700],[252,780],[242,860],[222,905],[160,905],[128,872]], "ramp_from_pivot": [30, 230], "blur": 10 },
      "chest": { "pivot": [680, 610], "ellipse": [675, 600, 160, 220], "blur": 30 },
      "lift":  { "pivot": [650, 920], "all": true, "ramp": [915, 560], "blur": 0 }
    },
    "pin": { "rect": [220, 880, 860, 1024], "blur": 22 }
  }
}
```

- [ ] **Step 2: Write the failing rig tests**

```ts
// web/src/lib/living/rigs.test.ts
// The living dragon's rigs (spec 2026-10-02 living dragon, "Rigs", "Tests"): each authored rig is baked
// from the rig file and the sprite as they are now, its pinned feet get zero weight, its rigid bones
// never sum past one, and the ancestral's horn tip takes the head's weight.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BONES, CELL, FRAME, VERTS, weightsAt } from './skin';
import { decodeRig, livingStage, type RigFile } from './rigs';

const FILES = import.meta.glob<RigFile>('./rig/dragon_*.json', { eager: true, import: 'default' });
const SOURCE = JSON.parse(readFileSync('../tools/art/rig.json', 'utf-8')) as Record<string, { bones: Record<string, Record<string, unknown>>; pin: unknown }>;
const STAGES = Object.keys(SOURCE).filter((k) => !k.startsWith('_'));
const fileOf = (stage: string) => FILES[`./rig/dragon_${stage}.json`];
const rigOf = (stage: string) => decodeRig(fileOf(stage));
const HEAD = BONES.indexOf('head');

/** Python's json.dumps(sort_keys=True, separators=(',', ':')) for integers, booleans, strings, lists. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

function numbers(v: unknown, out: number[] = []): number[] {
  if (typeof v === 'number') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => numbers(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => numbers(x, out));
  return out;
}

describe('the rigs', () => {
  it('holds integers only (the bake hash reads the same in Python and here)', () => {
    expect(numbers(SOURCE).filter((n) => !Number.isInteger(n))).toEqual([]);
  });

  it.each(STAGES)('%s: baked from the rig and the sprite as they are now', (stage) => {
    const f = fileOf(stage);
    expect(f, `${stage}: run tools/art/run_docker.sh rig bake`).toBeDefined();
    const h = createHash('sha256').update(canonical(SOURCE[stage]), 'utf8').update('\n').update(readFileSync(`public/art/dragon/dragon_${stage}_cut.webp`));
    expect(f.source, `${stage}: the rig or the sprite changed since the bake (tools/art/run_docker.sh rig bake)`).toBe(h.digest('hex'));
    expect(f.stage).toBe(stage);
  });

  it.each(STAGES)('%s: every bone has its pivot inside the frame', (stage) => {
    const rig = rigOf(stage);
    for (const b of BONES) {
      const [x, y] = rig.pivots[b];
      expect(x >= 0 && x <= FRAME && y >= 0 && y <= FRAME, `${stage} ${b}`).toBe(true);
    }
  });

  it.each(STAGES)('%s: the feet get zero weight, in a box that reaches the bottom', (stage) => {
    const rig = rigOf(stage);
    const [x0, y0, x1, y1] = rig.feet;
    expect(y1).toBe(FRAME);
    expect(y1 - y0).toBeGreaterThanOrEqual(3 * CELL);
    expect(x1 - x0).toBeGreaterThanOrEqual(10 * CELL);
    for (let j = 0; j < VERTS; j++) {
      for (let i = 0; i < VERTS; i++) {
        const [x, y] = [i * CELL, j * CELL];
        if (x < x0 || x > x1 || y < y0) continue;
        const w = Array.from(rig.weights.slice((j * VERTS + i) * 6, (j * VERTS + i) * 6 + 6));
        expect(w, `${stage} vertex (${x}, ${y})`).toEqual([0, 0, 0, 0, 0, 0]);
      }
    }
  });

  it.each(STAGES)('%s: the rigid bones never sum past one; each region carries its bone', (stage) => {
    const rig = rigOf(stage);
    const max = new Array(6).fill(0);
    for (let k = 0; k < VERTS * VERTS; k++) {
      const w = rig.weights.slice(k * 6, k * 6 + 6);
      expect(w[0] + w[1] + w[2] + w[3], `${stage} vertex ${k}`).toBeLessThanOrEqual(255 + 2); // rounding of four bytes
      for (let b = 0; b < 6; b++) max[b] = Math.max(max[b], w[b]);
    }
    BONES.forEach((b, i) => {
      const spec = SOURCE[stage].bones[b];
      const painted = 'poly' in spec || 'ellipse' in spec || 'all' in spec;
      if (painted) expect(max[i], `${stage} ${b}`).toBeGreaterThanOrEqual(230);
      else expect(max[i], `${stage} ${b} has no region`).toBe(0);
    });
  });

  it("gives the ancestral's horn tip the head's weight (it lagged in the spike)", () => {
    expect(weightsAt(rigOf('ancestral').weights, 606, 22)[HEAD]).toBeGreaterThanOrEqual(0.9);
  });

  it('animates a stage only when its rig is baked, never the egg', () => {
    expect(livingStage('egg')).toBeNull();
    expect(livingStage('adult')).toBe('adult');
    expect(livingStage('ancestral')).toBe('ancestral');
  });

  it('refuses a rig file of the wrong size', () => {
    expect(() => decodeRig({ ...fileOf('adult'), weights: 'AAAA' })).toThrow();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `STACK=living scripts/npm.sh run test -- src/lib/living/rigs.test.ts`
Expected: FAIL, `Failed to resolve import "./rigs"`.

- [ ] **Step 4: Write the loader**

```ts
// web/src/lib/living/rigs.ts
// The living dragon's rigs (spec 2026-10-02 living dragon, "Rigs"; plan Ruling R1): the per-vertex
// weights tools/art/rig.py bakes from tools/art/rig.json, one lazily imported chunk per stage. A stage
// lives only once its rig is baked; the egg never does.
import type { DragonStage } from '../world/types';
import type { Pivots } from './pose';
import { BONES, GRID, VERTS, type Bone } from './skin';

export const LIVING_STAGES = ['hatchling', 'young', 'adult', 'illustre', 'ancestral'] as const;
export type LivingStage = (typeof LIVING_STAGES)[number];
/** DragonFigure's `data-motion`: loading (the still picture shows), living (the canvas), still. */
export type Motion = 'pending' | 'living' | 'still';

export interface RigFile {
  stage: string;
  source: string;
  grid: number;
  pivots: Record<Bone, [number, number]>;
  /** The feet box [x0, y0, x1, y1] in frame px: every vertex inside has zero weight. */
  feet: [number, number, number, number];
  /** base64 of VERTS x VERTS x 6 bytes. */
  weights: string;
}

export interface Rig {
  stage: LivingStage;
  pivots: Pivots;
  feet: readonly [number, number, number, number];
  weights: Uint8Array;
}

const FILES = import.meta.glob<RigFile>('./rig/dragon_*.json', { import: 'default' });
const LOADERS = new Map(Object.entries(FILES).map(([path, load]) => [path.slice('./rig/dragon_'.length, -'.json'.length), load]));

export function livingStage(stage: DragonStage): LivingStage | null {
  return stage !== 'egg' && LOADERS.has(stage) ? stage : null;
}

export function decodeRig(f: RigFile): Rig {
  if (f.grid !== GRID) throw new Error(`${f.stage}: a ${f.grid} grid, the game draws ${GRID}`);
  const weights = Uint8Array.from(atob(f.weights), (c) => c.charCodeAt(0));
  if (weights.length !== VERTS * VERTS * BONES.length) throw new Error(`${f.stage}: ${weights.length} weight bytes`);
  for (const b of BONES) if (!f.pivots[b]) throw new Error(`${f.stage}: no pivot for ${b}`);
  return { stage: f.stage as LivingStage, pivots: f.pivots, feet: f.feet, weights };
}

const cache = new Map<LivingStage, Promise<Rig>>();

export function loadRig(stage: LivingStage): Promise<Rig> {
  let p = cache.get(stage);
  if (!p) {
    const load = LOADERS.get(stage);
    p = load ? load().then(decodeRig) : Promise.reject(new Error(`no rig for ${stage}`));
    p.catch(() => cache.delete(stage));
    cache.set(stage, p);
  }
  return p;
}
```

- [ ] **Step 5: Write the baker**

```python
"""The living dragon's rigs (the dragon-rig skill; spec 2026-10-02 living dragon, plan Rulings R1, R6).

    tools/art/run_docker.sh rig grid  [--stage S]   # tools/art/rig-out/grid_<stage>.png: the sprite under a 50 px grid
    tools/art/run_docker.sh rig bake  [--stage S]   # web/src/lib/living/rig/dragon_<stage>.json (the game's weights)
    tools/art/run_docker.sh rig debug [--stage S]   # tools/art/rig-out/rig_<stage>.png: weights, pivots, feet box
    tools/art/run_docker.sh rig sheet               # docs/art/dragon-rig.png: the five debug views, for the record

Per bone: its region (polygon, ellipse, or the whole frame) rasterised inside the sprite's opaque
pixels, times an optional ramp (along y, or by distance from the pivot), pushed into the transparent
background by nearest-opaque-pixel fill (so mesh triangles straddling the outline move with the part
and do not shear its edge), then Gaussian-blurred. The rigid bones (head, wings, tail) are normalised
so their sum stays <= 1; everything is multiplied by (1 - pin), and every vertex inside the feet box
(the pin rectangle inset by 3 x its blur, down to the bottom) is hard-zeroed. The weights are sampled
at the 65 x 65 vertices of the game's mesh: bytes[(j * 65 + i) * 6 + b], vertex (i, j) at (16 i, 16 j).
"""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

REPO = Path(__file__).resolve().parents[2]
RIG_FILE = REPO / 'tools/art/rig.json'
SPRITE = 'web/public/art/dragon/dragon_{stage}_cut.webp'
BAKED = REPO / 'web/src/lib/living/rig'
SCRATCH = REPO / 'tools/art/rig-out'
SHEET = REPO / 'docs/art/dragon-rig.png'
N = 1024
GRID = 64
CELL = N // GRID
BONES = ['head', 'wingL', 'wingR', 'tail', 'chest', 'lift']
RIGID = ['head', 'wingL', 'wingR', 'tail']
COLOURS = {'head': (255, 60, 60), 'wingL': (60, 200, 60), 'wingR': (60, 120, 255), 'tail': (255, 200, 0)}
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)


def rigs():
    data = json.loads(RIG_FILE.read_text(encoding='utf-8'))
    return {k: v for k, v in data.items() if not k.startswith('_')}


def sprite_path(stage):
    return REPO / SPRITE.format(stage=stage)


def source_hash(stage, block):
    canon = json.dumps(block, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    h = hashlib.sha256(canon.encode('utf-8'))
    h.update(b'\n')
    h.update(sprite_path(stage).read_bytes())
    return h.hexdigest()


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def raster(spec):
    im = Image.new('L', (N, N), 0)
    d = ImageDraw.Draw(im)
    if 'poly' in spec:
        d.polygon([tuple(p) for p in spec['poly']], fill=255)
    elif 'ellipse' in spec:
        cx, cy, rx, ry = spec['ellipse']
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    elif 'rect' in spec:
        d.rectangle(spec['rect'], fill=255)
    elif spec.get('all'):
        d.rectangle([0, 0, N, N], fill=255)
    return np.asarray(im, np.float32) / 255


def blur(a, r):
    return a if r <= 0 else ndimage.gaussian_filter(a.astype(np.float32), r, mode='nearest')


def feet_box(pin):
    x0, y0, x1, _ = pin['rect']
    inset = 3 * pin['blur']
    return [math.ceil((x0 + inset) / CELL) * CELL, math.ceil((y0 + inset) / CELL) * CELL, math.floor((x1 - inset) / CELL) * CELL, N]


def weight_maps(stage, rig):
    sprite = Image.open(sprite_path(stage)).convert('RGBA')
    alpha = np.asarray(sprite, np.float32)[..., 3] / 255
    opaque = alpha > 0.05
    _, (iy, ix) = ndimage.distance_transform_edt(~opaque, return_indices=True)
    pin = blur(raster(rig['pin']), rig['pin']['blur'])
    w = {}
    for name in BONES:
        b = rig['bones'][name]
        if not ('poly' in b or 'ellipse' in b or b.get('all')):
            w[name] = np.zeros((N, N), np.float32)
            continue
        m = raster(b)
        if 'ramp' in b:
            lo, hi = b['ramp']
            m = m * smoothstep(lo, hi, yy)
        if 'ramp_from_pivot' in b:
            px, py = b['pivot']
            r0, r1 = b['ramp_from_pivot']
            m = m * smoothstep(r0, r1, np.hypot(xx - px, yy - py))
        m = np.where(opaque, m, 0)[iy, ix]
        w[name] = np.clip(blur(m, b.get('blur', 0)), 0, 1) * (1 - pin)
    over = np.maximum(sum(w[k] for k in RIGID), 1)
    for k in RIGID:
        w[k] = w[k] / over
    return sprite, alpha, pin, w


def vertex_bytes(w, feet):
    idx = np.minimum(np.arange(GRID + 1) * CELL, N - 1)
    per = np.stack([w[k][np.ix_(idx, idx)] for k in BONES], -1)  # [row j, column i, bone]
    q = np.clip(np.round(per * 255), 0, 255).astype(np.uint8)
    v = np.arange(GRID + 1) * CELL
    x0, y0, x1, _ = feet
    inside = (v[:, None] >= y0) & (v[None, :] >= x0) & (v[None, :] <= x1)
    q[inside] = 0
    return q.tobytes()


def bake(stage, rig):
    _, _, _, w = weight_maps(stage, rig)
    feet = feet_box(rig['pin'])
    out = {
        'stage': stage,
        'source': source_hash(stage, rig),
        'grid': GRID,
        'pivots': {k: rig['bones'][k]['pivot'] for k in BONES},
        'feet': feet,
        'weights': base64.b64encode(vertex_bytes(w, feet)).decode('ascii'),
    }
    BAKED.mkdir(parents=True, exist_ok=True)
    (BAKED / f'dragon_{stage}.json').write_text(json.dumps(out, indent=2) + '\n', encoding='utf-8')
    print(stage, {k: round(float(v.max()), 3) for k, v in w.items()}, 'feet', feet)


def debug_image(stage, rig):
    sprite, alpha, pin, w = weight_maps(stage, rig)
    base = np.asarray(sprite.convert('L').convert('RGB'), np.float32)
    img = base * alpha[..., None] + 255 * (1 - alpha[..., None])
    for k, c in COLOURS.items():
        a = (w[k] * 0.6)[..., None]
        img = img * (1 - a) + np.array(c, np.float32) * a
    a = (pin * 0.45)[..., None]
    img = img * (1 - a)
    out = Image.fromarray(img.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=18)
    x0, y0, x1, y1 = feet_box(rig['pin'])
    d.rectangle([x0, y0, x1, y1 - 1], outline=(220, 0, 220), width=3)
    for k in BONES:
        px, py = rig['bones'][k]['pivot']
        d.ellipse([px - 9, py - 9, px + 9, py + 9], fill=(255, 255, 255), outline=(0, 0, 0), width=3)
        d.text((px + 12, py - 10), k, fill=(0, 0, 0), font=font)
    d.text((12, 10), stage, fill=(0, 0, 0), font=ImageFont.load_default(size=32))
    return out


def grid_image(stage):
    sprite = Image.open(sprite_path(stage)).convert('RGBA')
    out = Image.new('RGB', (N, N), (255, 255, 255))
    out.paste(sprite, (0, 0), sprite)
    d = ImageDraw.Draw(out)
    font = ImageFont.load_default(size=14)
    for v in range(0, N + 1, 50):
        strong = v % 100 == 0
        colour = (90, 90, 200) if strong else (190, 190, 230)
        d.line([(v, 0), (v, N)], fill=colour, width=1)
        d.line([(0, v), (N, v)], fill=colour, width=1)
        if strong:
            d.text((v + 2, 2), str(v), fill=(40, 40, 160), font=font)
            d.text((2, v + 2), str(v), fill=(40, 40, 160), font=font)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('mode', choices=['grid', 'bake', 'debug', 'sheet'])
    ap.add_argument('--stage')
    args = ap.parse_args()
    all_rigs = rigs()
    stages = [args.stage] if args.stage else list(all_rigs)
    if args.mode == 'grid':
        SCRATCH.mkdir(parents=True, exist_ok=True)
        for s in stages:
            grid_image(s).save(SCRATCH / f'grid_{s}.png')
    elif args.mode == 'bake':
        for s in stages:
            bake(s, all_rigs[s])
    elif args.mode == 'debug':
        SCRATCH.mkdir(parents=True, exist_ok=True)
        for s in stages:
            debug_image(s, all_rigs[s]).save(SCRATCH / f'rig_{s}.png')
    else:
        tile = 384
        order = [s for s in ['hatchling', 'young', 'adult', 'illustre', 'ancestral'] if s in all_rigs]
        sheet = Image.new('RGB', (tile * 3, tile * 2), (255, 255, 255))
        for n, s in enumerate(order):
            sheet.paste(debug_image(s, all_rigs[s]).resize((tile, tile), Image.LANCZOS), ((n % 3) * tile, (n // 3) * tile))
        sheet.save(SHEET, optimize=True)
    print('done', args.mode, stages)


if __name__ == '__main__':
    main()
```

- [ ] **Step 6: Give the runner a `rig` mode and ignore the scratch folder**

In `tools/art/run_docker.sh`: add to the usage comment block the line
`#   tools/art/run_docker.sh rig     grid|bake|debug|sheet [--stage S]   # the living dragon's rigs (the dragon-rig skill)`,
add the case line `  rig)    CMD="python tools/art/rig.py $*" ;;` after the `uiart)` line, and make the usage error read
`echo "usage: $0 cutout|webify|icons|uiart|rig|all [args]" >&2; exit 2 ;;`.

In `.gitignore`, after the `assets/art/web/` block, add:

```
# tools/art/rig.py's grid and debug views (the dragon-rig skill): scratch, never committed; the
# record is docs/art/dragon-rig.png.
tools/art/rig-out/
```

- [ ] **Step 7: Bake, look, and run the tests**

```bash
tools/art/run_docker.sh rig bake  > /c/Users/nicol/.claude/jobs/9ac9a508/tmp/rig-bake.log 2>&1; tail -5 /c/Users/nicol/.claude/jobs/9ac9a508/tmp/rig-bake.log
tools/art/run_docker.sh rig grid --stage ancestral
tools/art/run_docker.sh rig debug
```

Look at `tools/art/rig-out/grid_ancestral.png` (Read tool): find the tip of the dark right-hand horn (the one rising from the brow, near x 600, y 20). If it is not within 8 px of (606, 22), change the probe point in `rigs.test.ts` to the tip read off the grid. Look at `tools/art/rig-out/rig_ancestral.png`: the horn is red to its tip, and nothing else changed from the spike's view (`C:\Users\nicol\.claude\jobs\9ac9a508\tmp\spike-living\tools\weights_ancestral_debug.png`). Look at `rig_adult.png` against the spike's `weights_adult_debug.png`: the same colours.

Run: `STACK=living scripts/npm.sh run test -- src/lib/living` then `STACK=living scripts/npm.sh run check`
Expected: all PASS; 0 errors, 0 warnings. Each baked JSON is about 34 KB.

- [ ] **Step 8: Write the skill**

`.claude/skills/dragon-rig/SKILL.md`:

````markdown
---
name: dragon-rig
description: Author, bake and check the living dragon's rigs (head, wings, tail, breath on one painted sprite per stage, WebGL2 mesh skinning). Use when a dragon stage picture changes, when a part of the living dragon lags, tears or moves when it should not (a horn, a wing tip, the feet), or to tune a stage's motion regions.
---

# The living dragon's rigs

The game animates each hatched stage's single sprite (`web/public/art/dragon/dragon_<stage>_cut.webp`)
with a 64 x 64 mesh and six bones (spec `docs/superpowers/specs/2026-10-02-living-dragon-design.md`).
A rig says, per stage, where each bone turns and what it moves. The motion itself (periods and
amplitudes) is code: `web/src/lib/living/pose.ts`.

## Files

| File | What |
|---|---|
| `tools/art/rig.json` | The rigs, hand-authored: per stage six bones (pivot, region, ramp, blur) and the pin rectangle. Integers only. |
| `tools/art/rig.py` | The baker and its views (runs in the art tools' container, nothing installed on the host). |
| `web/src/lib/living/rig/dragon_<stage>.json` | What the game loads: pivots, feet box, per-vertex weights (base64). Baked, never edited. |
| `web/src/lib/living/rigs.test.ts` | Fails when a rig or a sprite changed since the bake, when the feet carry weight, or when the ancestral's horn tip lags. |
| `tools/art/rig-out/` | Scratch (gitignored): `grid_<stage>.png`, `rig_<stage>.png`. |
| `docs/art/dragon-rig.png` | The five debug views, kept as the record. |

## Commands

```bash
tools/art/run_docker.sh rig grid  [--stage S]   # the sprite under a 50 px grid, to read coordinates off
tools/art/run_docker.sh rig bake  [--stage S]   # the game's weights
tools/art/run_docker.sh rig debug [--stage S]   # weights over the greyed sprite: head red, left wing green,
                                                # right wing blue, tail yellow, pin darkened, feet box magenta,
                                                # pivots as white dots
tools/art/run_docker.sh rig sheet               # docs/art/dragon-rig.png
STACK=<s> scripts/npm.sh run test -- src/lib/living
```

## The bones

- `head`: rotation about the neck base. Region: the head, both horns to their tips, crest and beard,
  and the neck; `ramp: [y_shoulders, y_jaw]` fades it along the neck to nothing at the shoulders.
- `wingL`, `wingR` (left and right as seen): rotation about each shoulder. Region: the whole membrane
  and the arm, generous into the background past the tips; `ramp_from_pivot` fades it near the shoulder.
- `tail`: rotation about the hip. Region: the tail from the hip to the tip, tight where it passes the
  legs or a wing tip. A stage whose tail does not show (the hatchling in its shell) has no region.
- `chest`: a breathing scale. An ellipse on the chest, blur about 30.
- `lift`: the upper body's rise with the breath: `"all": true` with `ramp: [y_feet, y_hips]`.
- `pin`: a rectangle over the feet (or the hatchling's shell), blur about 22. The feet box (the
  rectangle inset by 3 x blur on top and both sides, down to the bottom) gets zero weight.

## Authoring a stage (about 20 minutes)

1. `rig grid --stage S`, then read the grid view (Read tool): note the neck base, both shoulders, the
   hip, the jaw line, the horn tips, the wing tips, where the feet stand.
2. Write the stage's block in `rig.json` (start from the closest stage's block), then `rig bake` and
   `rig debug --stage S`, and look at `rig_<S>.png`.
3. Check, and fix the polygons until all hold:
   - the head is red to the tip of every horn, the crest and the beard; the neck fades to grey at the
     shoulders; no red on a wing;
   - each wing is coloured to its tips and a little beyond, fading to grey at its shoulder; never on
     the body or on the other wing;
   - the tail is yellow from the hip to the tip, and nowhere on a leg or a wing tip;
   - every foot is inside the magenta feet box; nothing coloured inside it;
   - the pivots sit at the neck base, the shoulders and the hip.
4. Watch it live in the lab (below) at 1.5x and at 3x: no tearing, no streaks off the outline, the
   pieces seated, the feet still.
5. `rig sheet`, run the tests, commit `rig.json`, the baked JSON and the sheet together.

Lessons from the spike: a horn or a wing tip left out of its region lags behind (the adult's left
horn, the ancestral's right horn); wing-tip polygons must be generous into the background; overlap
zones (tail against a wing tip) must stay tight; the cut-outs' faint background haze is dropped by
the shader (alpha below about 4 %), never by the rig.

## The lab

```bash
STACK=<s> scripts/npm.sh exec -- vite build --config vite.lab.config.ts
python -m http.server 8744 --directory web/dist-lab     # then open http://localhost:8744/lab.html
```

Every stage with a rig, living side by side: amplitude (1.5x by default), tint, worn pieces, the
weights view, pause and a time slider.
````

In `.claude/skills/art-overlays/SKILL.md`, at the end of the "Where the game reads the overlays" section, add:
`- **On the living dragon:** the pieces ride the animated dragon as rigid passengers (weights at the centre of their box); rigs and motion are the dragon-rig skill.`

- [ ] **Step 9: Commit**

```bash
git add tools/art/rig.json tools/art/rig.py tools/art/run_docker.sh .gitignore web/src/lib/living/rigs.ts web/src/lib/living/rigs.test.ts web/src/lib/living/rig .claude/skills/dragon-rig/SKILL.md .claude/skills/art-overlays/SKILL.md
git commit -m "Living dragon, rigs: tools/art/rig.py bakes tools/art/rig.json into per-vertex weights (25 KB a stage, smaller than a weight PNG) the game imports lazily, with the pivots and the feet box hard-zeroed; the spike's adult and ancestral rigs, the ancestral's head now reaching its right horn's tip (it lagged); the tests refuse a stale bake, weighted feet, rigid bones past one; the dragon-rig skill says how to author a rig"
```

---

### Task 4: Piece atlas and the WebGL2 renderer

**Files:**
- Create: `web/src/lib/living/atlas.ts`, `web/src/lib/living/atlas.test.ts`, `web/src/lib/living/renderer.ts`

**Interfaces:**
- Consumes: `OverlayLayer` and `ACCESSORY_MANIFEST` (`web/src/lib/world/accessories.ts`); `FRAME`, `MARGIN`, `buildMesh`, `weightsAt`, `skinPoint` (Task 2); `filterMatrices` (Task 1); `Rig` (Task 3).
- Produces (`atlas.ts`): `ATLAS = 1024`, `ATLAS_CELL = 512`, `interface PiecePlacement { item: string; src: string; frame: [number, number, number, number]; atlas: [number, number, number, number]; atlasUv: [number, number, number, number]; anchor: [number, number] }` (frame and atlas as x0, y0, x1, y1 / x, y, w, h in px), `interface PieceDraw { frame: readonly [number, number, number, number]; atlasUv: readonly [number, number, number, number]; weights: Float32Array }`, `placePieces(overlays: readonly OverlayLayer[]): PiecePlacement[]`, `pieceDraws(placed: readonly PiecePlacement[], weights: Uint8Array): PieceDraw[]`, `loadImage(src: string): Promise<HTMLImageElement>`, `buildAtlas(placed: readonly PiecePlacement[]): Promise<HTMLCanvasElement>`.
- Produces (`renderer.ts`): `class DragonRenderer { constructor(canvas: HTMLCanvasElement, sprite: TexImageSource, rig: Rig); setTint(css: string): void; setPieces(atlas: TexImageSource | null, pieces: readonly PieceDraw[]): void; resize(px: number): void; draw(bones: Float32Array, showWeights?: boolean): void; dispose(): void }` (the constructor and `setTint` throw on failure).

- [ ] **Step 1: Write the failing atlas test**

```ts
// web/src/lib/living/atlas.test.ts
// The worn pieces on the living dragon (spec 2026-10-02 living dragon, "Pieces"; plan Ruling R2): one
// atlas cell each, drawn in DRAW_ORDER, each skinned rigidly with the dragon's weights at its anchor.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACCESSORY_MANIFEST, accessoryLayers } from '../world/accessories';
import { ATLAS, ATLAS_CELL, pieceDraws, placePieces } from './atlas';
import { poseAt } from './pose';
import { decodeRig, type RigFile } from './rigs';
import { FRAME, skinPoint } from './skin';

const ADULT = decodeRig(JSON.parse(readFileSync('src/lib/living/rig/dragon_adult.json', 'utf-8')) as RigFile);
const WORN = ['echo-tete', 'hydre-cou', 'lethe-queue', 'sirenes-dos'];

describe('the piece atlas', () => {
  it('keeps the draw order, one cell each, inside the atlas', () => {
    const placed = placePieces(accessoryLayers(WORN, 'adult'));
    expect(placed.map((p) => p.item)).toEqual(['lethe-queue', 'sirenes-dos', 'hydre-cou', 'echo-tete']);
    expect(new Set(placed.map((p) => `${p.atlas[0]},${p.atlas[1]}`)).size).toBe(4);
    for (const p of placed) {
      expect(p.atlasUv.every((v) => v >= 0 && v <= 1)).toBe(true);
      expect(p.atlas[2]).toBeLessThanOrEqual(ATLAS_CELL);
      expect(p.atlas[3]).toBeLessThanOrEqual(ATLAS_CELL);
      expect(p.atlasUv[2] - p.atlasUv[0]).toBeCloseTo(p.atlas[2] / ATLAS, 9);
    }
  });

  it('anchors a piece at the centre of its box in the frame', () => {
    const [p] = placePieces(accessoryLayers(['hydre-cou'], 'adult'));
    const e = ACCESSORY_MANIFEST['hydre-cou'].adult!;
    expect(p.frame[0]).toBeCloseTo(e.x * FRAME, 6);
    expect(p.frame[3]).toBeCloseTo((e.y + e.h) * FRAME, 6);
    expect(p.anchor[0]).toBeCloseTo((e.x + e.w / 2) * FRAME, 6);
    expect(p.anchor[1]).toBeCloseTo((e.y + e.h / 2) * FRAME, 6);
  });

  it('fits every piece of the manifest, at every stage, in one cell', () => {
    for (const [item, stages] of Object.entries(ACCESSORY_MANIFEST)) {
      for (const [stage, e] of Object.entries(stages)) {
        expect(Math.ceil(e!.w * FRAME), `${item} ${stage}`).toBeLessThanOrEqual(ATLAS_CELL);
        expect(Math.ceil(e!.h * FRAME), `${item} ${stage}`).toBeLessThanOrEqual(ATLAS_CELL);
      }
    }
  });

  it('refuses more than four pieces', () => {
    const one = accessoryLayers(['hydre-cou'], 'adult')[0];
    expect(() => placePieces([one, one, one, one, one])).toThrow();
  });
});

describe('a piece rides rigidly', () => {
  it('moves its four corners with one and the same weights, keeping its shape (the saddle too)', () => {
    const placed = placePieces(accessoryLayers(['sirenes-dos', 'hydre-cou', 'echo-tete', 'lethe-queue'], 'adult'));
    const draws = pieceDraws(placed, ADULT.weights);
    for (const [n, d] of draws.entries()) {
      const [x0, y0, x1, y1] = d.frame;
      const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const;
      for (let t = 0; t < 12; t += 0.37) {
        const bones = poseAt(t, ADULT.pivots, 3); // twice the game's amplitude: any stretch would show
        const q = corners.map((c) => skinPoint(c, d.weights, bones));
        const width = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
        const height = Math.hypot(q[2][0] - q[0][0], q[2][1] - q[0][1]);
        const diag = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]);
        expect(Math.abs(width / (x1 - x0) - 1), `${placed[n].item} width at ${t}`).toBeLessThan(0.05);
        expect(Math.abs(height / (y1 - y0) - 1), `${placed[n].item} height at ${t}`).toBeLessThan(0.05);
        expect(Math.abs(diag / Math.hypot(x1 - x0, y1 - y0) - 1), `${placed[n].item} shear at ${t}`).toBeLessThan(0.05);
      }
    }
  });

  it('takes the dragon weights at its anchor', () => {
    const [p] = placePieces(accessoryLayers(['echo-tete'], 'adult'));
    const [d] = pieceDraws([p], ADULT.weights);
    expect(d.weights[0]).toBeGreaterThan(0.8); // the helmet goes with the head
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `STACK=living scripts/npm.sh run test -- src/lib/living/atlas.test.ts`
Expected: FAIL, `Failed to resolve import "./atlas"`.

- [ ] **Step 3: Write the atlas**

```ts
// web/src/lib/living/atlas.ts
// The worn pieces on the living dragon (spec 2026-10-02 living dragon, "Pieces"; plan Ruling R2): each
// piece gets a 512 px cell of one 1024 atlas texture and is drawn as its own quad at its manifest box,
// back to front (accessoryLayers already orders them by DRAW_ORDER), skinned with the dragon's weights
// at its anchor, the box's centre: a rigid passenger that never stretches, the saddle included.
import type { OverlayLayer } from '../world/accessories';
import { FRAME, weightsAt } from './skin';

export const ATLAS = 1024;
export const ATLAS_CELL = 512;

export interface PiecePlacement {
  item: string;
  src: string;
  /** The box in the frame, px: x0, y0, x1, y1. */
  frame: [number, number, number, number];
  /** Where the crop is drawn in the atlas, px: x, y, w, h. */
  atlas: [number, number, number, number];
  atlasUv: [number, number, number, number];
  anchor: [number, number];
}

export interface PieceDraw {
  frame: readonly [number, number, number, number];
  atlasUv: readonly [number, number, number, number];
  weights: Float32Array;
}

export function placePieces(overlays: readonly OverlayLayer[]): PiecePlacement[] {
  if (overlays.length > 4) throw new Error(`${overlays.length} pieces: at most one per slot`);
  return overlays.map((o, n) => {
    const x0 = (o.left / 100) * FRAME;
    const y0 = (o.top / 100) * FRAME;
    const w = (o.width / 100) * FRAME;
    const h = (o.height / 100) * FRAME;
    const pw = Math.ceil(w);
    const ph = Math.ceil(h);
    if (pw > ATLAS_CELL || ph > ATLAS_CELL) throw new Error(`${o.item}: ${pw} x ${ph} px, bigger than an atlas cell`);
    const ax = (n % 2) * ATLAS_CELL;
    const ay = Math.floor(n / 2) * ATLAS_CELL;
    return {
      item: o.item,
      src: o.src,
      frame: [x0, y0, x0 + w, y0 + h],
      atlas: [ax, ay, pw, ph],
      atlasUv: [ax / ATLAS, ay / ATLAS, (ax + pw) / ATLAS, (ay + ph) / ATLAS],
      anchor: [x0 + w / 2, y0 + h / 2],
    };
  });
}

export function pieceDraws(placed: readonly PiecePlacement[], weights: Uint8Array): PieceDraw[] {
  return placed.map((p) => ({ frame: p.frame, atlasUv: p.atlasUv, weights: weightsAt(weights, p.anchor[0], p.anchor[1]) }));
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img.decode().then(() => img);
}

export async function buildAtlas(placed: readonly PiecePlacement[]): Promise<HTMLCanvasElement> {
  const images = await Promise.all(placed.map((p) => loadImage(p.src)));
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no 2D canvas for the piece atlas');
  placed.forEach((p, n) => g.drawImage(images[n], p.atlas[0], p.atlas[1], p.atlas[2], p.atlas[3]));
  return canvas;
}
```

- [ ] **Step 4: Run the atlas test to verify it passes**

Run: `STACK=living scripts/npm.sh run test -- src/lib/living/atlas.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the renderer** (a port of the spike's `LivingDragon` class in `index.html`, read side by side with it)

```ts
// web/src/lib/living/renderer.ts
// The living dragon's WebGL2 drawing (spec 2026-10-02 living dragon, "Technique"), ported from the
// spike: the sprite on the 64 x 64 mesh, skinned in the vertex shader with the per-vertex weights; the
// tint in the fragment shader on the dragon only (two TINT_FILTERS steps as colour matrices, alpha
// below about 4 % dropped so the cut-out's background haze never smears into streaks); then each worn
// piece as its own quad from the atlas, back to front, skinned rigidly with uniform weights and never
// tinted. Every failure throws: the caller shows the still picture. No unit test (no GL in node):
// living-dragon.spec.ts proves it.
import type { PieceDraw } from './atlas';
import type { Rig } from './rigs';
import { FRAME, MARGIN, buildMesh } from './skin';
import { filterMatrices } from './tint';

const VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
layout(location = 2) in vec4 aW0;
layout(location = 3) in vec2 aW1;
uniform mat3 uB[6];
uniform float uMargin;
uniform bool uRigid;
uniform float uW[6];
out vec2 vUv;
out vec4 vW0;
void main() {
  float w[6];
  if (uRigid) {
    for (int i = 0; i < 6; i++) w[i] = uW[i];
  } else {
    w[0] = aW0.x; w[1] = aW0.y; w[2] = aW0.z; w[3] = aW0.w; w[4] = aW1.x; w[5] = aW1.y;
  }
  vec2 d = vec2(0.0);
  for (int i = 0; i < 6; i++) d += w[i] * ((uB[i] * vec3(aPos, 1.0)).xy - aPos);
  vec2 q = (aPos + d) / ${FRAME}.0;
  vec2 ndc = (q - 0.5) * 2.0 / (1.0 + 2.0 * uMargin);
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  vUv = aUv;
  vW0 = uRigid ? vec4(0.0) : aW0;
}`;

const FS = `#version 300 es
precision mediump float;
in vec2 vUv;
in vec4 vW0;
uniform sampler2D uTex;
uniform int uLayer;
uniform mat3 uT0;
uniform mat3 uT1;
uniform bool uShowWeights;
out vec4 o;
void main() {
  vec4 c = texture(uTex, vUv);
  if (uLayer == 1) { o = c; return; }
  c *= smoothstep(0.02, 0.05, c.a);
  vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  rgb = clamp(uT0 * rgb, 0.0, 1.0);
  rgb = clamp(uT1 * rgb, 0.0, 1.0);
  o = vec4(rgb * c.a, c.a);
  if (uShowWeights && o.a > 0.0) {
    vec3 wc = vW0.x * vec3(1.0, 0.2, 0.2) + vW0.y * vec3(0.2, 0.8, 0.2) + vW0.z * vec3(0.2, 0.45, 1.0) + vW0.w * vec3(1.0, 0.8, 0.0);
    float s = min(1.0, vW0.x + vW0.y + vW0.z + vW0.w);
    vec3 g = vec3(dot(o.rgb / o.a, vec3(0.3, 0.59, 0.11)));
    o.rgb = mix(g, wc, 0.6 * s) * o.a;
  }
}`;

const UNIFORMS = ['uB', 'uMargin', 'uRigid', 'uW', 'uTex', 'uLayer', 'uT0', 'uT1', 'uShowWeights'] as const;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('createShader failed');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s) ?? 'failed'}`);
  return s;
}

export class DragonRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  private readonly meshVao: WebGLVertexArrayObject;
  private readonly meshCount: number;
  private readonly quadVao: WebGLVertexArrayObject;
  private readonly quadBuffer: WebGLBuffer;
  private readonly baseTex: WebGLTexture;
  private atlasTex: WebGLTexture | null = null;
  private pieces: readonly PieceDraw[] = [];
  private readonly buffers: WebGLBuffer[] = [];
  private shaders: WebGLShader[] = [];

  constructor(private readonly canvas: HTMLCanvasElement, sprite: TexImageSource, rig: Rig) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: false, stencil: false });
    if (!gl) throw new Error('no WebGL2');
    this.gl = gl;
    const program = gl.createProgram();
    if (!program) throw new Error('createProgram failed');
    this.shaders = [compile(gl, gl.VERTEX_SHADER, VS), compile(gl, gl.FRAGMENT_SHADER, FS)];
    for (const s of this.shaders) gl.attachShader(program, s);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(program) ?? 'failed'}`);
    this.program = program;
    gl.useProgram(program);
    this.u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(program, n)])) as DragonRenderer['u'];

    const mesh = buildMesh(rig.weights);
    this.meshVao = this.vao();
    this.attribute(0, mesh.pos, 2);
    this.attribute(1, mesh.uv, 2);
    this.attribute(2, mesh.w0, 4);
    this.attribute(3, mesh.w1, 2);
    const ib = this.buffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    this.meshCount = mesh.indices.length;
    gl.bindVertexArray(null);

    this.quadVao = this.vao();
    this.quadBuffer = this.buffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);

    this.baseTex = this.texture(0, sprite);
    gl.uniform1f(this.u.uMargin, MARGIN);
    this.setTint('none');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (gl.getError() !== gl.NO_ERROR) throw new Error('WebGL error while setting up');
  }

  private vao(): WebGLVertexArrayObject {
    const v = this.gl.createVertexArray();
    if (!v) throw new Error('createVertexArray failed');
    this.gl.bindVertexArray(v);
    return v;
  }

  private buffer(): WebGLBuffer {
    const b = this.gl.createBuffer();
    if (!b) throw new Error('createBuffer failed');
    this.buffers.push(b);
    return b;
  }

  private attribute(loc: number, data: Float32Array, size: number): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  private texture(unit: number, src: TexImageSource, into?: WebGLTexture): WebGLTexture {
    const gl = this.gl;
    const t = into ?? gl.createTexture();
    if (!t) throw new Error('createTexture failed');
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  /** Throws when the tint cannot be expressed (the caller then shows the still picture). */
  setTint(css: string): void {
    const [a, b] = filterMatrices(css);
    this.gl.useProgram(this.program);
    this.gl.uniformMatrix3fv(this.u.uT0, false, a);
    this.gl.uniformMatrix3fv(this.u.uT1, false, b);
  }

  setPieces(atlas: TexImageSource | null, pieces: readonly PieceDraw[]): void {
    const gl = this.gl;
    this.pieces = atlas ? pieces : [];
    if (!atlas) return;
    this.atlasTex = this.texture(1, atlas, this.atlasTex ?? undefined);
    const data = new Float32Array(pieces.length * 16);
    pieces.forEach((p, n) => {
      const [x0, y0, x1, y1] = p.frame;
      const [u0, v0, u1, v1] = p.atlasUv;
      data.set([x0, y0, u0, v0, x1, y0, u1, v0, x0, y1, u0, v1, x1, y1, u1, v1], n * 16);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  }

  /** The canvas's backing size in px (square). */
  resize(px: number): void {
    if (this.canvas.width !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
  }

  draw(bones: Float32Array, showWeights = false): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniformMatrix3fv(this.u.uB, false, bones);
    gl.uniform1i(this.u.uRigid, 0);
    gl.uniform1i(this.u.uLayer, 0);
    gl.uniform1i(this.u.uShowWeights, showWeights ? 1 : 0);
    gl.uniform1i(this.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.baseTex);
    gl.bindVertexArray(this.meshVao);
    gl.drawElements(gl.TRIANGLES, this.meshCount, gl.UNSIGNED_SHORT, 0);
    if (this.atlasTex && this.pieces.length) {
      gl.uniform1i(this.u.uRigid, 1);
      gl.uniform1i(this.u.uLayer, 1);
      gl.uniform1i(this.u.uTex, 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);
      gl.bindVertexArray(this.quadVao);
      this.pieces.forEach((p, n) => {
        gl.uniform1fv(this.u.uW, p.weights);
        gl.drawArrays(gl.TRIANGLE_STRIP, n * 4, 4);
      });
    }
    gl.bindVertexArray(null);
  }

  /** Frees everything and the context itself, so many visits never reach the browser's context cap. */
  dispose(): void {
    const gl = this.gl;
    if (!gl.isContextLost()) {
      for (const b of this.buffers) gl.deleteBuffer(b);
      gl.deleteVertexArray(this.meshVao);
      gl.deleteVertexArray(this.quadVao);
      gl.deleteTexture(this.baseTex);
      if (this.atlasTex) gl.deleteTexture(this.atlasTex);
      for (const s of this.shaders) gl.deleteShader(s);
      gl.deleteProgram(this.program);
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
```

- [ ] **Step 6: Run the tests and the type check**

Run: `STACK=living scripts/npm.sh run test -- src/lib/living` then `STACK=living scripts/npm.sh run check`
Expected: all PASS; 0 errors, 0 warnings. (The renderer is first drawn in Task 5's lab.)

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/living/atlas.ts web/src/lib/living/atlas.test.ts web/src/lib/living/renderer.ts
git commit -m "Living dragon, renderer: the WebGL2 port of the spike (sprite on the skinned mesh, the tint as two colour matrices on the dragon only, alpha under 4 % dropped), the worn pieces in a four-cell atlas drawn back to front as rigid quads with the dragon's weights at their box centre; dispose loses the context so visits never pile contexts up"
```

---

### Task 5: `LivingDragon` and the dev lab

**Files:**
- Create: `web/src/components/LivingDragon.svelte`, `web/lab.html`, `web/src/lab/main.ts`, `web/src/lab/DragonLab.svelte`, `web/vite.lab.config.ts`
- Modify: `web/tsconfig.json` (include `vite.lab.config.ts`), `.gitignore` (`web/dist-lab/`)

**Interfaces:**
- Consumes: `DragonRenderer` (Task 4), `placePieces`, `pieceDraws`, `buildAtlas`, `loadImage` (Task 4), `loadRig`, `LIVING_STAGES`, `livingStage`, `type LivingStage`, `type Motion` (Task 3), `AMPLITUDE`, `poseAt`, `frameDue` (Task 2), `MARGIN` (Task 2), `OverlayLayer`, `accessoryLayers` (`world/accessories.ts`), `ART` (`world/art.ts`), `TINT_FILTERS`, `TINT_NAMES` (`world/dragon.ts`).
- Produces: `LivingDragon.svelte` with props `{ stage: LivingStage; src: string; alt: string; filter: string; overlays: OverlayLayer[]; amplitude?: number; time?: number | null; showWeights?: boolean; onmotion: (m: Motion) => void }`. Markup contract (used by Task 7's helpers and Task 8): wrapper `div.dragon-living` (gains `dragon-base` once living; `pending` while not) with `role="img"`, `aria-label={alt}`, `data-src`, `data-filter` (the filter applied), `data-worn` (the pieces on the canvas, space-separated, draw order); inside it one `canvas` with `data-frames` (frames drawn so far).

- [ ] **Step 1: Write the component**

```svelte
<!-- web/src/components/LivingDragon.svelte -->
<script lang="ts">
  // The living dragon (spec 2026-10-02 living dragon, "Component"): one WebGL2 canvas drawing the stage's
  // sprite on its skinned mesh with its worn pieces riding along, slowly and slightly alive. It covers
  // the same square box as the still picture, the canvas overflowing it by the 3.5 % margin so a wing
  // tip may move out. It tells DragonFigure how it goes (onmotion): `pending` while loading (the still
  // picture shows, this waits hidden), `living` from its first frame, `still` on any failure (no
  // WebGL2, a shader, a load, a tint it cannot express, a lost context: plan Ruling R4), after which
  // DragonFigure unmounts it. The loop draws at most 30 frames a second and stops while the page is
  // hidden or the canvas is off-screen. `amplitude`, `time` and `showWeights` serve the lab.
  import { onMount } from 'svelte';
  import type { OverlayLayer } from '../lib/world/accessories';
  import { buildAtlas, loadImage, pieceDraws, placePieces } from '../lib/living/atlas';
  import { AMPLITUDE, frameDue, poseAt } from '../lib/living/pose';
  import { DragonRenderer } from '../lib/living/renderer';
  import { loadRig, type LivingStage, type Motion, type Rig } from '../lib/living/rigs';
  import { MARGIN } from '../lib/living/skin';

  let {
    stage,
    src,
    alt,
    filter,
    overlays,
    amplitude = AMPLITUDE,
    time = null,
    showWeights = false,
    onmotion,
  }: {
    stage: LivingStage;
    src: string;
    alt: string;
    filter: string;
    overlays: OverlayLayer[];
    amplitude?: number;
    time?: number | null;
    showWeights?: boolean;
    onmotion: (m: Motion) => void;
  } = $props();

  let host = $state<HTMLDivElement>();
  let canvas = $state<HTMLCanvasElement>();
  let motion = $state<Motion>('pending');
  let applied = $state({ filter: '', worn: '' });

  let renderer: DragonRenderer | null = null;
  let rig: Rig | null = null;
  let raf = 0;
  let last: number | null = null;
  let frames = 0;
  let visible = true;
  let onScreen = true;
  let piecesKey = '';
  let piecesToken = 0;
  const started = performance.now();

  function still(): void {
    if (motion === 'still') return;
    motion = 'still';
    pause();
    renderer?.dispose();
    renderer = null;
    onmotion('still');
  }

  function draw(now: number): void {
    if (!renderer || !rig || !canvas) return;
    renderer.draw(poseAt(time ?? (now - started) / 1000, rig.pivots, amplitude), showWeights);
    frames += 1;
    canvas.dataset.frames = String(frames);
    if (motion === 'pending') {
      motion = 'living';
      onmotion('living');
    }
  }

  function tick(now: number): void {
    raf = 0;
    if (!renderer) return;
    if (frameDue(now, last)) {
      last = now;
      draw(now);
    }
    schedule();
  }

  function schedule(): void {
    if (!raf && renderer && visible && onScreen) raf = requestAnimationFrame(tick);
  }

  function pause(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function resize(): void {
    if (!renderer || !host) return;
    const width = host.getBoundingClientRect().width;
    renderer.resize(Math.max(1, Math.round(width * (1 + 2 * MARGIN) * Math.min(2, window.devicePixelRatio || 1))));
    last = null; // a resized canvas is blank: draw at the next frame
  }

  async function applyPieces(list: OverlayLayer[]): Promise<void> {
    const key = list.map((o) => o.src).join(' ');
    if (key === piecesKey) return;
    const token = ++piecesToken;
    const placed = placePieces(list);
    const atlas = placed.length ? await buildAtlas(placed) : null;
    if (token !== piecesToken || !renderer || !rig) return;
    renderer.setPieces(atlas, pieceDraws(placed, rig.weights));
    piecesKey = key;
    applied.worn = placed.map((p) => p.item).join(' ');
    last = null;
  }

  function applyTint(css: string): void {
    if (!renderer || css === applied.filter) return;
    renderer.setTint(css);
    applied.filter = css;
    last = null;
  }

  onMount(() => {
    onmotion('pending');
    let disposed = false;
    const el = host!;
    const cv = canvas!;
    (async () => {
      try {
        const [r, sprite] = await Promise.all([loadRig(stage), loadImage(src)]);
        if (disposed) return;
        rig = r;
        renderer = new DragonRenderer(cv, sprite, r);
        applyTint(filter);
        await applyPieces(overlays);
        if (disposed) return;
        resize();
        schedule();
      } catch {
        if (!disposed) still();
      }
    })();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen) schedule();
      else pause();
    });
    io.observe(el);
    const onVisibility = () => {
      visible = !document.hidden;
      if (visible) schedule();
      else pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onLost = () => still();
    cv.addEventListener('webglcontextlost', onLost);
    return () => {
      disposed = true;
      pause();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      cv.removeEventListener('webglcontextlost', onLost);
      renderer?.dispose();
      renderer = null;
    };
  });

  // A tint picked or a piece changed while the dragon is on screen: in place, no remount.
  $effect(() => {
    const css = filter;
    try {
      applyTint(css);
    } catch {
      still();
    }
  });
  $effect(() => {
    const list = overlays;
    if (renderer) applyPieces(list).catch(still);
  });
</script>

<div
  bind:this={host}
  class="dragon-living"
  class:dragon-base={motion === 'living'}
  class:pending={motion !== 'living'}
  role="img"
  aria-label={alt}
  data-src={src}
  data-filter={applied.filter}
  data-worn={applied.worn}
>
  <canvas bind:this={canvas} aria-hidden="true" style="left:{-MARGIN * 100}%;top:{-MARGIN * 100}%;width:{100 + 2 * MARGIN * 100}%;height:{100 + 2 * MARGIN * 100}%"></canvas>
</div>

<style>
  .dragon-living {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 1 / 1;
    pointer-events: none;
  }
  /* Loading: the still picture holds the box; the canvas waits, hidden, over it. */
  .dragon-living.pending {
    position: absolute;
    inset: 0;
    visibility: hidden;
  }
  canvas {
    position: absolute;
    display: block;
  }
</style>
```

- [ ] **Step 2: Write the lab**

`web/lab.html`:

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dragon vivant, labo</title>
  </head>
  <body>
    <div id="lab"></div>
    <script type="module" src="/src/lab/main.ts"></script>
  </body>
</html>
```

`web/src/lab/main.ts`:

```ts
// The living dragon's lab (plan Ruling R8): a dev-only page, built by vite.lab.config.ts, never shipped.
import { mount } from 'svelte';
import DragonLab from './DragonLab.svelte';

const target = document.getElementById('lab');
if (!target) throw new Error('#lab missing');
mount(DragonLab, { target });
```

`web/src/lab/DragonLab.svelte`:

```svelte
<script lang="ts">
  // Every stage with a rig, living side by side (the dragon-rig skill, "The lab"): amplitude, tint,
  // the worn pieces, the weights view, pause and a time slider. For the rig review and the human look.
  import LivingDragon from '../components/LivingDragon.svelte';
  import { ART } from '../lib/world/art';
  import { accessoryLayers } from '../lib/world/accessories';
  import { TINT_FILTERS, TINT_NAMES } from '../lib/world/dragon';
  import { AMPLITUDE } from '../lib/living/pose';
  import { LIVING_STAGES, livingStage, type Motion } from '../lib/living/rigs';
  import type { Tint } from '../lib/world/types';

  const WORN = ['lethe-queue', 'sirenes-dos', 'hydre-cou', 'echo-tete'];
  const stages = LIVING_STAGES.filter((s) => livingStage(s) !== null);
  const tints = Object.keys(TINT_FILTERS) as Tint[];
  const MOTION_WORDS: Record<Motion, string> = { pending: 'chargement', living: 'vivant', still: 'image fixe' };

  let amplitude = $state(AMPLITUDE);
  let tint = $state<Tint>('bronze');
  let pieces = $state(false);
  let weights = $state(false);
  let paused = $state(false);
  let at = $state(0);
  let motions = $state<Partial<Record<string, Motion>>>({});
</script>

<main>
  <h1>Le dragon vivant</h1>
  <div class="controls">
    <label>Amplitude <input type="range" min="0" max="3" step="0.05" bind:value={amplitude} /> {amplitude.toFixed(2)}x</label>
    <label>Teinte
      <select bind:value={tint}>
        {#each tints as t (t)}<option value={t}>{TINT_NAMES[t]}</option>{/each}
      </select>
    </label>
    <label><input type="checkbox" bind:checked={pieces} /> Parure</label>
    <label><input type="checkbox" bind:checked={weights} /> Poids</label>
    <label><input type="checkbox" bind:checked={paused} /> Pause</label>
    <label>Temps <input type="range" min="0" max="30" step="0.02" bind:value={at} disabled={!paused} /> {at.toFixed(2)} s</label>
  </div>
  <div class="grid">
    {#each stages as s (s)}
      <figure>
        <figcaption>{s} : {MOTION_WORDS[motions[s] ?? 'pending']}</figcaption>
        <div class="box">
          <LivingDragon
            stage={s}
            src={ART.dragon[s]}
            alt={s}
            filter={TINT_FILTERS[tint]}
            overlays={pieces ? accessoryLayers(WORN, s) : []}
            {amplitude}
            time={paused ? at : null}
            showWeights={weights}
            onmotion={(m) => (motions[s] = m)}
          />
        </div>
      </figure>
    {/each}
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #efe4cc;
    color: #2b2118;
    font: 15px/1.4 system-ui, sans-serif;
  }
  main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 16px;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 22px;
    margin-bottom: 14px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 14px;
  }
  figure {
    margin: 0;
    background: #f8f1e1;
    border: 1px solid #d6c6a4;
    border-radius: 10px;
    padding: 10px;
  }
  .box {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
  }
</style>
```

`web/vite.lab.config.ts`:

```ts
// The living dragon's lab (plan Ruling R8): its own build, into dist-lab/ (gitignored), never part of
// the game's image. Build: scripts/npm.sh exec -- vite build --config vite.lab.config.ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@content': fileURLToPath(new URL('../content', import.meta.url)),
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist-lab',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./lab.html', import.meta.url)) },
  },
});
```

In `web/tsconfig.json`: `"include": ["src/**/*.ts", "src/**/*.svelte", "vite.config.ts", "vite.lab.config.ts"]`. In `.gitignore`, after `web/dist/`: `web/dist-lab/`.

- [ ] **Step 3: Type-check, test, and build both bundles**

Run: `STACK=living scripts/npm.sh run check`, `STACK=living scripts/npm.sh run test`, `STACK=living scripts/npm.sh run build`, `STACK=living scripts/npm.sh exec -- vite build --config vite.lab.config.ts`
Expected: 0 errors, 0 warnings everywhere; the game's `web/dist/` holds no `lab.html` (`ls web/dist`); `web/dist-lab/lab.html` exists; the build lists `dragon_adult-*.js` and `dragon_ancestral-*.js` chunks of about 35 KB each.

- [ ] **Step 4: Look at it live**

Serve the lab (background) and drive it with Playwright's Chromium the way the spike's `tools/check.py` did (`--enable-unsafe-swiftshader --ignore-gpu-blocklist`; the spike's `.venv` at `C:\Users\nicol\.claude\jobs\9ac9a508\tmp\spike-living\.venv` has Playwright; run it under `tools/art/with_lock.sh`):

```bash
python -m http.server 8744 --directory web/dist-lab   # run_in_background
```

Write a throwaway script in `/c/Users/nicol/.claude/jobs/9ac9a508/tmp/lab_shots.py` that opens `http://127.0.0.1:8744/lab.html`, waits until every figcaption reads « vivant », and screenshots the grid at two times (pause on, time 1.2 s then 3.0 s), with « Parure » on and tint « Écume », and once with « Poids » on. Look at the shots (Read tool): both stages drawn, tinted, the pieces seated and untinted, no blank tile, no streak. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/LivingDragon.svelte web/lab.html web/src/lab web/vite.lab.config.ts web/tsconfig.json .gitignore
git commit -m "Living dragon, component: LivingDragon draws the stage on one WebGL2 canvas over the still picture's box (pending while it loads, living from its first frame, still on any failure), at most 30 fps, stopped while hidden or off-screen, tint and pieces updated in place; a dev-only lab page shows every rigged stage live with amplitude, tint, pieces, weights and time"
```

---

### Task 6: Rigs for the hatchling, the young and the illustre; debug overlays; STOP for the user

**Files:**
- Modify: `tools/art/rig.json` (three stage blocks), `web/src/lib/living/rigs.test.ts` (every living stage has a rig), `.claude/skills/dragon-rig/SKILL.md` (per-stage notes)
- Generated (committed): `web/src/lib/living/rig/dragon_{hatchling,young,illustre}.json`, `docs/art/dragon-rig.png`

**Interfaces:**
- Consumes: the baker (Task 3), the lab (Task 5).
- Produces: a baked rig for each of `LIVING_STAGES`.

- [ ] **Step 1: Write the failing test** (append to `rigs.test.ts`, inside `describe('the rigs')`, and import `LIVING_STAGES`)

```ts
  it('rigs every hatched stage, and nothing else', () => {
    expect([...STAGES].sort()).toEqual([...LIVING_STAGES].sort());
    for (const s of LIVING_STAGES) expect(livingStage(s), s).toBe(s);
  });
```

Run: `STACK=living scripts/npm.sh run test -- src/lib/living/rigs.test.ts`
Expected: FAIL (the stages lack `hatchling`, `illustre`, `young`).

- [ ] **Step 2: Read the three sprites off their grids**

`rig grid` reads the stage names from `rig.json`: add the three blocks of Step 3 first, then run `tools/art/run_docker.sh rig grid` and look at `tools/art/rig-out/grid_<stage>.png` for each new stage. What the pictures show (read off the 1024 sprites when this plan was written; confirm every number on the grids):
- hatchling: sitting in its broken shell (shell from about y 600 down, x 240-790); head x 290-680, y 30-320, horns to about (330, 130), (560, 35) and the back spikes; neck x 470-610 from y 300 to 470; wings rise from shoulders near (470, 480) and (690, 450), tips at about (165, 650) and (865, 610); claws on the shell's rim at y 740-800; **no tail shows**.
- young: standing; head x 430-760, y 20-300, both horns to about (440, 20) and (630, 20); neck down to the body near (600, 430); left wing x 40-480, y 130-760, shoulder near (480, 470); right wing x 690-960, y 180-740, shoulder near (720, 400); tail from the hip near (330, 600) curling down to (150, 820), its tip running behind the legs at y 830-890; feet at y 880-1000.
- illustre: standing; head x 520-840, y 0-290, the long left horn to about (395, 20); neck down to the body near (690, 470); left wing x 20-520, y 110-800, shoulder near (520, 480); right wing (behind the neck) x 740-950, y 180-720, shoulder near (780, 380); tail from the hip near (330, 640) to (110, 840), its tip behind the legs; feet at y 890-1000.

- [ ] **Step 3: Write the three blocks** (starting values; Step 4 fixes them by eye)

Add to `tools/art/rig.json`, before `"adult"`:

```json
  "hatchling": {
    "bones": {
      "head":  { "pivot": [560, 470], "poly": [[280,20],[700,20],[700,300],[620,320],[625,470],[465,470],[455,330],[280,250]], "ramp": [470, 300], "blur": 12 },
      "wingL": { "pivot": [470, 480], "poly": [[150,660],[160,560],[220,440],[330,340],[395,330],[420,420],[480,470],[440,520],[380,560],[300,585],[220,625]], "ramp_from_pivot": [30, 180], "blur": 8 },
      "wingR": { "pivot": [690, 450], "poly": [[675,420],[700,325],[750,325],[830,450],[875,625],[820,610],[760,575],[700,540]], "ramp_from_pivot": [30, 160], "blur": 8 },
      "tail":  { "pivot": [400, 700] },
      "chest": { "pivot": [600, 560], "ellipse": [600, 560, 100, 140], "blur": 24 },
      "lift":  { "pivot": [560, 760], "all": true, "ramp": [760, 520], "blur": 0 }
    },
    "pin": { "rect": [230, 600, 800, 1024], "blur": 18 }
  },
  "young": {
    "bones": {
      "head":  { "pivot": [610, 420], "poly": [[420,0],[760,0],[770,250],[720,300],[640,320],[660,430],[540,430],[500,330],[430,260]], "ramp": [430, 290], "blur": 12 },
      "wingL": { "pivot": [480, 470], "poly": [[30,560],[60,420],[160,260],[280,170],[400,120],[420,200],[400,380],[480,430],[520,470],[480,520],[400,530],[300,560],[200,600],[120,760],[60,700]], "ramp_from_pivot": [40, 220], "blur": 10 },
      "wingR": { "pivot": [720, 400], "poly": [[700,380],[760,260],[840,180],[900,190],[950,400],[960,600],[920,740],[880,700],[800,600],[740,520]], "ramp_from_pivot": [30, 180], "blur": 8 },
      "tail":  { "pivot": [330, 600], "poly": [[130,780],[150,680],[210,600],[300,570],[350,610],[300,680],[270,760],[250,840],[200,880],[150,860]], "ramp_from_pivot": [30, 230], "blur": 10 },
      "chest": { "pivot": [640, 560], "ellipse": [640, 560, 120, 200], "blur": 30 },
      "lift":  { "pivot": [600, 900], "all": true, "ramp": [900, 560], "blur": 0 }
    },
    "pin": { "rect": [200, 880, 800, 1024], "blur": 22 }
  },
```

and after `"adult"`, before `"ancestral"`:

```json
  "illustre": {
    "bones": {
      "head":  { "pivot": [690, 470], "poly": [[380,0],[760,0],[850,180],[840,260],[780,290],[720,300],[740,470],[600,470],[560,330],[520,230],[380,40]], "ramp": [480, 280], "blur": 12 },
      "wingL": { "pivot": [520, 480], "poly": [[20,600],[60,420],[160,260],[300,170],[430,110],[480,140],[460,300],[420,420],[520,450],[560,500],[520,540],[440,560],[340,600],[250,620],[180,700],[120,820],[80,780],[20,700]], "ramp_from_pivot": [40, 230], "blur": 10 },
      "wingR": { "pivot": [780, 380], "poly": [[760,360],[800,300],[880,220],[940,180],[950,300],[930,500],[880,640],[830,720],[810,600],[790,480]], "ramp_from_pivot": [30, 180], "blur": 8 },
      "tail":  { "pivot": [330, 640], "poly": [[110,840],[130,740],[180,670],[260,610],[330,600],[360,650],[300,720],[270,800],[260,880],[210,920],[140,900]], "ramp_from_pivot": [30, 230], "blur": 10 },
      "chest": { "pivot": [700, 580], "ellipse": [700, 580, 150, 220], "blur": 30 },
      "lift":  { "pivot": [650, 910], "all": true, "ramp": [905, 560], "blur": 0 }
    },
    "pin": { "rect": [210, 890, 850, 1024], "blur": 22 }
  },
```

- [ ] **Step 4: Bake, produce the debug overlays, and fix each stage by eye**

```bash
tools/art/run_docker.sh rig grid
tools/art/run_docker.sh rig bake  > /c/Users/nicol/.claude/jobs/9ac9a508/tmp/rig-bake.log 2>&1; tail -6 /c/Users/nicol/.claude/jobs/9ac9a508/tmp/rig-bake.log
tools/art/run_docker.sh rig debug
```

For each of `rig_hatchling.png`, `rig_young.png`, `rig_illustre.png` in `tools/art/rig-out/` (Read tool), apply the check list of the dragon-rig skill ("Authoring a stage", step 3): head red to every horn tip, crest and beard, the neck fading at the shoulders; each wing to its tips and beyond, fading at its shoulder, never on the body or the other wing; the tail yellow hip to tip and never on a leg or a wing tip (the hatchling: no yellow at all); every foot (the hatchling: the whole shell) inside the magenta feet box with nothing coloured in it; the pivots at the neck base, the shoulders, the hip. Move polygon points, ramps and pivots in `rig.json` and re-run `rig bake` + `rig debug --stage <s>` until every point holds. Then:

```bash
tools/art/run_docker.sh rig sheet
STACK=living scripts/npm.sh run test -- src/lib/living
STACK=living scripts/npm.sh run check
```

Expected: `docs/art/dragon-rig.png` shows the five stages; all tests PASS (the new "rigs every hatched stage" included); 0 errors, 0 warnings.

- [ ] **Step 5: Watch each stage in the lab at 1.5x and 3x**

Rebuild the lab (`STACK=living scripts/npm.sh exec -- vite build --config vite.lab.config.ts`), serve it (`python -m http.server 8744 --directory web/dist-lab`, background), and re-run the Task 5 shot script extended to all five tiles, at amplitude 1.5 and at 3 (pause on, times 1.2 s and 3.6 s), with « Parure » on (the young to the ancestral wear the four pieces) and once with « Poids » on. Look at every shot: no tearing, no streak off the outline, no horn or wing tip lagging, the pieces seated (the saddle not stretched), the feet still. Fix the rig and repeat until clean. Keep the server running for Step 7.

- [ ] **Step 6: Write the per-stage notes** in `.claude/skills/dragon-rig/SKILL.md`, a new section "## Stage notes" after "The lab": one line per stage saying what was hard and how it was solved (e.g. the hatchling: no tail region, the shell is the pin; the illustre: the right wing sits behind the neck, keep its polygon off the neck; the ancestral: the head polygon reaches the frame's top so the right horn's tip takes the head's weight).

- [ ] **Step 7: Commit, then STOP for the user**

```bash
git add tools/art/rig.json web/src/lib/living/rig web/src/lib/living/rigs.test.ts docs/art/dragon-rig.png .claude/skills/dragon-rig/SKILL.md
git commit -m "Living dragon, rigs for every hatched stage: the hatchling (no tail shows, its shell is the pin), the young and the illustre, authored on their grids and checked on their debug overlays and live at 1.5x and 3x; docs/art/dragon-rig.png keeps the five views"
```

**STOP (controller):** show the user each stage live: the lab at `http://localhost:8744/lab.html` (served from `web/dist-lab`; rebuild it first if anything changed), the five stages side by side at 1.5x, then each one with « Parure » on, with « Écume » and « Argent », and with « Poids » on; point out the ancestral's horn tip. Also show `docs/art/dragon-rig.png`. Record every change the user asks for (a region, a pivot, the amplitude); loop back to Step 4 for rig changes. **Do not start Task 7 before the user approves the five stages.** Stop the server afterwards.

---

### Task 7: The nest and the camp come alive; the existing e2e adapted; README

**Files:**
- Create: `web/e2e/dragon.ts`
- Modify: `web/src/components/DragonFigure.svelte`, `web/src/components/scene/SceneLayer.svelte`, `web/src/screens/Nest.svelte`, `web/src/screens/Camp.svelte`, `web/src/lib/world/scenes/nest.ts:46-48` and `web/src/lib/world/scenes/camp.ts:155-157` (comments), `web/e2e/scenes-nest.spec.ts`, `web/e2e/scenes-camp.spec.ts`, `web/e2e/scenes-parure.spec.ts`, `web/e2e/world.spec.ts`, `README.md` (a "The living dragon" section)

**Interfaces:**
- Consumes: `LivingDragon.svelte` and its markup contract (Task 5); `livingStage`, `type LivingStage`, `type Motion` (Task 3).
- Produces: `DragonFigure` prop `living?: LivingStage | null` (default `null`: today's markup) and `data-motion` (`pending` | `living` | `still`) on `.dragon-figure`; `SceneLayer` prop `living?: LivingStage | null`. e2e helpers (`web/e2e/dragon.ts`): `type Settled = 'living' | 'still'`, `settledDragon(layer: Locator): Promise<Settled>`, `dragonSrc(layer): Promise<string | null>`, `dragonFilter(layer): Promise<string>`, `dragonWorn(layer): Promise<string[]>`, `webgl2Available(page: Page): Promise<boolean>`, `isolateDragon(page: Page, sceneId: string, layerTestId: string): Promise<void>`, `interface Region { x0: number; y0: number; x1: number; y1: number }` (fractions of a screenshot), `compareShots(page: Page, a: Buffer, b: Buffer, region?: Region): Promise<{ maxDiff: number; meanA: number[]; meanB: number[] }>`.

- [ ] **Step 1: Write the e2e helpers**

```ts
// web/e2e/dragon.ts
// The dragon on the nest's and the camp's layer is either living (a canvas in div.dragon-living, spec
// 2026-10-02 living dragon) or the still picture (img.dragon-base + img.dragon-overlay): which one
// depends on the browser's WebGL2, reduced motion and the stage. These helpers wait for it to settle
// and read its picture, tint and pieces from whichever form it took.
import { expect, type Locator, type Page } from '@playwright/test';

export type Settled = 'living' | 'still';

export async function settledDragon(layer: Locator): Promise<Settled> {
  const fig = layer.locator('.dragon-figure');
  await expect(fig).toHaveAttribute('data-motion', /^(living|still)$/);
  return (await fig.getAttribute('data-motion')) as Settled;
}

export async function dragonSrc(layer: Locator): Promise<string | null> {
  return (await settledDragon(layer)) === 'living'
    ? layer.locator('.dragon-base').getAttribute('data-src')
    : layer.locator('img.dragon-base').getAttribute('src');
}

export async function dragonFilter(layer: Locator): Promise<string> {
  if ((await settledDragon(layer)) === 'living') return (await layer.locator('.dragon-base').getAttribute('data-filter')) ?? '';
  return layer.locator('img.dragon-base').evaluate((el) => (el as HTMLElement).style.filter || 'none');
}

export async function dragonWorn(layer: Locator): Promise<string[]> {
  if ((await settledDragon(layer)) === 'living') {
    const worn = (await layer.locator('.dragon-base').getAttribute('data-worn')) ?? '';
    return worn ? worn.split(' ') : [];
  }
  return layer.locator('img.dragon-overlay').evaluateAll((els) => els.map((e) => e.getAttribute('data-item') ?? ''));
}

export async function webgl2Available(page: Page): Promise<boolean> {
  return page.evaluate(() => document.createElement('canvas').getContext('webgl2') !== null);
}

/** Hides everything of the scene but the dragon's layer (fireflies, hotspots, the painting, the
 *  dialogue), so two screenshots of the dragon differ only by the dragon. */
export async function isolateDragon(page: Page, sceneId: string, layerTestId: string): Promise<void> {
  await page.addStyleTag({
    content: `[data-testid="scene-${sceneId}"] *, [data-testid="dialogue-box"], [data-testid="dialogue-box"] * { visibility: hidden !important; }
      [data-testid="${layerTestId}"], [data-testid="${layerTestId}"] * { visibility: visible !important; }`,
  });
}

export interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The largest channel difference between two PNG screenshots over a region (fractions), and each
 *  one's mean colour there. Decoded in the page: no PNG library in the e2e image. */
export async function compareShots(page: Page, a: Buffer, b: Buffer, region: Region = { x0: 0, y0: 0, x1: 1, y1: 1 }) {
  return page.evaluate(
    async ([a64, b64, r]) => {
      const decode = async (s: string) => {
        const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
        const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const g = c.getContext('2d');
        if (!g) throw new Error('no 2D context');
        g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, bmp.width, bmp.height);
      };
      const [A, B] = await Promise.all([decode(a64), decode(b64)]);
      const w = Math.min(A.width, B.width);
      const h = Math.min(A.height, B.height);
      const [x0, x1, y0, y1] = [Math.floor(r.x0 * w), Math.ceil(r.x1 * w), Math.floor(r.y0 * h), Math.ceil(r.y1 * h)];
      let maxDiff = 0;
      let n = 0;
      const sa = [0, 0, 0];
      const sb = [0, 0, 0];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const ia = (y * A.width + x) * 4;
          const ib = (y * B.width + x) * 4;
          for (let k = 0; k < 3; k++) {
            maxDiff = Math.max(maxDiff, Math.abs(A.data[ia + k] - B.data[ib + k]));
            sa[k] += A.data[ia + k];
            sb[k] += B.data[ib + k];
          }
          n++;
        }
      }
      return { maxDiff, meanA: sa.map((v) => v / n), meanB: sb.map((v) => v / n) };
    },
    [a.toString('base64'), b.toString('base64'), region] as const,
  );
}
```

- [ ] **Step 2: Write the failing WebKit test** (append to `web/e2e/scenes-nest.spec.ts`; import `settledDragon`, `webgl2Available` from `./dragon`)

```ts
// Spec 2026-10-02 living dragon: where the browser offers WebGL2 the hatched dragon lives on a canvas;
// where it does not, it keeps the still picture. The egg never lives. living-dragon.spec.ts proves the
// canvas itself on Chromium.
test('a hatched dragon lives where the browser has WebGL2; the egg is always the still picture', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let stage = 'adult';
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage, name: stage === 'egg' ? null : 'Braise' };
    await route.fulfill({ response: res, json: camp });
  });
  await page.goto(`/#/p/${id}/dragon`);
  await expectScene(page, 'nest');
  const layer = page.getByTestId('nest-dragon-layer');
  const gl = await webgl2Available(page);
  testInfo.annotations.push({ type: 'webgl2', description: String(gl) });
  expect(await settledDragon(layer)).toBe(gl ? 'living' : 'still');
  await expect(layer.locator('.dragon-base')).toHaveCount(1);
  await expect(layer.getByRole('img', { name: 'Braise', exact: true })).toBeVisible();
  stage = 'egg';
  await page.reload();
  await expectScene(page, 'nest');
  expect(await settledDragon(layer)).toBe('still');
  await expect(layer.locator('img.dragon-base')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');
  await expect(layer.locator('canvas')).toHaveCount(0);
});
```

Run: `PW_WORKERS=1 STACK=living scripts/playwright.sh scenes-nest -g "lives where" > /c/Users/nicol/.claude/jobs/9ac9a508/tmp/e2e-t7a.log 2>&1; tail -30 /c/Users/nicol/.claude/jobs/9ac9a508/tmp/e2e-t7a.log`
Expected: FAIL on `desktop` and `ipad` (no `data-motion` on `.dragon-figure`).

- [ ] **Step 3: Wire the living dragon in**

`web/src/components/DragonFigure.svelte` becomes:

```svelte
<script lang="ts">
  // The dragon as drawn on screen (spec 2026-09-29 drachmes §4, R19): its stage picture under the tint's
  // CSS filter, and the pieces it wears on top, unfiltered (a tint recolours the dragon, never its
  // gear). The overlays are percentages of the picture's own box, so the figure scales as one.
  // `className` carries the caller's animation (idle, mood), so the pieces move with the dragon.
  // Spec 2026-10-02 living dragon: given a `living` stage (the nest's and the camp's layers), it mounts
  // LivingDragon in place of the picture; the still markup shows while it loads (`data-motion`
  // pending), goes once its first frame is drawn (living) and stays for good if it fails (still). The
  // egg, reduced motion and every other caller (the battle, the victory, the reveal) pass none.
  import LivingDragon from './LivingDragon.svelte';
  import type { OverlayLayer } from '../lib/world/accessories';
  import type { LivingStage, Motion } from '../lib/living/rigs';

  let {
    src,
    alt,
    filter = 'none',
    overlays = [],
    className = '',
    style = '',
    living = null,
  }: {
    src: string;
    alt: string;
    filter?: string;
    overlays?: OverlayLayer[];
    className?: string;
    style?: string;
    living?: LivingStage | null;
  } = $props();

  let motion = $state<Motion>('pending');
  // Reduced motion lifted (or the egg hatched) after a failure: a fresh try.
  $effect(() => {
    if (!living) motion = 'pending';
  });
  const shown = $derived<Motion>(living ? motion : 'still');
</script>

<div class="dragon-figure {className}" {style} data-motion={shown}>
  {#if living && motion !== 'still'}
    {#key living}
      <LivingDragon stage={living} {src} {alt} {filter} {overlays} onmotion={(m) => (motion = m)} />
    {/key}
  {/if}
  {#if shown !== 'living'}
    <img class="dragon-base" {src} {alt} style:filter draggable="false" />
    {#each overlays as o (o.item)}
      <img
        class="dragon-overlay"
        data-testid="dragon-overlay"
        data-item={o.item}
        src={o.src}
        alt=""
        draggable="false"
        style="left:{o.left}%;top:{o.top}%;width:{o.width}%;height:{o.height}%"
      />
    {/each}
  {/if}
</div>
```

(the `<style>` block stays as it is).

`web/src/components/scene/SceneLayer.svelte`: add to the header comment `The dragon's layer may also be given a living stage (spec 2026-10-02 living dragon): under reduced motion it passes none, so the still picture shows.`; add the prop `living = null` typed `living?: LivingStage | null` (import `type LivingStage` from `../../lib/living/rigs`); pass it on: `<DragonFigure src={layer.src} alt={layer.alt} {filter} {overlays} className={idle} living={rt.reduced ? null : living} />`.

`web/src/screens/Nest.svelte`: import `livingStage` from `../lib/living/rigs`; add `living={livingStage(d.stage)}` to the dragon's `SceneLayer`. `web/src/screens/Camp.svelte`: same import; add `living={livingStage(ctx.camp.dragon.stage)}` to the dragon's `SceneLayer`.

Comments: in `nest.ts` the layer's doc becomes `Depth 0 and no idle on the layer: a parallax or a breath read as floating (playtest 2026-10-02); the hatched dragon moves on its own instead (LivingDragon, spec 2026-10-02 living dragon).`; same change in `camp.ts`.

- [ ] **Step 4: Adapt the existing specs** (import from `./dragon` where used)

- `scenes-nest.spec.ts:179-182` (each stage): replace the `img.dragon-base` src assertion with `await expect.poll(() => dragonSrc(page.getByTestId('nest-dragon-layer'))).toBe(\`/art/dragon/dragon_${key}_cut.webp\`);` and the measured selector `'[data-testid="nest-dragon-layer"] img.dragon-base'` with `'[data-testid="nest-dragon-layer"] .dragon-base'` (both forms are the same square box).
- `scenes-camp.spec.ts:594`: `dragon.locator('img.dragon-base')` becomes `dragon.locator('.dragon-base')`.
- `scenes-camp.spec.ts:610`: becomes `expect(await dragonSrc(page.getByTestId('camp-dragon-layer'))).not.toMatch(/dragon_egg/);`.
- `scenes-camp.spec.ts:789` and `world.spec.ts:259`: become `await expect(page.getByTestId('camp-dragon-layer').getByRole('img', { name: 'Braise', exact: true })).toBeVisible();`.
- `world.spec.ts:218`: becomes `await expect.poll(() => dragonFilter(page.getByTestId('nest-dragon-layer'))).toMatch(/hue-rotate\(190deg\)/);`.
- `scenes-parure.spec.ts:45-51` (the collar in the camp) becomes:

```ts
  const layer = page.getByTestId('camp-dragon-layer');
  await expect.poll(() => dragonWorn(layer)).toEqual(['hydre-cou']);
  // The still picture draws the piece as its own untinted <img> inside the dragon's box; the living
  // canvas draws it untinted from its atlas (living-dragon.spec.ts compares its pixels).
  if ((await settledDragon(layer)) === 'still') {
    const overlay = layer.locator('img.dragon-overlay[data-item="hydre-cou"]');
    await expect(overlay).toHaveAttribute('src', /\/art\/dragon\/accessories\/hydre-cou_(young|adult)\.webp$/);
    await expect(overlay).toHaveCSS('filter', 'none');
    const [base, piece] = [await layer.locator('img.dragon-base').boundingBox(), await overlay.boundingBox()];
    expect(piece!.x).toBeGreaterThanOrEqual(base!.x - 1);
    expect(piece!.x + piece!.width).toBeLessThanOrEqual(base!.x + base!.width + 1);
  }
```

- `scenes-parure.spec.ts:87-88`: `await expect(page.getByTestId('nest-dragon-layer').locator('.dragon-base')).toBeVisible();` and `await expect.poll(() => dragonWorn(page.getByTestId('nest-dragon-layer'))).toEqual([]);`.
- `scenes-parure.spec.ts:102-108`: becomes

```ts
  const layer = page.getByTestId('nest-dragon-layer');
  await expect.poll(() => dragonWorn(layer)).toEqual(['lethe-tete']);
  expect(await dragonFilter(layer)).not.toBe('none');
  if ((await settledDragon(layer)) === 'still') await expect(layer.locator('img.dragon-overlay[data-item="lethe-tete"]')).toHaveCSS('filter', 'none');
  stage = 'egg';
  await page.reload();
  await expect(layer.locator('img.dragon-base')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');
  await expect(layer.locator('img.dragon-overlay')).toHaveCount(0);
```

- `scenes-parure.spec.ts:129`: `'.dragon-figure img.dragon-base'` becomes `'.dragon-figure .dragon-base'`.
- `scenes-parure.spec.ts:160-162`: `await expect.poll(() => dragonWorn(layer)).toEqual(['hydre-cou']);` (one line replaces both counts).
- Unchanged, and why: `scenes-nest.spec.ts:28`, `scenes-camp.spec.ts:383`, `world.spec.ts:72`, `scenes-parure.spec.ts:107-108` (the egg: always the still picture); `scenes-camp.spec.ts:779, 820` and `scenes-parure.spec.ts:79-80` (the reveal's and the victory's `Dragon.svelte`: never living).

- [ ] **Step 5: Run the unit gate and the touched e2e**

Run: `STACK=living scripts/npm.sh run check`, `STACK=living scripts/npm.sh run test`, then
`PW_WORKERS=1 STACK=living scripts/playwright.sh scenes-nest scenes-camp scenes-parure world > /c/Users/nicol/.claude/jobs/9ac9a508/tmp/e2e-t7.log 2>&1; tail -40 /c/Users/nicol/.claude/jobs/9ac9a508/tmp/e2e-t7.log`
Expected: 0 errors, 0 warnings; all PASS on `desktop` and `ipad`. Read the `webgl2` annotation of the new test (in the log or the report) and write in the commit message which form WebKit gave on each project. If WebKit has WebGL2 and something renders or behaves differently there (a blank box, a slow suite), stop and report rather than loosen a test.

- [ ] **Step 6: README**

In `README.md`, after "### The accessory overlays" and before "### Art and sound", add:

```markdown
### The living dragon

In the nest and on the camp, the hatched dragon moves slowly and slightly: head, wings, tail and
breath, on periods that never line up, its feet still and its pieces riding along as rigid
passengers. One WebGL2 canvas per dragon draws its single sprite on a 64 x 64 mesh skinned by six
bones (`web/src/lib/living/`, `components/LivingDragon.svelte`); the tint is `TINT_FILTERS` turned
into colour matrices, on the dragon only. The egg, reduced motion, a browser without WebGL2, a lost
context or a shader that fails keep the still picture. The rigs are hand-authored in
`tools/art/rig.json` and baked by `tools/art/run_docker.sh rig bake` into
`web/src/lib/living/rig/` (the `dragon-rig` skill); the lab page (`web/lab.html`, built by
`vite.lab.config.ts`, never shipped) shows every stage live.
```

- [ ] **Step 7: Commit**

```bash
git add web/e2e/dragon.ts web/e2e/scenes-nest.spec.ts web/e2e/scenes-camp.spec.ts web/e2e/scenes-parure.spec.ts web/e2e/world.spec.ts web/src/components/DragonFigure.svelte web/src/components/scene/SceneLayer.svelte web/src/screens/Nest.svelte web/src/screens/Camp.svelte web/src/lib/world/scenes/nest.ts web/src/lib/world/scenes/camp.ts README.md
git commit -m "The nest and the camp come alive: DragonFigure mounts LivingDragon for a hatched stage (none under reduced motion, none for the egg) and keeps today's markup while it loads and when it fails; the specs read the dragon's picture, tint and pieces through helpers that accept either form, and WebKit shows the canvas exactly where it has WebGL2 (desktop: <form>, ipad: <form>)"
```

---

### Task 8: The canvas e2e on Chromium with WebGL2

**Files:**
- Create: `web/e2e/living-dragon.spec.ts`
- Modify: `web/playwright.config.ts`

**Interfaces:**
- Consumes: the helpers of Task 7 (`web/e2e/dragon.ts`); the baked rigs' `feet` (Task 3/6 JSON); `TINT_FILTERS` (`web/src/lib/world/dragon.ts`); `ACCESSORY_MANIFEST` (`web/src/lib/world/accessories.ts`); `createProfileApi`, `expectCamp`, `expectScene`, `heroNamer` (`web/e2e/helpers.ts`); `test`, `expect` (`web/e2e/crashGuard.ts`).
- Produces: the `chromium-gl` project.

- [ ] **Step 1: Add the project**

In `web/playwright.config.ts`, extend the header comment with: `` `chromium-gl` runs living-dragon.spec.ts on Chromium with SwiftShader's WebGL2 (spec 2026-10-02 living dragon: the canvas, its frames, its tint, its failures); the WebKit projects may lack WebGL2, so `desktop` leaves that spec out. ``; give the `desktop` project `testIgnore: ['**/playability*.spec.ts', '**/voice-*.spec.ts', '**/living-dragon.spec.ts']` (a project's `testIgnore` replaces the top-level one); add after the `chromium` project:

```ts
    {
      name: 'chromium-gl',
      testMatch: ['**/living-dragon.spec.ts'],
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } },
    },
```

- [ ] **Step 2: Write the spec**

```ts
// web/e2e/living-dragon.spec.ts
// Spec 2026-10-02 living dragon, "Tests" (e2e) and the plan's Review Focus: the nest and the camp draw a
// hatched dragon on a canvas and the egg as the still picture; reduced motion and no WebGL2 keep the
// still picture; the worn pieces are listed; two frames differ over time and the feet do not; the tint
// matches the still picture's CSS filter and never touches the pieces; a lost context or a failing
// shader fall back; the loop stops when hidden or off-screen; twenty visits never exhaust contexts.
// chromium-gl only (SwiftShader WebGL2).
import type { Page } from '@playwright/test';
import { test, expect } from './crashGuard';
import { createProfileApi, expectCamp, expectScene, heroNamer } from './helpers';
import { compareShots, dragonFilter, dragonWorn, isolateDragon, settledDragon } from './dragon';
import { TINT_FILTERS } from '../src/lib/world/dragon';
import MANIFEST from '../src/lib/world/accessories.json';
import hatchling from '../src/lib/living/rig/dragon_hatchling.json';
import young from '../src/lib/living/rig/dragon_young.json';
import adult from '../src/lib/living/rig/dragon_adult.json';
import illustre from '../src/lib/living/rig/dragon_illustre.json';
import ancestral from '../src/lib/living/rig/dragon_ancestral.json';

const heroName = heroNamer('Vivant');
const RIGS = { hatchling, young, adult, illustre, ancestral };
const nest = (page: Page) => page.getByTestId('nest-dragon-layer');
const figure = (page: Page) => nest(page).locator('.dragon-figure');
const frames = (page: Page) => nest(page).locator('canvas').evaluate((c) => Number((c as HTMLCanvasElement).dataset.frames ?? 0));

/** This hero's camp says: the dragon as `dragon()` returns it now (stage, tint, worn...). */
async function mockDragon(page: Page, id: number, dragon: () => Record<string, unknown>) {
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, name: 'Braise', ...dragon() };
    await route.fulfill({ response: res, json: camp });
  });
}

async function openNest(page: Page, id: number) {
  await page.goto(`/#/p/${id}/dragon`);
  await page.reload();
  await expectScene(page, 'nest');
}

test('the hatched dragon lives on a canvas in the nest and the camp; the egg stays the still picture', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let stage = 'adult';
  await mockDragon(page, id, () => ({ stage }));
  await openNest(page, id);
  expect(await settledDragon(nest(page))).toBe('living');
  await expect(nest(page).locator('canvas')).toHaveCount(1);
  await expect(nest(page).locator('img.dragon-base')).toHaveCount(0);
  await expect(nest(page).getByRole('img', { name: 'Braise', exact: true })).toBeVisible();
  await page.goto(`/#/p/${id}/camp`);
  await expectCamp(page);
  const camp = page.getByTestId('camp-dragon-layer');
  expect(await settledDragon(camp)).toBe('living');
  stage = 'egg';
  await page.reload();
  await expectCamp(page);
  expect(await settledDragon(camp)).toBe('still');
  await expect(camp.locator('img.dragon-base')).toHaveAttribute('src', '/art/dragon/dragon_egg_cut.webp');
  await expect(camp.locator('canvas')).toHaveCount(0);
});

test('reduced motion and a browser without WebGL2 keep the still picture, its tint and its pieces', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult', tint: 'braise', worn: ['hydre-cou'] }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openNest(page, id);
  expect(await settledDragon(nest(page))).toBe('still');
  await expect(nest(page).locator('canvas')).toHaveCount(0);
  await expect(nest(page).locator('img.dragon-base')).toHaveAttribute('src', '/art/dragon/dragon_adult_cut.webp');
  await expect(nest(page).locator('img.dragon-overlay[data-item="hydre-cou"]')).toHaveCSS('filter', 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return type === 'webgl2' ? null : (get as (...a: unknown[]) => unknown).call(this, type, ...rest);
    };
  });
  await openNest(page, id);
  expect(await settledDragon(nest(page))).toBe('still');
  await expect(nest(page).locator('img.dragon-overlay[data-item="hydre-cou"]')).toHaveCount(1);
  expect(await dragonFilter(nest(page))).toBe(TINT_FILTERS.braise);
});

test('the worn pieces are listed on the canvas, back to front', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult', worn: ['echo-tete', 'hydre-cou', 'lethe-queue', 'sirenes-dos'] }));
  await openNest(page, id);
  expect(await settledDragon(nest(page))).toBe('living');
  expect(await dragonWorn(nest(page))).toEqual(['lethe-queue', 'sirenes-dos', 'hydre-cou', 'echo-tete']);
  await expect(nest(page).locator('img.dragon-overlay')).toHaveCount(0);
});

test('each stage moves over time, and its feet never do', async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let stage = 'hatchling';
  await mockDragon(page, id, () => ({ stage }));
  for (const [key, rig] of Object.entries(RIGS)) {
    stage = key;
    await openNest(page, id);
    expect(await settledDragon(nest(page)), key).toBe('living');
    await isolateDragon(page, 'nest', 'nest-dragon-layer');
    const box = nest(page).locator('.dragon-base');
    const first = await box.screenshot();
    await expect.poll(async () => (await compareShots(page, first, await box.screenshot())).maxDiff, { message: `${key} moves`, timeout: 15_000 }).toBeGreaterThan(24);
    const later = await box.screenshot();
    const [x0, y0, x1] = rig.feet;
    const feet = await compareShots(page, first, later, { x0: x0 / 1024, y0: (y0 + 16) / 1024, x1: x1 / 1024, y1: 1008 / 1024 });
    expect(feet.maxDiff, `${key}: the feet stay put`).toBeLessThanOrEqual(2);
  }
});

test('the tint on the canvas matches the still picture under the same CSS filter, and never touches the pieces', async ({ page, request }, testInfo) => {
  test.setTimeout(240_000);
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let tint = 'bronze';
  await mockDragon(page, id, () => ({ stage: 'adult', tint, worn: ['sirenes-dos'] }));
  const e = MANIFEST['sirenes-dos'].adult;
  // The saddle's box, its inner 60 %: the piece's own pixels on both pictures.
  const saddle = { x0: e.x + 0.2 * e.w, y0: e.y + 0.2 * e.h, x1: e.x + 0.8 * e.w, y1: e.y + 0.8 * e.h };
  for (const t of Object.keys(TINT_FILTERS)) {
    tint = t;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openNest(page, id);
    await isolateDragon(page, 'nest', 'nest-dragon-layer');
    await expect(figure(page)).toHaveAttribute('data-motion', 'still');
    const still = await nest(page).locator('.dragon-base').screenshot();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(figure(page)).toHaveAttribute('data-motion', 'living');
    const living = await nest(page).locator('.dragon-base').screenshot();
    const whole = await compareShots(page, still, living);
    for (let k = 0; k < 3; k++) expect(Math.abs(whole.meanA[k] - whole.meanB[k]), `${t}: channel ${k} over the dragon`).toBeLessThan(2.5);
    const piece = await compareShots(page, still, living, saddle);
    for (let k = 0; k < 3; k++) expect(Math.abs(piece.meanA[k] - piece.meanB[k]), `${t}: channel ${k} over the saddle`).toBeLessThan(4);
  }
});

test('a lost context brings the still picture back, never a blank box', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await openNest(page, id);
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await nest(page).locator('canvas').evaluate((c) => (c as HTMLCanvasElement).getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext());
  await expect(figure(page)).toHaveAttribute('data-motion', 'still');
  await expect(nest(page).locator('img.dragon-base')).toBeVisible();
  await expect(nest(page).locator('canvas')).toHaveCount(0);
});

test('a shader that fails to compile leaves the still picture', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await page.addInitScript(() => {
    const get = WebGL2RenderingContext.prototype.getShaderParameter;
    WebGL2RenderingContext.prototype.getShaderParameter = function (this: WebGL2RenderingContext, s: WebGLShader, p: number) {
      return p === this.COMPILE_STATUS ? false : get.call(this, s, p);
    };
  });
  await openNest(page, id);
  expect(await settledDragon(nest(page))).toBe('still');
  await expect(nest(page).locator('img.dragon-base')).toBeVisible();
});

test('the loop stops when the page is hidden or the dragon off-screen, and never draws past 30 fps', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await openNest(page, id);
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  const n0 = await frames(page);
  await page.waitForTimeout(2000);
  const n1 = await frames(page);
  expect(n1 - n0, 'frames in 2 s').toBeLessThanOrEqual(64);
  expect(n1 - n0, 'frames in 2 s').toBeGreaterThanOrEqual(10);
  const setHidden = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
  await setHidden(true);
  const hidden = await frames(page);
  await page.waitForTimeout(1000);
  expect(await frames(page), 'no frame while hidden').toBe(hidden);
  await setHidden(false);
  await expect.poll(() => frames(page)).toBeGreaterThan(hidden);
  await nest(page).evaluate((el) => ((el as HTMLElement).style.transform = 'translate(-5000px, 0)'));
  await page.waitForTimeout(300);
  const away = await frames(page);
  await page.waitForTimeout(1000);
  expect(await frames(page), 'no frame while off-screen').toBe(away);
  await nest(page).evaluate((el) => ((el as HTMLElement).style.transform = ''));
  await expect.poll(() => frames(page)).toBeGreaterThan(away);
});

test('twenty visits between the camp and the nest never run out of WebGL contexts', async ({ page, request }, testInfo) => {
  test.setTimeout(180_000);
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (/WebGL|context/i.test(m.text())) warnings.push(m.text());
  });
  for (let i = 0; i < 20; i++) {
    await page.goto(`/#/p/${id}/camp`);
    await expectCamp(page);
    await expect(page.getByTestId('camp-dragon-layer').locator('.dragon-figure')).toHaveAttribute('data-motion', 'living');
    await page.goto(`/#/p/${id}/dragon`);
    await expectScene(page, 'nest');
    await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  }
  expect(warnings).toEqual([]);
});

test('a tint picked in the care panel recolours the living dragon in place', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  let tint = 'bronze';
  let dragon: Record<string, unknown> = {};
  await page.route(`**/api/profiles/${id}/camp`, async (route) => {
    const res = await route.fetch();
    const camp = await res.json();
    camp.dragon = { ...camp.dragon, stage: 'adult', name: 'Braise', tint, unlocked_tints: ['bronze', 'ecume'] };
    dragon = camp.dragon;
    await route.fulfill({ response: res, json: camp });
  });
  await page.route(`**/api/profiles/${id}/dragon`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    tint = 'ecume';
    await route.fulfill({ json: { ...dragon, tint } });
  });
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await nest(page).locator('canvas').evaluate((c) => ((c as HTMLCanvasElement).dataset.mark = 'first'));
  await page.getByTestId('dragon-tint-ecume').click();
  await expect.poll(() => dragonFilter(nest(page))).toBe(TINT_FILTERS.ecume);
  await expect(nest(page).locator('canvas')).toHaveAttribute('data-mark', 'first');
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
});

test('a piece put on in the care panel rides the living dragon at once', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  const piece = (item: string, equipped: boolean) => ({
    id: `accessory:${item}`, kind: 'accessory', name: item, desc: '', source: 'stall', granted_at: '2026-08-03T10:00:00', equipped,
  });
  await mockDragon(page, id, () => ({ stage: 'adult', worn: [] }));
  await page.route(`**/api/profiles/${id}/rewards`, (route) => route.fulfill({ json: [piece('hydre-cou', false)] }));
  await page.route(`**/api/profiles/${id}/rewards/accessory:hydre-cou`, (route) => route.fulfill({ json: piece('hydre-cou', true) }));
  await page.goto(`/#/p/${id}/dragon?panel=soin`);
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await nest(page).locator('canvas').evaluate((c) => ((c as HTMLCanvasElement).dataset.mark = 'first'));
  await page.getByTestId('overlay-care').getByTestId('parure-hydre-cou').click();
  await expect.poll(() => dragonWorn(nest(page))).toEqual(['hydre-cou']);
  await expect(nest(page).locator('canvas')).toHaveAttribute('data-mark', 'first');
});

test('reduced motion switched on and off swaps the canvas and the still picture, one at a time', async ({ page, request }, testInfo) => {
  const id = await createProfileApi(request, heroName(testInfo.project.name));
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await openNest(page, id);
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(figure(page)).toHaveAttribute('data-motion', 'still');
  await expect(nest(page).locator('canvas')).toHaveCount(0);
  await expect(nest(page).locator('.dragon-base')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(figure(page)).toHaveAttribute('data-motion', 'living');
  await expect(nest(page).locator('.dragon-base')).toHaveCount(1);
  await expect(nest(page).locator('canvas')).toHaveCount(1);
});
```

Notes for the implementer: `MANIFEST['sirenes-dos'].adult` is typed from the JSON (no cast needed); if `waitForTimeout` is refused by a lint or a repo rule, replace each with an `expect.poll` over the elapsed time. If the camp's tour or greeting covers the dragon on the first camp visit, keep it (the layer is still asserted by `data-motion`, not by a click).

- [ ] **Step 3: Run it and make it pass**

Run: `PW_WORKERS=1 STACK=living scripts/playwright.sh living-dragon > /c/Users/nicol/.claude/jobs/9ac9a508/tmp/e2e-t8.log 2>&1; tail -60 /c/Users/nicol/.claude/jobs/9ac9a508/tmp/e2e-t8.log`
Expected: every test PASS on `chromium-gl` (and the spec runs on no other project). A failure is a bug in Tasks 4-7 or in a rig: fix the code or the rig (systematic-debugging), never widen a tolerance without a measured reason written next to it. Then `STACK=living scripts/npm.sh run check` (the e2e tsc): 0 errors, 0 warnings.

- [ ] **Step 4: Commit**

```bash
git add web/e2e/living-dragon.spec.ts web/playwright.config.ts
git commit -m "Living dragon e2e on Chromium with SwiftShader WebGL2: a canvas for a hatched dragon and the still picture for the egg, under reduced motion and without WebGL2; the pieces listed back to front; every stage moves while its feet do not; the canvas's tint matches the CSS filter and leaves the saddle untinted; a lost context or a failing shader fall back; no frame while hidden or off-screen, at most 30 fps; twenty visits keep their contexts; tint and pieces change in place"
```

---

### Task 9: Full gate and STOP for the human look

**Files:** none new (fixes only, if the gate finds anything).

- [ ] **Step 1: The unit gate**

Run: `STACK=living scripts/npm.sh run check` and `STACK=living scripts/npm.sh run test`
Expected: 0 errors, 0 warnings; every test PASS, with no warning line in the output.

- [ ] **Step 2: The whole e2e suite** (once, background, one worker)

Run: `PW_WORKERS=1 STACK=living scripts/playwright.sh > /c/Users/nicol/.claude/jobs/9ac9a508/tmp/e2e-full.log 2>&1` (run_in_background), then `tail -80` the log.
Expected: every test PASS on `desktop`, `ipad`, `chromium` and `chromium-gl`. Any failure, flaky or not, is a finding to fix (CLAUDE.md), whether or not this branch touched its spec.

- [ ] **Step 3: Commit any fix** (with its own message saying what failed and why), then STOP.

**STOP (controller): the human look in the browser.** Build the game and the lab, serve the lab (`STACK=living scripts/npm.sh exec -- vite build --config vite.lab.config.ts`; `python -m http.server 8744 --directory web/dist-lab`, background), and bring up the game where the user can play it (the dev stack, `STACK=living DEV_WEB_PORT=5174 DEV_API_PORT=8081 scripts/dev.sh`, or the user's usual way). Show the user:
1. the nest and the camp with a hatched dragon (each stage, by the user's own hero or by the lab), its pieces on, under two or three tints;
2. the « écume » tint by eye (the spec's open item: a blue leaning towards periwinkle, outside the violet band the tests guard);
3. reduced motion on (the still picture) and the egg.
Record the user's verdict. Merge into `master` only once the user approves (merging into master is pre-authorized after that approval; never push).

---

## Self-review

- **Spec coverage.** What she sees: motion and amplitude (Task 2, constants and tests), five stages (Tasks 3, 6), feet (Tasks 3, 6 unit; Task 8 e2e), pieces rigid (Task 4 unit, Task 8 e2e), tint (Task 1 unit, Task 8 e2e), fallbacks (Task 7 wiring, Task 8 e2e). How: technique (Tasks 2, 4), rigs and baker (Tasks 3, 6), the horn tip (Task 3 test), pieces in `DRAW_ORDER` (Task 4), tint from `TINT_FILTERS` (Tasks 1, 4), component and wrapper, `role="img"`, `aria-label`, `data-worn` (Tasks 5, 7), battle untouched (Task 7: only nest/camp pass `living`), cost control (Tasks 2, 5, 8), tooling into a skill (Task 3, R7). Tests: unit (Tasks 1-4, 6), e2e (Tasks 7, 8), the human look (Tasks 6, 9). Out of scope respected. The écume open item is shown in Task 9.
- **Placeholders.** The `<form>` in Task 7's commit message is filled from the run's annotation (measured, not known in advance); the three new rigs carry starting values to be corrected by eye, with a check list as acceptance.
- **Type consistency.** `Motion`, `LivingStage`, `Rig`, `RigFile`, `Pivots`, `PieceDraw`, `PiecePlacement`, `DragonRenderer` methods, the helpers' names are the same in every task that names them.
