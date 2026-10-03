# The living battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In battle, the seven antagonists (and Éris's flustered pose) and the hero's hatched dragon move slowly and slightly on the living dragon's WebGL2 mesh skinning, and both fighters are drawn bigger without covering the battle's UI.

**Architecture:** The living engine (`web/src/lib/living/`) is generalised from "a dragon stage" to "a rig": six bone slots per rig (four rigid ones named per creature, then `chest` and `lift`, the shader's packing unchanged), the motion described as data (`pose.ts` `poseFor(CreatureMotion)`; the dragon's table reproduces today's `poseAt`; the foes' tables in `foes.ts`), and the 585 x 1024 portraits padded, centred, into the 1024 frame by the baker and at load time. `LivingDragon` takes a `rig` (a dragon stage or a foe), a nullable tint and a box of the portrait's aspect; `DragonFigure`'s living path serves the battle's `Combatant` for both fighters. Eight rigs are hand-authored in `tools/art/rig.json`, baked by `tools/art/rig.py` into `web/src/lib/living/rig/foe_<id>.json`, checked on debug overlays and lab frames; the battle's CSS sizes each fighter from its side column, measured on screenshots at three viewports.

**Tech Stack:** Svelte 5 (runes), TypeScript, WebGL2, Vite (lazy JSON chunks via `import.meta.glob`), vitest, Playwright (chromium-gl project, SwiftShader), Python 3.12 + numpy/scipy/Pillow in the art tools' container (`tools/art/run_docker.sh rig ...`).

**Spec:** `docs/superpowers/specs/2026-10-03-living-battle-design.md` (binding). It builds on `docs/superpowers/specs/2026-10-02-living-dragon-design.md` and its plan `docs/superpowers/plans/2026-10-02-living-dragon.md` (Rulings R1-R8, L1-L10), whose shipped code is the reference.

## Global Constraints

- CLAUDE.md: no "pre-existing" problems (fix it, or report it as an open item; never dismiss it); vitest and `svelte-check` clean with **zero errors and zero warnings**; the e2e `tsc` clean; **no emoji** anywhere the player can see (and none in the lab page either).
- At most 6 bones per creature; the shader's packing (`aW0` vec4 + `aW1` vec2, `uB[6]`) is unchanged.
- "its feet / base never move": every rig's feet box gets zero weight (unit-tested), and the e2e checks the base region of each opponent's screenshots.
- "Antagonists are never tinted": the foe's canvas runs with no tint and its host carries no `data-tint`; the still picture is untinted (`tint` null) as today.
- "Reduced motion, no WebGL2, a lost context or a failed shader: today's still picture."
- "Mirroring, the hit / taunt / defeat reactions (Web Animations on `.actor`) and Éris's swap to her flustered picture keep working on top of the motion."
- "Cost control as in the nest: 30 fps, paused when hidden; two canvases at most on screen."
- "Today's CSS `idle-breathe` on the combatants goes." Both fighters move "in every phase, not only the muster and the victory".
- New sizes "tuned on screenshots at 1280x720, 1366x1024 and 1024x640 so nothing of the battle UI (HP bars, the dictation and proofreading panels, the dialogue dock, the HUD) is covered and the opponent stays the larger".
- "Out of scope: antagonists outside the battle (war tent, codex, oracle, victory thumbs, portraits); new art; big moves that need the pictures split into parts."
- Rigs: `tools/art/rig.json` holds integers only; the baked `web/src/lib/living/rig/*.json` are never edited by hand; the dragon stages' blocks and baked files stay byte-identical.
- Lazy loading (`web/src/lib/living/lazy.test.ts`): no module outside `living/` imports a `living/` module statically other than `stillTint`, `tint`, `stages`; `stages.ts` imports no other `living/` module; `DragonFigure` imports `LivingDragon` dynamically; Play and Boss stay their own chunk. `stages.ts` may `import type` from elsewhere only. The game's `vite build` prints no warning.
- The e2e specs run in Node: they must never import `web/src/lib/living/stages.ts` or anything that reaches `import.meta.glob` (`rigs.ts`, `foes.ts`); copy a constant with a comment naming its source instead.
- Guards that must stay green: `frenchSpacing`, `literalSpaces`, `noEmoji` (vitest), `lazy.test.ts`, a warning-free game build.
- Git: local only, never push or open a PR. Commit with the attribution trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Commands (this branch's stack is `battle`)

- Unit: `STACK=battle scripts/npm.sh run test` (one file: `STACK=battle scripts/npm.sh run test -- src/lib/living/pose.test.ts`)
- Types: `STACK=battle scripts/npm.sh run check` (0 errors, 0 warnings)
- Game build: `STACK=battle scripts/npm.sh run build` (no warning)
- Lab build: `STACK=battle scripts/npm.sh exec -- vite build --config vite.lab.config.ts`; serve it with `python -m http.server 8745 --directory web/dist-lab` (Bash, `run_in_background`), stop it afterwards.
- e2e (one run per stack, a machine-wide Playwright lock; low RAM): `PW_WORKERS=1 STACK=battle scripts/playwright.sh <spec name filters>`, e.g. `PW_WORKERS=1 STACK=battle scripts/playwright.sh living-battle living-dragon`. Write its output to `C:\Users\nicol\.claude\jobs\9ac9a508\tmp\battle\<name>.log`. If a background shell is reaped for memory, follow the Playwright container with `docker logs -f <container>` instead of rerunning.
- Rig baker: `tools/art/run_docker.sh rig grid|bake|debug|sheet|foe-sheet [--stage K]` (Bash, repo root of this worktree; scratch views land in `tools/art/rig-out/`, gitignored).
- Lab frames: `tools/art/with_lock.sh C:/Users/nicol/.claude/jobs/9ac9a508/tmp/spike-living/.venv/Scripts/python.exe C:/Users/nicol/.claude/jobs/9ac9a508/tmp/battle/lab_foes.py [rig ...]` (the spike's venv has Playwright and its Chromium; the script is written in Task 4).
- Full gate (Task 8 only): `STACK=battle PW_WORKERS=2 scripts/check.sh`.

## Rulings (design choices this plan settles)

- **B1 Bone slots.** Every rig has six slots. Slots 0-3 are rigid bones named per creature (normalised by the baker so they sum to at most 1); slot 4 is always `chest` (the breath's scale) and slot 5 always `lift` (the breath's rise). A rig's slot order is its block's key order in `rig.json`, pinned by a vitest against the creature's motion table. `skin.ts` gains `SLOTS = 6`; `BONES` stays the dragon's names (the atlas's `chest` index holds for every rig). The shader is untouched.
- **B2 The portrait frame.** A foe's 585 x 1024 portrait is padded, centred, into the 1024 frame: left offset `Math.floor((1024 - 585) / 2) = 219` (`skin.ts` `frameOffset`; `rig.py` pastes at `(N - w) // 2`). The mesh, margin, feet box and baker work unchanged. At load, `atlas.ts` `padToFrame` draws the picture into a 1024 square canvas (a mismatched size throws: the still picture). The foe's box keeps the portrait's aspect (`FOE_ASPECT = 585 / 1024`), so the still picture and the canvas take the same place; the square canvas overflows that box sideways (transparent, `pointer-events: none`). A foe's baked file carries `"width": 585`; a dragon's has none (1024).
- **B3 Rig keys and files.** `rig.json` keys are the five dragon stages plus the foes `eris`, `eris_flustered`, `hydre`, `chimere`, `echo`, `lethe`, `protee`, `sirenes` (`stages.ts` `FOE_RIGS`). A foe's block names its sprite (`"sprite": "web/public/art/..."`, part of the bake hash) and is baked to `web/src/lib/living/rig/foe_<id>.json`; the dragon's blocks stay as they are (their sprite path is implied) and re-bake byte-identically. `rig.py --stage K` takes any key.
- **B4 Motion as data.** `pose.ts` describes a creature's idle as a `CreatureMotion`: per rigid bone a `turn` (degrees about its pivot) or a `drift` (frame px), each a sum of sine waves `{ amp, period, phase }`, or `null`; plus one `breath` (period, chest scale x/y, lift px). `poseFor(motion, t, pivots, amplitude)` builds the six matrices; `poseAt` is `poseFor(DRAGON_MOTION, ...)` (today's numbers). The foes' tables live in `foes.ts`; `rigs.ts` `motionOf(id)` picks the table for a rig. All are played at `AMPLITUDE` (1.5x) like the dragon.
- **B5 One living path.** The battle's `Combatant` renders `DragonFigure`'s living path for both fighters (no sibling figure): the WebGL2 probe, the lazy chunk, `data-motion`, the still fallback and the fresh try on a new picture are shared. `LivingDragon`'s prop `stage` becomes `rig: LivingRig`; its `tint` becomes `Tint | null` (null: no tint, no `data-tint`); its box's aspect follows the rig (`FOE_WIDTH` or the frame). `DragonFigure` passes `null` as the tint of a foe rig, whatever its caller gives.
- **B6 Éris routed.** `BattleStage` derives `flustered` once and uses it for both the picture (`ART.erisFlustered`) and the rig (`foeRigFor('eris', true) = 'eris_flustered'`). `DragonFigure`'s `{#key livingNow}` remounts `LivingDragon` on the new rig: a fresh try, the flustered still picture showing while it loads, then her own rig alive. The `.actor`'s held defeat pose (fill forwards) is on the outer element and is never remounted.
- **B7 Every phase.** The combatants live in all four phases (the spec overrides UI4 Ruling C12 for the combatants; the particles keep it). `idle-breathe` and `Combatant`'s `idle` prop go (`kit.css` keeps the class, other kit users may take it). Under reduced motion `living` is null.
- **B8 The battle dragon.** `livingStage(dragon.stage)` (null for the egg), with its tint and its worn pieces, under the same reduced-motion rule.
- **B9 The sizes.** The parchment's width (`min(62vw, 48rem)`) leaves each fighter its side column (`--side`), which binds before the height does. Each fighter fills its column and may tuck under the parchment's edge (the parchment is drawn above the fighters) by a bounded share of its box width: 20 % for the dragon (whose wing tip is on that side), 15 % for the opponent. Starting formulas, defined once on `.battle-stage`: `--foe-h: min((side - 8px) * 2.06, 100vh - feet - top - hold-room)`, `--dragon-h: min((side - 8px) * 1.25, 100vh - dragon-feet - top - 16px)` (2.06 = 1 / (0.5713 x 0.85); 1.25 = 1 / 0.8). Neither fighter passes under the hold bar, the HUD or the exit sign, nor off the screen; the opponent's box is at least 1.15 x the dragon's height; neither is smaller than today at the three viewports. Task 7 tunes the numbers on screenshots and pins the rules in e2e. The compact band is unchanged. Where "fill the stage's height" is not reached (the column binds), the look checklist says so with the measured heights, for the user to decide (a narrower parchment is out of this spec).
- **B10 No STOP.** The spec's STOP before the battle is waived by the user ("Prepare a lab page for the new animations but don't wait for my approval to add them to the game. I will check it last and we can do the small adjustments later."). Rig tasks check themselves on the debug overlays and on lab frames (Playwright screenshots the implementer looks at) and proceed; Task 8 writes the look checklist into the spec.
- **B11 e2e.** A new `web/e2e/living-battle.spec.ts` runs on the `chromium-gl` project (SwiftShader WebGL2) and is left out of `desktop`; the WebKit battle specs read the fighter in either form through `.dragon-base` (`img.dragon-base` or `div.dragon-living.dragon-base`, both with `data-src`). `mockDragon` moves into `web/e2e/dragon.ts`; the victory spec's `progression()` moves into `web/e2e/helpers.ts` as `victoryProgression()`.
- **B12 Two canvases.** The battle shows at most its two fighters' canvases (`.dragon-living canvas`); FxCanvas is a separate 2D layer and is not counted.

## Review Focus

1. **Éris's swap mid-defeat**: the defeat reaction starts, the picture and rig change under the held pose. Expected: the flustered still picture at once (never the standing Éris, never a blank box), then her flustered rig alive, the defeat transform still held. Test: Task 6, "Éris routed swaps to her flustered rig under her held defeat pose".
2. **Many battles in a row** (replays, camp and back, a new opponent): every remount disposes its canvas and context. Expected: no "Too many active WebGL contexts" or context-lost line, never more than two fighter canvases. Test: Task 6, "ten battles in a row never run out of WebGL contexts".
3. **The still-to-living handover keeps the box**: the canvas takes exactly the still picture's place (mirrored too), so nothing jumps when the first frame lands or when reduced motion is switched. Test: Task 7, "the living and the still fighters take the same box".
4. **A foe's rig or chunk fails to load** (a stale cache, a re-cut picture of another size): that fighter settles on its still picture, the other stays alive, `data-motion` never stays `pending`. Test: Task 6, "a foe rig that fails to load leaves the opponent still and the dragon alive"; unit: Task 1 `decodeRig` refuses a width over the frame, Task 3 `padToFrame` throws on a size mismatch (exercised by the same e2e path).
5. **The keyboard folds the stage** (compact band) while both fighters live: the canvases resize with their boxes and stay inside the band. Test: Task 6, "the keyboard's compact band keeps both fighters alive inside it".

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `web/src/lib/living/skin.ts` | `SLOTS`, `frameOffset`; loops over slots | 1 |
| `web/src/lib/living/pose.ts` | `CreatureMotion`, `poseFor`, `DRAGON_MOTION`, `poseAt` | 1 |
| `web/src/lib/living/foes.ts` (new) | `FOE_MOTIONS`, `FOE_SPRITES` (lazy) | 1 |
| `web/src/lib/living/stages.ts` | `FOE_RIGS`, `FoeRig`, `LivingRig`, `FOE_WIDTH`, `FOE_ASPECT`, `isFoeRig`, `isLivingRig`, `livingFoe`, `foeRigFor` (eager) | 1 |
| `web/src/lib/living/rigs.ts` | loaders for `dragon_*` and `foe_*`, `decodeRig` with bones/motion/width, `motionOf` | 1 |
| `web/src/lib/living/atlas.ts` | `padToFrame` | 1 |
| `web/src/lib/living/{skin,pose,foes,rigs}.test.ts` | unit tests | 1, 2, 4, 5 |
| `tools/art/rig.py`, `tools/art/rig.json` | baker for foes (padding, polys, per-rig bones, foe files, foe sheet); the eight foe rigs | 2, 4, 5 |
| `web/src/lib/living/rig/foe_<id>.json` (new, baked) | the foes' weights | 4, 5 |
| `docs/art/foe-rig.png` (new) | the foes' debug views, for the record | 5 |
| `web/src/components/LivingDragon.svelte` | `rig`, nullable tint, portrait box, padded sprite, `poseFor` | 3 |
| `web/src/components/DragonFigure.svelte` | `living?: LivingRig`, null tint for foes | 3 |
| `web/src/lab/DragonLab.svelte`, `web/src/lab/TintPanel.svelte` | « Les adversaires » section; `rig=` | 3 |
| `web/src/components/battle/Combatant.svelte` | living figure, `aspect`, no `idle` | 6 |
| `web/src/components/battle/BattleStage.svelte` | living rigs for both fighters, flustered rig; sizes | 6, 7 |
| `web/e2e/living-battle.spec.ts` (new) | battle canvases, fallbacks, motion, reactions, layout | 6, 7 |
| `web/e2e/dragon.ts`, `web/e2e/helpers.ts`, `web/e2e/living-dragon.spec.ts`, `web/e2e/scenes-battle-victory.spec.ts`, `web/e2e/scenes-battle-play.spec.ts`, `web/e2e/playability-ui4.spec.ts`, `web/playwright.config.ts` | helpers moved, either-form selectors, project wiring | 6 |
| `.claude/skills/dragon-rig/SKILL.md` | foes: commands, bones, notes | 4, 5 |
| `docs/superpowers/specs/2026-10-03-living-battle-design.md` | status, open items, the look checklist | 8 |

## Execution

| Task | What | Model | Why |
|---|---|---|---|
| 1 | Engine: slots, motion as data, foe ids, padded frame | opus | Refactors tested engine code every later task relies on |
| 2 | Baker for foes; rig tests generalised | sonnet | Mechanical Python + test rewrite, byte-identity gate |
| 3 | LivingDragon / DragonFigure / lab for any rig | opus | Lifecycle code, layout maths, regression on the nest |
| 4 | Rigs I: Éris, Éris flustered, Hydre, Chimère | opus | Visual judgement on overlays and frames |
| 5 | Rigs II: Écho, Léthé, Protée, Sirènes; all-foes gate | opus | Visual judgement |
| 6 | The battle alive; e2e | opus | Integration, fallbacks, reactions |
| 7 | Bigger fighters; layout e2e | opus | Screenshot-tuned CSS |
| 8 | Full gate, docs, look checklist | sonnet | Verification and writing |

---

### Task 1: The engine for any rig (slots, motion as data, foe ids, padded frame)

**Files:**
- Modify: `web/src/lib/living/skin.ts`, `web/src/lib/living/pose.ts`, `web/src/lib/living/stages.ts`, `web/src/lib/living/rigs.ts`, `web/src/lib/living/atlas.ts`
- Create: `web/src/lib/living/foes.ts`, `web/src/lib/living/foes.test.ts`
- Test: `web/src/lib/living/skin.test.ts`, `web/src/lib/living/pose.test.ts`, `web/src/lib/living/rigs.test.ts`

**Interfaces:**
- Consumes: today's `skin.ts` (`FRAME`, `GRID`, `VERTS`, `CELL`, `MARGIN`, `BONES`, `rotAbout`, `scaleAbout`, `translate`, `Affine`, `Point`), `stages.ts` (`LIVING_STAGES`, `LivingStage`, `livingStage`, `hasWebGL2`, `Motion`), `ART` (`web/src/lib/world/art.ts`), `OpponentId` (`web/src/lib/battle/battle.ts`).
- Produces:
  - `skin.ts`: `SLOTS: 6`; `frameOffset(width: number): number`.
  - `pose.ts`: `AMPLITUDE = 1.5`; `type Pivots = Record<string, Point>`; `interface Wave { amp: number; period: number; phase: number }`; `type BoneMotion = { kind: 'turn'; waves: readonly Wave[] } | { kind: 'drift'; x: readonly Wave[]; y: readonly Wave[] }`; `interface Breath { period: number; sx: number; sy: number; lift: number }`; `interface CreatureMotion { rigid: readonly [string, string, string, string]; moves: Readonly<Record<string, BoneMotion | null>>; breath: Breath }`; `BREATH_BONES = ['chest', 'lift'] as const`; `bonesOf(m: CreatureMotion): readonly string[]`; `waveSum(waves: readonly Wave[], t: number): number`; `poseFor(m: CreatureMotion, t: number, pivots: Pivots, amplitude?: number): Float32Array`; `DRAGON_MOTION: CreatureMotion`; `poseAt(t, pivots, amplitude?)` (unchanged behaviour); `FPS`, `frameDue` (unchanged).
  - `foes.ts`: `FOE_MOTIONS: Record<FoeRig, CreatureMotion>`; `FOE_SPRITES: Record<FoeRig, string>` (the game's URLs).
  - `stages.ts`: `FOE_RIGS`, `type FoeRig`, `type LivingRig = LivingStage | FoeRig`, `FOE_WIDTH = 585`, `FOE_ASPECT = 585 / 1024`, `isFoeRig(r: string): r is FoeRig`, `isLivingRig(r: string): r is LivingRig`, `livingFoe(rig: FoeRig): FoeRig | null`, `foeRigFor(opponent: OpponentId, flustered: boolean): FoeRig`.
  - `rigs.ts`: `interface RigFile { stage: string; source: string; grid: number; width?: number; pivots: Record<string, [number, number]>; feet: [number, number, number, number]; weights: string }`; `interface Rig { id: LivingRig; bones: readonly string[]; motion: CreatureMotion; width: number; pivots: Pivots; feet: readonly [number, number, number, number]; weights: Uint8Array }`; `decodeRig(f: RigFile): Rig`; `loadRig(id: LivingRig): Promise<Rig>`; `motionOf(id: LivingRig): CreatureMotion`; re-exports `FOE_RIGS, FOE_WIDTH, LIVING_STAGES, isFoeRig, livingFoe, livingStage, type FoeRig, type LivingRig, type LivingStage, type Motion` from `stages.ts`.
  - `atlas.ts`: `padToFrame(img: HTMLImageElement, width: number): TexImageSource`.

- [ ] **Step 1: Write the failing tests**

Append to `web/src/lib/living/skin.test.ts` (add `SLOTS`, `frameOffset` to its import from `./skin`):

```ts
describe('the frame and its slots', () => {
  it('centres a narrower portrait in whole px, as tools/art/rig.py pads it', () => {
    expect(frameOffset(1024)).toBe(0);
    expect(frameOffset(585)).toBe(219);
    expect(() => frameOffset(1100)).toThrow();
    expect(() => frameOffset(0)).toThrow();
  });

  it("has six slots, the dragon's bones ending with the breath's two", () => {
    expect(SLOTS).toBe(6);
    expect(BONES).toHaveLength(SLOTS);
    expect(BONES.slice(4)).toEqual(['chest', 'lift']);
  });
});
```

Append to `web/src/lib/living/pose.test.ts` (extend the imports: `import { AMPLITUDE, BREATH_BONES, DRAGON_MOTION, bonesOf, frameDue, poseAt, poseFor, type CreatureMotion, type Pivots, type Wave } from './pose';`, `import { FOE_MOTIONS } from './foes';`, `import { FOE_RIGS } from './stages';`):

```ts
describe('the motion tables', () => {
  it("plays the dragon's table exactly as poseAt", () => {
    for (const t of [0, 1.3, 7.7, 41.9]) expect(poseFor(DRAGON_MOTION, t, PIVOTS)).toEqual(poseAt(t, PIVOTS));
    expect(bonesOf(DRAGON_MOTION)).toEqual(['head', 'wingL', 'wingR', 'tail', 'chest', 'lift']);
  });
});

const spread = (waves: readonly Wave[]) => waves.reduce((s, w) => s + Math.abs(w.amp), 0);
const pivotsFor = (m: CreatureMotion): Pivots => Object.fromEntries(bonesOf(m).map((b, i) => [b, [300 + 40 * i, 200 + 90 * i] as const]));

describe.each(FOE_RIGS)('%s: the idle motion', (id) => {
  const m = FOE_MOTIONS[id];
  const pivots = pivotsFor(m);

  it('names four rigid bones, then the breath, and a motion (or none) for each rigid bone', () => {
    expect(bonesOf(m)).toHaveLength(6);
    expect(bonesOf(m).slice(4)).toEqual([...BREATH_BONES]);
    expect(new Set(m.rigid).size).toBe(4);
    expect(Object.keys(m.moves).sort()).toEqual([...m.rigid].sort());
  });

  it('is slow: every period is at least 1.5 s', () => {
    const periods = [m.breath.period, ...Object.values(m.moves).flatMap((mv) => (!mv ? [] : mv.kind === 'turn' ? mv.waves : [...mv.x, ...mv.y]).map((w) => w.period))];
    expect(Math.min(...periods)).toBeGreaterThanOrEqual(1.5);
  });

  it('stays within its amplitudes at 1.5x, and they are slight', () => {
    const peak = [0, 0, 0, 0];
    let chest = 0;
    let lift = 0;
    for (let t = 0; t < 120; t += 0.01) {
      const p = poseFor(m, t, pivots);
      m.rigid.forEach((b, i) => {
        const mv = m.moves[b];
        if (!mv) return;
        const v = mv.kind === 'turn' ? Math.abs(angle(p, i)) : Math.hypot(p[i * 9 + 6], p[i * 9 + 7]);
        peak[i] = Math.max(peak[i], v);
      });
      chest = Math.max(chest, Math.abs(p[4 * 9] - 1), Math.abs(p[4 * 9 + 4] - 1));
      lift = Math.max(lift, Math.abs(p[5 * 9 + 7]));
    }
    m.rigid.forEach((b, i) => {
      const mv = m.moves[b];
      if (!mv) {
        expect(peak[i], `${id} ${b}`).toBe(0);
        return;
      }
      const bound = AMPLITUDE * (mv.kind === 'turn' ? spread(mv.waves) : Math.hypot(spread(mv.x), spread(mv.y)));
      expect(peak[i], `${id} ${b}`).toBeLessThanOrEqual(bound + 1e-6);
      expect(peak[i], `${id} ${b} moves`).toBeGreaterThan(0.6 * bound);
      // Slight: a turn stays under 6 deg and a drift under 12 frame px at 1.5x.
      expect(peak[i], `${id} ${b} is slight`).toBeLessThanOrEqual(mv.kind === 'turn' ? 6 : 12);
    });
    expect(chest).toBeLessThanOrEqual(0.03 + 1e-9);
    expect(lift).toBeLessThanOrEqual(4.5 + 1e-9);
  });

  it('stands still at amplitude 0', () => {
    const p = poseFor(m, 7.7, pivots, 0);
    for (let b = 0; b < 6; b++) expect(Array.from(p.slice(b * 9, b * 9 + 9)).map((v) => (Math.abs(v) < 1e-9 ? 0 : v))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it('never repeats on its breath period', () => {
    const a = poseFor(m, 1, pivots);
    const b = poseFor(m, 1 + m.breath.period, pivots);
    expect(m.rigid.some((_, i) => Math.abs(a[i * 9] - b[i * 9]) + Math.abs(a[i * 9 + 1] - b[i * 9 + 1]) + Math.abs(a[i * 9 + 6] - b[i * 9 + 6]) + Math.abs(a[i * 9 + 7] - b[i * 9 + 7]) > 1e-4)).toBe(true);
  });
});
```

Create `web/src/lib/living/foes.test.ts`:

```ts
// The battle's foes (spec 2026-10-03 living battle; plan Rulings B3, B6): every opponent has a rig of its
// own name, Éris routed has hers, a foe lives only once its rig is baked, and each sprite is the game's.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ART } from '../world/art';
import { LIEUTENANT_ORDER } from '../world/types';
import { FOE_SPRITES } from './foes';
import { FOE_ASPECT, FOE_RIGS, FOE_WIDTH, foeRigFor, isFoeRig, isLivingRig, livingFoe } from './stages';

describe('the foes', () => {
  it('rigs every opponent under its own id, and Éris routed under hers', () => {
    for (const k of [...LIEUTENANT_ORDER, 'eris' as const]) {
      expect(isFoeRig(k), k).toBe(true);
      expect(foeRigFor(k, false)).toBe(k);
    }
    expect(foeRigFor('eris', true)).toBe('eris_flustered');
    expect(foeRigFor('hydre', true)).toBe('hydre');
  });

  it('tells a rig id from anything else', () => {
    expect(isLivingRig('adult')).toBe(true);
    expect(isLivingRig('sirenes')).toBe(true);
    expect(isLivingRig('egg')).toBe(false);
    expect(isLivingRig('griffon')).toBe(false);
  });

  it('lives only once its rig is baked', () => {
    for (const r of FOE_RIGS) expect(livingFoe(r), r).toBe(existsSync(`src/lib/living/rig/foe_${r}.json`) ? r : null);
  });

  it("draws each foe from the game's own picture, a 585 x 1024 portrait", () => {
    expect(FOE_SPRITES.eris).toBe(ART.eris);
    expect(FOE_SPRITES.eris_flustered).toBe(ART.erisFlustered);
    for (const k of LIEUTENANT_ORDER) expect(FOE_SPRITES[k]).toBe(ART.lieutenants[k]);
    expect(Object.keys(FOE_SPRITES).sort()).toEqual([...FOE_RIGS].sort());
    expect(FOE_WIDTH).toBe(585);
    expect(FOE_ASPECT).toBeCloseTo(585 / 1024, 9);
  });
});
```

(If `LIEUTENANT_ORDER` is not exported from `web/src/lib/world/types.ts` under that name, use the name `battle.ts` imports it by: `import { LIEUTENANT_ORDER, ... } from '../world/types'` is what `battle.ts` does today.)

Append to the `describe('the rigs', ...)` block of `web/src/lib/living/rigs.test.ts`:

```ts
  it('refuses a rig whose pivots miss a bone of its creature', () => {
    const f = fileOf('adult');
    const { head: _gone, ...pivots } = f.pivots;
    expect(() => decodeRig({ ...f, pivots: pivots as typeof f.pivots })).toThrow(/head/);
  });

  it('refuses a rig that is neither a dragon stage nor a foe, or wider than the frame', () => {
    expect(() => decodeRig({ ...fileOf('adult'), stage: 'griffon' })).toThrow(/griffon/);
    expect(() => decodeRig({ ...fileOf('adult'), width: 1100 })).toThrow(/1100/);
  });

  it("decodes a dragon rig with the dragon's bones and the whole frame's width", () => {
    const rig = rigOf('adult');
    expect(rig.id).toBe('adult');
    expect(rig.bones).toEqual(['head', 'wingL', 'wingR', 'tail', 'chest', 'lift']);
    expect(rig.width).toBe(1024);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `STACK=battle scripts/npm.sh run test -- src/lib/living`
Expected: FAIL: `frameOffset`/`SLOTS` not exported, `./foes` not found, `poseFor` not exported, `decodeRig` accepts `griffon`.

- [ ] **Step 3: Implement `skin.ts`**

In `web/src/lib/living/skin.ts`:
- after `export type Bone = ...` add:

```ts
/** Six bone slots for every rig (spec 2026-10-03 living battle, plan Ruling B1): four rigid ones named
 *  per creature, then chest and lift; the shader packs them as a vec4 and a vec2 (renderer.ts). */
export const SLOTS = 6;

/** Where a sprite narrower than the frame sits in it, in whole px: centred (plan Ruling B2;
 *  tools/art/rig.py pastes it at the same offset). */
export function frameOffset(width: number): number {
  if (!(width > 0 && width <= FRAME)) throw new Error(`a sprite ${width} px wide does not fit the ${FRAME} px frame`);
  return Math.floor((FRAME - width) / 2);
}
```

- in `skinPoint`, `weightsAt` and `buildMesh`, replace every `BONES.length` with `SLOTS` (the loop bounds, `new Float32Array(SLOTS)`, the weight index `* SLOTS`, `const o = k * SLOTS`);
- update the `Mesh` field comments: `w0` "slots 0-3 (the rigid bones)", `w1` "slots 4-5 (chest, lift)"; in the header comment, "six bones" stays, add "(slot names per creature: pose.ts)".

- [ ] **Step 4: Implement `pose.ts`**

Replace `web/src/lib/living/pose.ts` with:

```ts
// The living figures' idle motion (spec 2026-10-02 living dragon, "What she sees"; spec 2026-10-03
// living battle, plan Ruling B4): a creature's motion is data. Each rigid bone turns about its pivot
// (degrees) or drifts (frame px), as a sum of sine waves; the breath scales the chest and lifts the body.
// No common period on purpose: a beat that never quite repeats reads as alive rather than as a looping
// gif. The dragon's table is the spike's 1x (breath 4.8 s; the wings follow it with a lag, left and
// right slightly apart; the head on its own 6.2 s sway with a 2.9 s nod; the tail on 3.7 s + 1.9 s);
// the foes' tables are in foes.ts. The game plays them at AMPLITUDE (the user's choice, 1.5x).
import { SLOTS, rotAbout, scaleAbout, translate, type Affine, type Point } from './skin';

export const AMPLITUDE = 1.5;
export type Pivots = Record<string, Point>;

export interface Wave {
  readonly amp: number;
  /** Seconds. */
  readonly period: number;
  /** Radians. */
  readonly phase: number;
}

/** `turn`: degrees about the bone's pivot; `drift`: frame px. */
export type BoneMotion = { readonly kind: 'turn'; readonly waves: readonly Wave[] } | { readonly kind: 'drift'; readonly x: readonly Wave[]; readonly y: readonly Wave[] };

export interface Breath {
  readonly period: number;
  /** The chest's scale at full breath, minus one, across and down. */
  readonly sx: number;
  readonly sy: number;
  /** Frame px the body rises at full breath. */
  readonly lift: number;
}

export interface CreatureMotion {
  /** Slots 0-3, in the rig's order (tools/art/rig.json's key order). */
  readonly rigid: readonly [string, string, string, string];
  /** Each rigid bone's motion; null: a bone with a pivot and nothing to move. */
  readonly moves: Readonly<Record<string, BoneMotion | null>>;
  readonly breath: Breath;
}

export const BREATH_BONES = ['chest', 'lift'] as const;

/** The six bone names of a creature, in slot order. */
export function bonesOf(m: CreatureMotion): readonly string[] {
  return [...m.rigid, ...BREATH_BONES];
}

const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
const REST: Affine = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function waveSum(waves: readonly Wave[], t: number): number {
  let s = 0;
  for (const w of waves) s += w.amp * Math.sin((TAU * t) / w.period + w.phase);
  return s;
}

/** The six bones at time `t` (s): six column-major mat3 in slot order. */
export function poseFor(m: CreatureMotion, t: number, pivots: Pivots, amplitude: number = AMPLITUDE): Float32Array {
  const a = amplitude;
  const out = new Float32Array(SLOTS * 9);
  m.rigid.forEach((bone, i) => {
    const mv = m.moves[bone];
    const mat = !mv ? REST : mv.kind === 'turn' ? rotAbout(pivots[bone], a * DEG * waveSum(mv.waves, t)) : translate(a * waveSum(mv.x, t), a * waveSum(mv.y, t));
    out.set(mat, i * 9);
  });
  const breath = Math.sin((TAU * t) / m.breath.period);
  out.set(scaleAbout(pivots.chest, 1 + m.breath.sx * a * breath, 1 + m.breath.sy * a * breath), 4 * 9);
  out.set(translate(0, -m.breath.lift * a * breath), 5 * 9);
  return out;
}

export const DRAGON_MOTION: CreatureMotion = {
  rigid: ['head', 'wingL', 'wingR', 'tail'],
  moves: {
    head: { kind: 'turn', waves: [{ amp: 1.5, period: 6.2, phase: 0.7 }, { amp: 0.5, period: 2.9, phase: 0 }] },
    wingL: { kind: 'turn', waves: [{ amp: 1.8, period: 4.8, phase: -0.9 }] },
    wingR: { kind: 'turn', waves: [{ amp: -1.6, period: 4.8, phase: -1.15 }] },
    tail: { kind: 'turn', waves: [{ amp: 2.4, period: 3.7, phase: 1.3 }, { amp: 0.6, period: 1.9, phase: 0 }] },
  },
  breath: { period: 4.8, sx: 0.016, sy: 0.008, lift: 2.4 },
};

/** The dragon's six bones at time `t` (s). */
export function poseAt(t: number, pivots: Pivots, amplitude: number = AMPLITUDE): Float32Array {
  return poseFor(DRAGON_MOTION, t, pivots, amplitude);
}

export const FPS = 30;

/** Whether a frame is due at `now` (ms) after the last drawn at `last`, at `fps`; 4 ms of rAF jitter
 *  still counts, so a 60 Hz display draws one frame in two. */
export function frameDue(now: number, last: number | null, fps: number = FPS): boolean {
  return last === null || now - last >= 1000 / fps - 4;
}
```

(The existing dragon tests in `pose.test.ts` read the same peaks: `a * DEG * (1.5 sin + 0.5 sin)` equals today's `a * (1.5 DEG sin + 0.5 DEG sin)` to float rounding; their `toBeCloseTo` and `<= + 1e-6` bounds hold.)

- [ ] **Step 5: Implement `stages.ts` additions**

In `web/src/lib/living/stages.ts`, add `import type { OpponentId } from '../battle/battle';` after the `DragonStage` import, and after `livingStage`:

```ts
/** The battle's foes with a rig (spec 2026-10-03 living battle, plan Ruling B3): the seven opponents
 *  under their own ids and Éris's routed (flustered) picture. Their portraits are FOE_WIDTH x 1024,
 *  padded, centred, into the 1024 frame (plan Ruling B2). */
export const FOE_RIGS = ['eris', 'eris_flustered', 'hydre', 'chimere', 'echo', 'lethe', 'protee', 'sirenes'] as const;
export type FoeRig = (typeof FOE_RIGS)[number];
export type LivingRig = LivingStage | FoeRig;
export const FOE_WIDTH = 585;
/** A foe's box: its portrait's width over its height (the frame's 1024). */
export const FOE_ASPECT = FOE_WIDTH / 1024;

const BAKED_FOES = new Set(Object.keys(import.meta.glob('./rig/foe_*.json')).map((path) => path.slice('./rig/foe_'.length, -'.json'.length)));

export function isFoeRig(r: string): r is FoeRig {
  return (FOE_RIGS as readonly string[]).includes(r);
}

export function isLivingRig(r: string): r is LivingRig {
  return isFoeRig(r) || (LIVING_STAGES as readonly string[]).includes(r);
}

/** A foe lives once its rig is baked (tools/art/rig.py). */
export function livingFoe(rig: FoeRig): FoeRig | null {
  return BAKED_FOES.has(rig) ? rig : null;
}

/** The rig of the picture the battle shows (plan Ruling B6): Éris routed has her own. */
export function foeRigFor(opponent: OpponentId, flustered: boolean): FoeRig {
  return opponent === 'eris' && flustered ? 'eris_flustered' : opponent;
}
```

Update the file's header comment: "Which dragon stages and which battle foes live: those whose rig tools/art/rig.py has baked ...".

- [ ] **Step 6: Create `foes.ts`**

```ts
// The battle's foes alive (spec 2026-10-03 living battle, "What she sees"; plan Rulings B1, B4): each
// foe's four rigid bones in rig order (tools/art/rig.json's key order, then chest and lift) and its idle
// at 1x; the game plays it at AMPLITUDE (1.5x) like the dragon. No period is shared with the breath, so
// the beat never quite repeats; at 1.5x a turn stays under 6 deg and a drift under 12 frame px (about
// 6 screen px on the biggest battle box): slow and slight. Arrives with LivingDragon's chunk (rigs.ts).
import { ART } from '../world/art';
import type { CreatureMotion, Wave } from './pose';
import type { FoeRig } from './stages';

const w = (amp: number, period: number, phase = 0): Wave => ({ amp, period, phase });

export const FOE_MOTIONS: Record<FoeRig, CreatureMotion> = {
  // Her hair streaming behind her, the locks at her shoulder, the apple arm about the elbow, the robe's hem.
  eris: {
    rigid: ['hair', 'hairFront', 'arm', 'hem'],
    moves: {
      hair: { kind: 'turn', waves: [w(2.0, 5.3, 0.4), w(0.6, 2.3, 1.1)] },
      hairFront: { kind: 'turn', waves: [w(1.2, 4.1, 2.0)] },
      arm: { kind: 'turn', waves: [w(1.2, 6.7, 0.9), w(0.3, 3.1)] },
      hem: { kind: 'turn', waves: [w(0.8, 5.9, 1.7)] },
    },
    breath: { period: 5.1, sx: 0.012, sy: 0.006, lift: 2.0 },
  },
  // Routed: her head (and the hand at her brow) sways, her hair on both sides, a quicker breath.
  eris_flustered: {
    rigid: ['hairL', 'hairR', 'head', 'hem'],
    moves: {
      hairL: { kind: 'turn', waves: [w(1.4, 4.7, 0.3)] },
      hairR: { kind: 'turn', waves: [w(-1.6, 5.5, 1.2)] },
      head: { kind: 'turn', waves: [w(1.0, 3.3), w(0.4, 1.7, 0.8)] },
      hem: null,
    },
    breath: { period: 3.6, sx: 0.014, sy: 0.008, lift: 2.4 },
  },
  // The six heads in three pairs (the user: "make a couple of heads move together as a pair"), the tail tip.
  hydre: {
    rigid: ['pairHaut', 'pairDroite', 'pairBas', 'tail'],
    moves: {
      pairHaut: { kind: 'turn', waves: [w(2.0, 5.7), w(0.5, 2.6, 0.9)] },
      pairDroite: { kind: 'turn', waves: [w(-1.8, 6.3, 1.4), w(0.5, 2.2)] },
      pairBas: { kind: 'turn', waves: [w(1.6, 4.9, 2.6), w(0.4, 3.1, 0.3)] },
      tail: { kind: 'turn', waves: [w(3.0, 3.9, 0.8), w(0.8, 1.7)] },
    },
    breath: { period: 5.0, sx: 0.012, sy: 0.006, lift: 1.8 },
  },
  // The lion's head and mane, the mane's flowing locks, the goat's head, the snake tail.
  chimere: {
    rigid: ['lion', 'mane', 'goat', 'snake'],
    moves: {
      lion: { kind: 'turn', waves: [w(1.2, 6.1, 0.5), w(0.4, 2.7)] },
      mane: { kind: 'turn', waves: [w(1.5, 4.4, 1.9)] },
      goat: { kind: 'turn', waves: [w(1.8, 5.2, 2.8), w(0.5, 2.1)] },
      snake: { kind: 'turn', waves: [w(2.6, 3.6, 0.2), w(0.8, 1.8, 1.0)] },
    },
    breath: { period: 4.6, sx: 0.016, sy: 0.008, lift: 2.4 },
  },
  // The two ghost copies drift a little, apart; her hair on both sides.
  echo: {
    rigid: ['ghostL', 'ghostR', 'hairL', 'hairR'],
    moves: {
      ghostL: { kind: 'drift', x: [w(5, 7.3)], y: [w(3, 5.1, 1.2)] },
      ghostR: { kind: 'drift', x: [w(-5, 6.7, 1.9)], y: [w(3, 5.9, 0.4)] },
      hairL: { kind: 'turn', waves: [w(1.5, 4.3, 0.6)] },
      hairR: { kind: 'turn', waves: [w(-1.5, 4.9, 1.8)] },
    },
    breath: { period: 5.2, sx: 0.01, sy: 0.006, lift: 1.6 },
  },
  // The river's ribbons of hair and robe flow: the two outer bands, the robe between them, the long hair.
  lethe: {
    rigid: ['ribbonL', 'ribbonR', 'robe', 'hair'],
    moves: {
      ribbonL: { kind: 'turn', waves: [w(1.8, 6.4), w(0.6, 2.9, 1.3)] },
      ribbonR: { kind: 'turn', waves: [w(-1.8, 5.8, 1.6), w(0.6, 2.5)] },
      robe: { kind: 'drift', x: [w(4, 7.1, 0.7)], y: [] },
      hair: { kind: 'turn', waves: [w(1.0, 4.6, 2.2)] },
    },
    breath: { period: 5.4, sx: 0.01, sy: 0.006, lift: 1.6 },
  },
  // The tentacle arm, the beard, the waves at his base; the trident has no weight at all (it stays steady).
  protee: {
    rigid: ['tentacle', 'beard', 'waveL', 'waveR'],
    moves: {
      tentacle: { kind: 'turn', waves: [w(2.8, 4.2, 0.3), w(0.9, 1.9)] },
      beard: { kind: 'turn', waves: [w(1.2, 5.6, 1.1)] },
      waveL: { kind: 'drift', x: [w(4, 3.4)], y: [w(2, 2.3, 1.0)] },
      waveR: { kind: 'drift', x: [w(-4, 3.8, 1.5)], y: [w(2, 2.7, 0.2)] },
    },
    breath: { period: 5.0, sx: 0.012, sy: 0.006, lift: 2.0 },
  },
  // The three sisters' wings in four bones: the left sister's outer and inner wings, the middle
  // sister's, the right sister's.
  sirenes: {
    rigid: ['wingL', 'wingInner', 'wingC', 'wingR'],
    moves: {
      wingL: { kind: 'turn', waves: [w(1.8, 4.6)] },
      wingInner: { kind: 'turn', waves: [w(-1.4, 5.2, 0.8)] },
      wingC: { kind: 'turn', waves: [w(1.6, 4.9, 1.9)] },
      wingR: { kind: 'turn', waves: [w(-1.8, 5.5, 2.7)] },
    },
    breath: { period: 4.4, sx: 0.012, sy: 0.006, lift: 1.8 },
  },
};

/** The game's own pictures (the battle's `opponent.art`, Éris's routed one). */
export const FOE_SPRITES: Record<FoeRig, string> = {
  eris: ART.eris,
  eris_flustered: ART.erisFlustered,
  hydre: ART.lieutenants.hydre,
  chimere: ART.lieutenants.chimere,
  echo: ART.lieutenants.echo,
  lethe: ART.lieutenants.lethe,
  protee: ART.lieutenants.protee,
  sirenes: ART.lieutenants.sirenes,
};
```

A rig task (4, 5) may rename a foe's rigid bones or retune its numbers when its picture asks for it; the `pose.test.ts` bounds and the rig-order test (Task 2) keep the tables honest.

- [ ] **Step 7: Implement `rigs.ts`**

Replace `web/src/lib/living/rigs.ts` with:

```ts
// The living figures' rigs (spec 2026-10-02 living dragon, "Rigs", plan Ruling R1; spec 2026-10-03
// living battle, plan Rulings B1-B4): the per-vertex weights tools/art/rig.py bakes from
// tools/art/rig.json, one lazily imported chunk per rig: rig/dragon_<stage>.json for the dragon's
// stages, rig/foe_<id>.json for the battle's foes. A rig lives only once it is baked (stages.ts, which
// the game asks without loading this module: it arrives with LivingDragon's chunk).
import { FOE_MOTIONS } from './foes';
import { DRAGON_MOTION, bonesOf, type CreatureMotion, type Pivots } from './pose';
import { FRAME, GRID, SLOTS, VERTS } from './skin';
import { isFoeRig, isLivingRig, type LivingRig } from './stages';

export { FOE_RIGS, FOE_WIDTH, LIVING_STAGES, isFoeRig, livingFoe, livingStage, type FoeRig, type LivingRig, type LivingStage, type Motion } from './stages';

export interface RigFile {
  /** The rig's key: a dragon stage or a foe (the field kept its first name). */
  stage: string;
  source: string;
  grid: number;
  /** A portrait's width in frame px (foes); absent: the whole frame. */
  width?: number;
  pivots: Record<string, [number, number]>;
  /** The feet (or base) box [x0, y0, x1, y1] in frame px: every vertex inside has zero weight. */
  feet: [number, number, number, number];
  /** base64 of VERTS x VERTS x SLOTS bytes. */
  weights: string;
}

export interface Rig {
  id: LivingRig;
  bones: readonly string[];
  motion: CreatureMotion;
  width: number;
  pivots: Pivots;
  feet: readonly [number, number, number, number];
  weights: Uint8Array;
}

export function motionOf(id: LivingRig): CreatureMotion {
  return isFoeRig(id) ? FOE_MOTIONS[id] : DRAGON_MOTION;
}

const DRAGON_FILES = import.meta.glob<RigFile>('./rig/dragon_*.json', { import: 'default' });
const FOE_FILES = import.meta.glob<RigFile>('./rig/foe_*.json', { import: 'default' });
const keyed = (files: Record<string, () => Promise<RigFile>>, prefix: string) =>
  Object.entries(files).map(([path, load]) => [path.slice(prefix.length, -'.json'.length), load] as const);
const LOADERS = new Map([...keyed(DRAGON_FILES, './rig/dragon_'), ...keyed(FOE_FILES, './rig/foe_')]);

export function decodeRig(f: RigFile): Rig {
  const id = f.stage;
  if (!isLivingRig(id)) throw new Error(`rig ${id} is neither a dragon stage nor a foe`);
  if (f.grid !== GRID) throw new Error(`rig ${id} has a ${f.grid} grid, the game draws ${GRID}`);
  const width = f.width ?? FRAME;
  if (!(width > 0 && width <= FRAME)) throw new Error(`rig ${id} is ${width} px wide, the frame ${FRAME}`);
  const weights = Uint8Array.from(atob(f.weights), (c) => c.charCodeAt(0));
  if (weights.length !== VERTS * VERTS * SLOTS) throw new Error(`rig ${id} has ${weights.length} weight bytes, not ${VERTS * VERTS * SLOTS}`);
  const motion = motionOf(id);
  const bones = bonesOf(motion);
  for (const b of bones) if (!f.pivots[b]) throw new Error(`rig ${id} has no pivot for ${b}`);
  return { id, bones, motion, width, pivots: f.pivots, feet: f.feet, weights };
}

const cache = new Map<LivingRig, Promise<Rig>>();

export function loadRig(id: LivingRig): Promise<Rig> {
  let p = cache.get(id);
  if (!p) {
    const load = LOADERS.get(id);
    p = load ? load().then(decodeRig) : Promise.reject(new Error(`no rig for ${id}`));
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
```

- [ ] **Step 8: Add `padToFrame` to `atlas.ts`**

In `web/src/lib/living/atlas.ts`, import `frameOffset` from `./skin` (with `BONES, FRAME, weightsAt`), and after `loadImage`:

```ts
/** The sprite as the frame its rig was baked on (plan Ruling B2): a portrait narrower than the frame is
 *  drawn into a FRAME square, centred (skin.ts frameOffset, as tools/art/rig.py pads it). A picture of
 *  another size than the rig's throws: the caller shows the still picture. */
export function padToFrame(img: HTMLImageElement, width: number): TexImageSource {
  if (img.naturalHeight !== FRAME || img.naturalWidth !== width) throw new Error(`a ${img.naturalWidth} x ${img.naturalHeight} picture, the rig wants ${width} x ${FRAME}`);
  if (width === FRAME) return img;
  const canvas = document.createElement('canvas');
  canvas.width = FRAME;
  canvas.height = FRAME;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('no 2D canvas to frame the sprite');
  g.drawImage(img, frameOffset(width), 0);
  return canvas;
}
```

- [ ] **Step 9: Run the tests, the types and the lazy guard**

Run: `STACK=battle scripts/npm.sh run test -- src/lib/living` then `STACK=battle scripts/npm.sh run test` and `STACK=battle scripts/npm.sh run check`
Expected: all PASS (the foe `livingFoe` test reads null for every foe: no foe rig is baked yet); 0 errors, 0 warnings. `LivingDragon.svelte` still compiles (it uses `rig.pivots`, `rig.weights`, `poseAt`, unchanged names).

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/living
git commit -m "Living battle, engine: six bone slots per rig (four rigid named per creature, then chest and lift), motion as data (poseFor; the dragon's table is today's poseAt; the foes' tables in foes.ts), the foes' rig ids and their 585 px portraits padded, centred, into the 1024 frame (frameOffset, padToFrame); rigs.ts loads dragon_* and foe_* rigs and checks their bones and width"
```

---

### Task 2: The baker for the foes; the rig tests for every rig

**Files:**
- Modify: `tools/art/rig.py`, `tools/art/rig.json` (the `_doc` only), `web/src/lib/living/rigs.test.ts`

**Interfaces:**
- Consumes: Task 1's `FOE_RIGS`, `FOE_WIDTH`, `FOE_SPRITES`, `motionOf`, `bonesOf`, `decodeRig`, `SLOTS`.
- Produces: `rig.py` modes `grid|bake|debug|sheet|foe-sheet`, `--stage K` for any rig key; foe blocks: `{ "sprite": "web/public/art/...", "bones": { <4 rigid>, "chest", "lift" }, "pin": {...} }`; bone regions may be `poly`, `polys` (a list of polygons), `ellipse` or `all: true`; foe files `web/src/lib/living/rig/foe_<id>.json` with `"width"`; `docs/art/foe-rig.png`.

- [ ] **Step 1: Rewrite `rigs.test.ts` for every rig (failing on the bone-order and sprite rules only once a foe block exists)**

Replace `web/src/lib/living/rigs.test.ts` with:

```ts
// The living figures' rigs (spec 2026-10-02 living dragon, "Rigs", "Tests"; spec 2026-10-03 living
// battle, "Tests"): every authored rig, the dragon's stages and the battle's foes, is baked from the rig
// file and the sprite as they are now, in its creature's bone order; its pinned feet (or base) get zero
// weight; its rigid bones never sum past one; the probed tips take their bone.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FOE_SPRITES } from './foes';
import { bonesOf } from './pose';
import { BONES, CELL, FRAME, SLOTS, VERTS, weightsAt } from './skin';
import { decodeRig, FOE_RIGS, FOE_WIDTH, LIVING_STAGES, livingStage, motionOf, type FoeRig, type LivingRig, type RigFile } from './rigs';

interface RigBlock {
  sprite?: string;
  bones: Record<string, Record<string, unknown>>;
  pin: unknown;
}

const DRAGON_FILES = import.meta.glob<RigFile>('./rig/dragon_*.json', { eager: true, import: 'default' });
const FOE_FILES = import.meta.glob<RigFile>('./rig/foe_*.json', { eager: true, import: 'default' });
const SOURCE = JSON.parse(readFileSync('../tools/art/rig.json', 'utf-8')) as Record<string, RigBlock>;
const KEYS = Object.keys(SOURCE).filter((k) => !k.startsWith('_'));
const isDragon = (k: string) => (LIVING_STAGES as readonly string[]).includes(k);
const DRAGONS = KEYS.filter(isDragon);
const FOES = KEYS.filter((k) => !isDragon(k));
const fileOf = (k: string) => (isDragon(k) ? DRAGON_FILES[`./rig/dragon_${k}.json`] : FOE_FILES[`./rig/foe_${k}.json`]);
const spriteOf = (k: string) => SOURCE[k].sprite ?? `web/public/art/dragon/dragon_${k}_cut.webp`;
const rigOf = (k: string) => decodeRig(fileOf(k));
const HEAD = BONES.indexOf('head');
const PAINTED = ['poly', 'polys', 'ellipse', 'all'];

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

  it('keys every rig by a dragon stage or a foe', () => {
    expect(FOES.filter((k) => !(FOE_RIGS as readonly string[]).includes(k))).toEqual([]);
  });

  it("names each foe's sprite as the game serves it; a dragon stage's is implied", () => {
    for (const k of FOES) expect(SOURCE[k].sprite, k).toBe(`web/public${FOE_SPRITES[k as FoeRig]}`);
    for (const k of DRAGONS) expect(SOURCE[k].sprite, k).toBeUndefined();
  });

  it.each(KEYS)("%s: its bones in its creature's slot order", (k) => {
    expect(Object.keys(SOURCE[k].bones)).toEqual([...bonesOf(motionOf(k as LivingRig))]);
  });

  it.each(KEYS)('%s: baked from the rig and the sprite as they are now', (k) => {
    const f = fileOf(k);
    expect(f, `${k}: run tools/art/run_docker.sh rig bake --stage ${k}`).toBeDefined();
    const h = createHash('sha256').update(canonical(SOURCE[k]), 'utf8').update('\n').update(readFileSync(`../${spriteOf(k)}`));
    expect(f.source, `${k}: the rig or the sprite changed since the bake (tools/art/run_docker.sh rig bake --stage ${k})`).toBe(h.digest('hex'));
    expect(f.stage).toBe(k);
  });

  it('gives each foe rig the portrait width, and no dragon one', () => {
    for (const k of FOES) expect(fileOf(k).width, k).toBe(FOE_WIDTH);
    for (const k of DRAGONS) expect(fileOf(k).width, k).toBeUndefined();
  });

  it.each(KEYS)('%s: every bone has its pivot inside the frame', (k) => {
    const rig = rigOf(k);
    for (const b of rig.bones) {
      const [x, y] = rig.pivots[b];
      expect(x >= 0 && x <= FRAME && y >= 0 && y <= FRAME, `${k} ${b}`).toBe(true);
    }
  });

  it.each(KEYS)('%s: the feet get zero weight, in a box that reaches the bottom', (k) => {
    const rig = rigOf(k);
    const [x0, y0, x1, y1] = rig.feet;
    expect(y1).toBe(FRAME);
    expect(y1 - y0).toBeGreaterThanOrEqual(3 * CELL);
    expect(x1 - x0).toBeGreaterThanOrEqual(10 * CELL);
    for (let j = 0; j < VERTS; j++) {
      for (let i = 0; i < VERTS; i++) {
        const [x, y] = [i * CELL, j * CELL];
        if (x < x0 || x > x1 || y < y0) continue;
        const w = Array.from(rig.weights.slice((j * VERTS + i) * SLOTS, (j * VERTS + i) * SLOTS + SLOTS));
        expect(w, `${k} vertex (${x}, ${y})`).toEqual([0, 0, 0, 0, 0, 0]);
      }
    }
  });

  it.each(KEYS)('%s: the rigid bones never sum past one; each region carries its bone', (k) => {
    const rig = rigOf(k);
    const max = new Array(SLOTS).fill(0);
    for (let n = 0; n < VERTS * VERTS; n++) {
      const w = rig.weights.slice(n * SLOTS, n * SLOTS + SLOTS);
      expect(w[0] + w[1] + w[2] + w[3], `${k} vertex ${n}`).toBeLessThanOrEqual(255 + 2); // rounding of four bytes
      for (let b = 0; b < SLOTS; b++) max[b] = Math.max(max[b], w[b]);
    }
    rig.bones.forEach((b, i) => {
      const spec = SOURCE[k].bones[b];
      const painted = PAINTED.some((p) => p in spec);
      if (painted) expect(max[i], `${k} ${b}`).toBeGreaterThanOrEqual(230);
      else expect(max[i], `${k} ${b} has no region`).toBe(0);
    });
  });

  it("gives the ancestral's horn tip the head's weight (it lagged in the spike)", () => {
    // The right-hand horn's tip, read off the grid view (rig grid --stage ancestral), and its shaft.
    for (const [x, y] of [[603, 14], [606, 22]]) expect(weightsAt(rigOf('ancestral').weights, x, y)[HEAD], `(${x}, ${y})`).toBeGreaterThanOrEqual(0.9);
  });

  // Each wing's claw tip and the far tips of its edges, read off the grid views (playtest 2026-10-02:
  // the user saw claw tips and wing edges left behind, and the ancestral's front claw tip on the head).
  const WING_TIPS: [string, 'wingL' | 'wingR', string, number, number][] = [
    ['hatchling', 'wingL', 'lower tip of the leading edge', 162, 660],
    ['hatchling', 'wingR', 'claw tip', 693, 324],
    ['hatchling', 'wingR', 'lower tip', 860, 620],
    ['young', 'wingL', 'claw tip', 318, 142],
    ['young', 'wingL', 'lower tip', 107, 767],
    ['young', 'wingR', 'claw tip', 891, 194],
    ['young', 'wingR', 'lower tip', 884, 741],
    ['adult', 'wingR', 'lower tip', 895, 752],
    ['illustre', 'wingL', 'claw tip', 476, 148],
    ['illustre', 'wingL', 'lower finger beside the tail', 103, 810],
    ['illustre', 'wingR', 'claw tip', 946, 187],
    ['illustre', 'wingR', 'lower tip', 814, 730],
    ['ancestral', 'wingL', 'claw tip', 510, 155],
    ['ancestral', 'wingR', 'claw tip', 972, 172],
  ];
  it.each(WING_TIPS)('%s: the %s carries its %s (%i, %i)', (stage, bone, _what, x, y) => {
    expect(weightsAt(rigOf(stage).weights, x, y)[BONES.indexOf(bone)]).toBeGreaterThanOrEqual(0.9);
  });

  it("keeps the head off the ancestral's front claw tip, under the horn", () => {
    expect(weightsAt(rigOf('ancestral').weights, 510, 155)[HEAD]).toBeLessThanOrEqual(0.1);
  });

  it('animates a stage only when its rig is baked, never the egg', () => {
    expect(livingStage('egg')).toBeNull();
    expect(livingStage('adult')).toBe('adult');
    expect(livingStage('ancestral')).toBe('ancestral');
  });

  it('rigs every hatched stage', () => {
    expect([...DRAGONS].sort()).toEqual([...LIVING_STAGES].sort());
    for (const s of LIVING_STAGES) expect(livingStage(s), s).toBe(s);
  });

  it('refuses a rig file of the wrong size', () => {
    expect(() => decodeRig({ ...fileOf('adult'), weights: 'AAAA' })).toThrow();
  });

  it('refuses a rig whose pivots miss a bone of its creature', () => {
    const f = fileOf('adult');
    const { head: _gone, ...pivots } = f.pivots;
    expect(() => decodeRig({ ...f, pivots: pivots as typeof f.pivots })).toThrow(/head/);
  });

  it('refuses a rig that is neither a dragon stage nor a foe, or wider than the frame', () => {
    expect(() => decodeRig({ ...fileOf('adult'), stage: 'griffon' })).toThrow(/griffon/);
    expect(() => decodeRig({ ...fileOf('adult'), width: 1100 })).toThrow(/1100/);
  });

  it("decodes a dragon rig with the dragon's bones and the whole frame's width", () => {
    const rig = rigOf('adult');
    expect(rig.id).toBe('adult');
    expect(rig.bones).toEqual(['head', 'wingL', 'wingR', 'tail', 'chest', 'lift']);
    expect(rig.width).toBe(1024);
  });
});
```

(`it.each(KEYS)` is never empty: the five dragon stages are in it. The foe-only rules loop inside one `it` and pass while no foe block exists.)

Run: `STACK=battle scripts/npm.sh run test -- src/lib/living/rigs.test.ts`
Expected: PASS (no foe block yet).

- [ ] **Step 2: Rewrite `tools/art/rig.py`**

Replace the module docstring and generalise the code as follows (keep `smoothstep`, `blur`, `feet_box` as they are):

```python
"""The living figures' rigs: the dragon's stages and the battle's foes (the dragon-rig skill; spec
2026-10-02 living dragon, plan Rulings R1, R6; spec 2026-10-03 living battle, plan Rulings B1-B3).

    tools/art/run_docker.sh rig grid  [--stage K]   # tools/art/rig-out/grid_<K>.png: the sprite in its frame under a 50 px grid
    tools/art/run_docker.sh rig bake  [--stage K]   # web/src/lib/living/rig/dragon_<K>.json or foe_<K>.json (the game's weights)
    tools/art/run_docker.sh rig debug [--stage K]   # tools/art/rig-out/rig_<K>.png: weights, pivots, feet box
    tools/art/run_docker.sh rig sheet               # docs/art/dragon-rig.png: the dragon stages' debug views, for the record
    tools/art/run_docker.sh rig foe-sheet           # docs/art/foe-rig.png: the foes' debug views, for the record

K is a key of tools/art/rig.json: a dragon stage (hatchling, young, adult, illustre, ancestral) or a
foe (eris, eris_flustered, hydre, chimere, echo, lethe, protee, sirenes). A foe's block names its
sprite ("sprite", repo-relative); a portrait narrower than the frame (the foes' 585 x 1024) is padded,
centred, into the 1024 frame, at (1024 - w) // 2 as web/src/lib/living/skin.ts frameOffset, so the
mesh, the margin and everything below work unchanged. Each rig has six bones in its block's key order:
four rigid ones, then chest and lift.

Per bone: its region (a polygon, several polygons, an ellipse, or the whole frame) rasterised inside
the sprite's opaque pixels, times an optional ramp (along y, or by distance from the pivot), pushed into
the transparent background by nearest-opaque-pixel fill (so mesh triangles straddling the outline move
with the part and do not shear its edge), then Gaussian-blurred. The four rigid bones are normalised so
their sum stays <= 1; everything is multiplied by (1 - pin), and every vertex inside the feet box (the
pin rectangle inset by 3 x its blur, down to the bottom) is hard-zeroed. The weights are sampled at the
65 x 65 vertices of the game's mesh: bytes[(j * 65 + i) * 6 + b], vertex (i, j) at (16 i, 16 j).
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
DRAGON_SPRITE = 'web/public/art/dragon/dragon_{key}_cut.webp'
DRAGON_STAGES = ['hatchling', 'young', 'adult', 'illustre', 'ancestral']
BAKED = REPO / 'web/src/lib/living/rig'
SCRATCH = REPO / 'tools/art/rig-out'
SHEET = REPO / 'docs/art/dragon-rig.png'
FOE_SHEET = REPO / 'docs/art/foe-rig.png'
N = 1024
GRID = 64
CELL = N // GRID
BREATH = ['chest', 'lift']
# The rigid slots' colours on the debug view: slot 0 red, 1 green, 2 blue, 3 yellow (the dragon's head,
# left wing, right wing, tail).
SLOT_COLOURS = [(255, 60, 60), (60, 200, 60), (60, 120, 255), (255, 200, 0)]
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)


def rigs():
    data = json.loads(RIG_FILE.read_text(encoding='utf-8'))
    return {k: v for k, v in data.items() if not k.startswith('_')}


def is_dragon(key):
    return key in DRAGON_STAGES


def sprite_path(key, rig):
    return REPO / rig.get('sprite', DRAGON_SPRITE.format(key=key))


def bones_of(key, rig):
    names = list(rig['bones'])
    if len(names) != 6 or names[4:] != BREATH:
        raise SystemExit(f'{key}: six bones, four rigid ones then chest and lift, not {names}')
    return names


def source_hash(key, rig):
    canon = json.dumps(rig, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    h = hashlib.sha256(canon.encode('utf-8'))
    h.update(b'\n')
    h.update(sprite_path(key, rig).read_bytes())
    return h.hexdigest()


def load_sprite(key, rig):
    """The sprite in the 1024 frame and its own width: a narrower portrait padded, centred."""
    im = Image.open(sprite_path(key, rig)).convert('RGBA')
    w, h = im.size
    if h != N or not 0 < w <= N:
        raise SystemExit(f'{key}: the sprite is {w} x {h}; the frame wants {N} px high and at most {N} wide')
    if w == N:
        return im, w
    frame = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    frame.paste(im, ((N - w) // 2, 0))
    return frame, w


def painted(spec):
    return 'poly' in spec or 'polys' in spec or 'ellipse' in spec or bool(spec.get('all'))


def raster(spec):
    im = Image.new('L', (N, N), 0)
    d = ImageDraw.Draw(im)
    if 'poly' in spec:
        d.polygon([tuple(p) for p in spec['poly']], fill=255)
    elif 'polys' in spec:
        for poly in spec['polys']:
            d.polygon([tuple(p) for p in poly], fill=255)
    elif 'ellipse' in spec:
        cx, cy, rx, ry = spec['ellipse']
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
    elif 'rect' in spec:
        d.rectangle(spec['rect'], fill=255)
    elif spec.get('all'):
        d.rectangle([0, 0, N, N], fill=255)
    return np.asarray(im, np.float32) / 255
```

then `weight_maps(key, rig)` returns `(sprite, width, alpha, pin, w, bones)`: it calls `load_sprite`, `bones_of`, loops `for name in bones`, tests `painted(b)` in place of the old inline condition, and normalises over `rigid = bones[:4]`. `vertex_bytes(w, bones, feet)` stacks `[w[k][np.ix_(idx, idx)] for k in bones]`. `bake(key, rig)`:

```python
def bake(key, rig):
    _, width, _, _, w, bones = weight_maps(key, rig)
    feet = feet_box(rig['pin'])
    out = {'stage': key, 'source': source_hash(key, rig), 'grid': GRID}
    if not is_dragon(key):
        out['width'] = width
    out['pivots'] = {k: rig['bones'][k]['pivot'] for k in bones}
    out['feet'] = feet
    out['weights'] = base64.b64encode(vertex_bytes(w, bones, feet)).decode('ascii')
    BAKED.mkdir(parents=True, exist_ok=True)
    name = f'dragon_{key}.json' if is_dragon(key) else f'foe_{key}.json'
    (BAKED / name).write_text(json.dumps(out, indent=2) + '\n', encoding='utf-8')
    print(key, {k: round(float(v.max()), 3) for k, v in w.items()}, 'feet', feet)
```

(A dragon's output keeps today's keys in today's order, so its file is byte-identical.)

`debug_image(key, rig)` colours slot `i` of `bones[:4]` with `SLOT_COLOURS[i]`, labels each pivot with its bone name as today, writes the key as the title, and adds a legend under it: one line per rigid slot, `f'{bones[i]}'` in `SLOT_COLOURS[i]` (font size 20, at (12, 50 + 24 i)). `grid_image(key, rig)` pastes `load_sprite(key, rig)[0]` on white. `main()`:

```python
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('mode', choices=['grid', 'bake', 'debug', 'sheet', 'foe-sheet'])
    ap.add_argument('--stage', help='a rig key: a dragon stage or a foe')
    args = ap.parse_args()
    all_rigs = rigs()
    if args.stage and args.stage not in all_rigs:
        raise SystemExit(f'no rig {args.stage} in {RIG_FILE.name}: {", ".join(all_rigs)}')
    keys = [args.stage] if args.stage else list(all_rigs)
    if args.mode == 'grid':
        SCRATCH.mkdir(parents=True, exist_ok=True)
        for k in keys:
            grid_image(k, all_rigs[k]).save(SCRATCH / f'grid_{k}.png')
    elif args.mode == 'bake':
        for k in keys:
            bake(k, all_rigs[k])
    elif args.mode == 'debug':
        SCRATCH.mkdir(parents=True, exist_ok=True)
        for k in keys:
            debug_image(k, all_rigs[k]).save(SCRATCH / f'rig_{k}.png')
    elif args.mode == 'sheet':
        tile = 384
        order = [s for s in DRAGON_STAGES if s in all_rigs]
        sheet = Image.new('RGB', (tile * 3, tile * 2), (255, 255, 255))
        for n, s in enumerate(order):
            sheet.paste(debug_image(s, all_rigs[s]).resize((tile, tile), Image.LANCZOS), ((n % 3) * tile, (n // 3) * tile))
        sheet.save(SHEET, optimize=True)
    else:
        # The foes' portraits, each cropped to its column of the frame (20 px either side), four a row.
        th = 512
        order = [k for k in all_rigs if not is_dragon(k)]
        tiles = []
        for k in order:
            img = debug_image(k, all_rigs[k])
            w = load_sprite(k, all_rigs[k])[1]
            x0 = max(0, (N - w) // 2 - 20)
            crop = img.crop((x0, 0, min(N, x0 + w + 40), N))
            tiles.append(crop.resize((round(crop.width * th / N), th), Image.LANCZOS))
        tw = max((t.width for t in tiles), default=1)
        rows = max(1, math.ceil(len(tiles) / 4))
        sheet = Image.new('RGB', (tw * 4, th * rows), (255, 255, 255))
        for n, t in enumerate(tiles):
            sheet.paste(t, ((n % 4) * tw, (n // 4) * th))
        sheet.save(FOE_SHEET, optimize=True)
    print('done', args.mode, keys)
```

Update `tools/art/rig.json`'s `_doc` to: "The living figures' rigs (the dragon-rig skill): the dragon's stages and the battle's foes. 1024 px frame coordinates, y down, integers only; a foe's 585 px portrait sits at x 219-804 of the frame. Per rig: six bones in slot order (four rigid ones, then chest and lift), each with its pivot and an optional region (poly, polys, ellipse, or all: true), times an optional ramp (along y, or by distance from the pivot), pushed into the background and blurred by tools/art/rig.py; the pin rectangle keeps the feet (or base) still. A foe's block names its sprite. Bake with tools/art/run_docker.sh rig bake --stage K; never edit web/src/lib/living/rig/*.json by hand." (Changing `_doc` changes no hash: keys starting with `_` are not rigs.)

- [ ] **Step 3: Prove the dragon stages re-bake byte-identically**

Run (Bash, worktree root): `tools/art/run_docker.sh rig bake && git status --porcelain web/src/lib/living/rig`
Expected: the five stages print their maxima and feet as before; `git status` prints nothing (the five `dragon_*.json` unchanged). Any diff is a bug in the generalisation: fix `rig.py` until there is none.

Run: `tools/art/run_docker.sh rig debug --stage adult` and look at `tools/art/rig-out/rig_adult.png` (Read tool): the same colours as `docs/art/dragon-rig.png`'s adult tile, plus the legend.

- [ ] **Step 4: Run the tests**

Run: `STACK=battle scripts/npm.sh run test -- src/lib/living` and `STACK=battle scripts/npm.sh run check`
Expected: PASS; 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add tools/art/rig.py tools/art/rig.json web/src/lib/living/rigs.test.ts
git commit -m "Living battle, baker: rig.py bakes any rig key (a dragon stage, or a foe whose block names its 585 px sprite, padded, centred, into the 1024 frame) in its block's bone order, with several polygons per bone, foe files foe_<id>.json carrying their width, and a foe sheet; the dragon stages re-bake byte-identically; rigs.test.ts checks every rig and pins each foe's sprite and bone order"
```

---

### Task 3: LivingDragon, DragonFigure and the lab for any rig

**Files:**
- Modify: `web/src/components/LivingDragon.svelte`, `web/src/components/DragonFigure.svelte`, `web/src/lab/DragonLab.svelte`, `web/src/lab/TintPanel.svelte`

**Interfaces:**
- Consumes: Task 1's `loadRig`, `Rig` (`motion`, `width`, `pivots`, `weights`), `poseFor`, `padToFrame`, `frameOffset`, `isFoeRig`, `FOE_WIDTH`, `FOE_RIGS`, `livingFoe`, `FOE_SPRITES`, `LivingRig`.
- Produces: `LivingDragon` props `{ rig: LivingRig; src: string; alt: string; tint: Tint | null; overlays: OverlayLayer[]; amplitude?; time?; showWeights?; tintSpec?; onmotion }` (was `stage: LivingStage`, `tint: Tint`); its host `div.dragon-living` has `style="aspect-ratio: <width> / 1024"` and no `data-tint` when untinted. `DragonFigure` prop `living?: LivingRig | null`. Lab: section `.foes` with one `figure` per baked foe, `figcaption[data-rig]`, controls with ids `#amplitude`, `#tint`, `#pieces`, `#weights`, `#pause`, `#time`, `#as-battle`.

- [ ] **Step 1: Generalise `LivingDragon.svelte`**

In `web/src/components/LivingDragon.svelte`:

1. Header comment: after "The living dragon (spec 2026-10-02 living dragon, "Component")", add "and, since spec 2026-10-03 living battle (plan Rulings B2, B5), any living rig: a dragon stage or a battle foe, the foe's 585 px portrait padded into the frame and its box kept at the portrait's aspect; a foe is never tinted (`tint` null)". Replace "A new stage or picture" with "A new rig or picture".
2. Imports:

```ts
  import { buildAtlas, loadImage, padToFrame, pieceDraws, placePieces } from '../lib/living/atlas';
  import { AMPLITUDE, frameDue, poseFor } from '../lib/living/pose';
  import { DragonRenderer } from '../lib/living/renderer';
  import type { OklchSpec } from '../lib/living/tint';
  import { TINT_SPECS } from '../lib/world/dragon';
  import type { Tint } from '../lib/world/types';
  import { FOE_WIDTH, isFoeRig, loadRig, type LivingRig, type Motion, type Rig } from '../lib/living/rigs';
  import { FRAME, MARGIN, frameOffset } from '../lib/living/skin';
```

3. Props: `rig: rigId` (typed `rig: LivingRig`) in place of `stage`, and `tint: Tint | null`.
4. State: add `let spriteWidth = FRAME;` beside `let canvas`.
5. `draw`: `renderer.draw(poseFor(rig.motion, time ?? (now - started) / 1000, rig.pivots, amplitude), showWeights);`
6. `resize`:

```ts
  function resize(): void {
    if (!renderer || !host) return;
    const width = host.getBoundingClientRect().width;
    // The canvas spans the whole frame plus its margin; the host spans the sprite's own width.
    const scale = (FRAME * (1 + 2 * MARGIN)) / spriteWidth;
    renderer.resize(Math.max(1, Math.round(width * scale * Math.min(2, window.devicePixelRatio || 1))));
    last = null; // a resized canvas is blank: draw at the next frame
  }
```

7. `applyTint`:

```ts
  function applyTint(name: Tint | null, override: OklchSpec | null | undefined): void {
    const spec = override === undefined ? (name ? TINT_SPECS[name] : null) : override;
    // The exact numbers, as the still tint's cache (stillTint.ts): a lab slider's 0.005 apart are two tints.
    const key = spec ? `${name} ${spec.shift} ${spec.chroma} ${spec.lightness}` : `${name ?? 'untinted'} none`;
    if (!renderer || key === tintKey) return;
    renderer.setTint(spec);
    tintKey = key;
    applied.tint = name ?? '';
    last = null;
  }
```

8. `start(el, id: LivingRig, url)`: set `spriteWidth = isFoeRig(id) ? FOE_WIDTH : FRAME;` before building the canvas, place it with

```ts
    const m = MARGIN * FRAME;
    Object.assign(cv.style, {
      position: 'absolute',
      display: 'block',
      left: `${(-(frameOffset(spriteWidth) + m) / spriteWidth) * 100}%`,
      top: `${-MARGIN * 100}%`,
      width: `${((FRAME + 2 * m) / spriteWidth) * 100}%`,
      height: `${(1 + 2 * MARGIN) * 100}%`,
    });
```

(for the dragon, `spriteWidth = 1024`: left -3.5 %, width 107 %, as today), and load with

```ts
        const [r, img] = await Promise.all([loadRig(id), loadImage(url)]);
        if (disposed) return;
        if (r.width !== spriteWidth) throw new Error(`rig ${id} is ${r.width} px wide, its box ${spriteWidth}`);
        rig = r;
        renderer = new DragonRenderer(cv, padToFrame(img, r.width), r);
```

9. The by-value derived: `const rigNow = $derived(rigId);` in place of `stageNow`, used by the start effect (`const s = rigNow;`). Keep `width` out of state: the host's style reads it with `$derived`:

```ts
  const boxWidth = $derived(isFoeRig(rigId) ? FOE_WIDTH : FRAME);
```

10. Markup: `data-tint={applied.tint || undefined}` and `style:aspect-ratio="{boxWidth} / {FRAME}"` on the host; remove `aspect-ratio: 1 / 1;` from `.dragon-living` in the `<style>` block.

- [ ] **Step 2: Generalise `DragonFigure.svelte`**

- `import { hasWebGL2, isFoeRig, type LivingRig, type Motion } from '../lib/living/stages';` (replacing `LivingStage`);
- prop `living?: LivingRig | null;`
- the living line:

```svelte
      <!-- A dragon stage carries the dragon's tint (the nest's, the camp's and the battle's layers); a
           foe is never tinted (spec 2026-10-03 living battle). -->
      <Living rig={livingNow} {src} {alt} tint={isFoeRig(livingNow) ? null : (tint ?? 'bronze')} {overlays} onmotion={(m: Motion) => (motion = m)} />
```

- the header comment's last sentence becomes: "The egg, reduced motion and every other caller (the victory, the reveal) pass none; the battle passes its fighters' rigs (spec 2026-10-03 living battle)." and "given a `living` stage" becomes "given a `living` rig (a dragon stage, or a battle foe)".

- [ ] **Step 3: The lab: `rig=` and « Les adversaires »**

`web/src/lab/TintPanel.svelte`: `<LivingDragon rig={stage} ...>` in place of `{stage}`.

`web/src/lab/DragonLab.svelte`:
- header comment: add "Below them, every battle foe with a rig, living side by side, mirrored as in the battle (« Comme au combat »): spec 2026-10-03 living battle, plan Ruling B10.";
- imports: `import { FOE_RIGS, livingFoe, type FoeRig } from '../lib/living/stages';`, `import { FOE_SPRITES } from '../lib/living/foes';`, `import { FACES } from '../lib/battle/battle';`;
- state:

```ts
  const foes = FOE_RIGS.filter((r) => livingFoe(r) !== null);
  // The battle mirrors an opponent that does not look left in its file (battle.ts FACES); Éris routed as Éris.
  const mirrored = (r: FoeRig) => FACES[r === 'eris_flustered' ? 'eris' : r] !== 'left';
  let asInBattle = $state(true);
```

- give the stage controls ids: `id="amplitude"`, `id="tint"` (the select), `id="pieces"`, `id="weights"`, `id="pause"`, `id="time"` (inputs inside their existing labels);
- `<LivingDragon rig={s} ...>` in the stages grid;
- after the stages grid:

```svelte
  <h2>Les adversaires</h2>
  <div class="controls">
    <label><input id="as-battle" type="checkbox" bind:checked={asInBattle} /> Comme au combat</label>
  </div>
  <div class="grid foes">
    {#each foes as r (r)}
      <figure>
        <figcaption data-rig={r}>{r}&#8239;: {MOTION_WORDS[motions[r] ?? 'pending']}</figcaption>
        <div class="portrait" class:mirror={asInBattle && mirrored(r)}>
          <LivingDragon
            rig={r}
            src={FOE_SPRITES[r]}
            alt={r}
            tint={null}
            overlays={[]}
            {amplitude}
            time={paused ? at : null}
            showWeights={weights}
            onmotion={(m) => (motions[r] = m)}
          />
        </div>
      </figure>
    {/each}
  </div>
```

- styles:

```css
  .grid.foes {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }
  .portrait {
    position: relative;
    width: 70%;
    margin: 0 auto;
    aspect-ratio: 585 / 1024;
  }
  .portrait.mirror {
    transform: scaleX(-1);
  }
```

(`motions` is keyed by string already; the foes' ids never collide with the stages'.)

- [ ] **Step 4: Types, unit tests, builds**

Run: `STACK=battle scripts/npm.sh run check`, `STACK=battle scripts/npm.sh run test`, `STACK=battle scripts/npm.sh run build`, `STACK=battle scripts/npm.sh exec -- vite build --config vite.lab.config.ts`
Expected: 0 errors, 0 warnings; tests PASS (the lazy guard included); both builds without a warning.

- [ ] **Step 5: The lab still draws the five stages**

Serve `web/dist-lab` on 8745 (background), then write `C:/Users/nicol/.claude/jobs/9ac9a508/tmp/battle/lab_foes.py`:

```python
"""Throwaway (living battle, Tasks 3-5): drive the lab, shoot the stages' grid and each foe's tile.
    python lab_foes.py            # every tile
    python lab_foes.py hydre eris # these foes' tiles only (the stages' grid is shot always)
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:8745/lab.html'
OUT = Path(r'C:\Users\nicol\.claude\jobs\9ac9a508\tmp\battle\lab')
OUT.mkdir(parents=True, exist_ok=True)
ONLY = set(sys.argv[1:])
errors = []


def set_range(page, sel, value):
    page.locator(sel).evaluate("(el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }", value)
    page.wait_for_timeout(300)


with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    try:
        page = browser.new_page(viewport={'width': 1400, 'height': 1000})
        page.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
        page.goto(URL)
        page.wait_for_function("""() => { const c = [...document.querySelectorAll('figcaption[data-stage], figcaption[data-rig]')];
            return c.length > 0 && c.every((f) => /vivant|image fixe/.test(f.textContent)); }""", timeout=60000)
        captions = page.locator('figcaption[data-stage], figcaption[data-rig]').all_inner_texts()
        print('captions', captions)
        page.check('#pause')
        set_range(page, '#time', 1.2)
        page.locator('.grid').first.screenshot(path=str(OUT / 'stages_t1.2.png'))
        rigs = [c.get_attribute('data-rig') for c in page.locator('.foes figcaption').all()]
        tiles = page.locator('.foes figure')
        for amp in (1.5, 3):
            set_range(page, '#amplitude', amp)
            for t in (1.2, 3.6):
                set_range(page, '#time', t)
                for n, rig in enumerate(rigs):
                    if not ONLY or rig in ONLY:
                        tiles.nth(n).screenshot(path=str(OUT / f'{rig}_a{amp}_t{t}.png'))
        set_range(page, '#amplitude', 1.5)
        page.check('#weights')
        page.wait_for_timeout(300)
        for n, rig in enumerate(rigs):
            if not ONLY or rig in ONLY:
                tiles.nth(n).screenshot(path=str(OUT / f'{rig}_weights.png'))
        print('frames', page.eval_on_selector_all('.dragon-living canvas', 'cs => cs.map((c) => [c.dataset.frames, c.width])'))
    finally:
        browser.close()
print('errors', errors)
```

Run it under the lock (see Commands). Look at `stages_t1.2.png` (Read tool): five living dragons, as before this task. `errors` must be empty. Stop the server.

- [ ] **Step 6: The living dragon's e2e regression**

Run: `PW_WORKERS=1 STACK=battle scripts/playwright.sh living-dragon scenes-nest scenes-camp > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/battle/t3-e2e.log 2>&1`
Expected: all PASS (nest and camp unchanged: the dragon's box, tint, pieces, fallbacks).

- [ ] **Step 7: Commit**

```bash
git add web/src/components/LivingDragon.svelte web/src/components/DragonFigure.svelte web/src/lab
git commit -m "Living battle, component: LivingDragon draws any rig (a dragon stage, or a foe's portrait padded into the frame, its box at the portrait's aspect, never tinted, data-tint absent); DragonFigure passes a foe rig untinted; the lab lists the foes with a rig, mirrored as in the battle, and its controls carry ids for the shot script"
```

---

### Task 4: Rigs I: Éris, Éris routed, the Hydre, the Chimère

**Files:**
- Modify: `tools/art/rig.json`, `web/src/lib/living/rigs.test.ts`, `.claude/skills/dragon-rig/SKILL.md`, `web/src/lib/living/foes.ts` (only if a picture asks for a renamed bone or a retuned number)
- Create (baked): `web/src/lib/living/rig/foe_eris.json`, `foe_eris_flustered.json`, `foe_hydre.json`, `foe_chimere.json`

**Interfaces:**
- Consumes: Task 2's baker (`rig grid|bake|debug --stage K`), Task 3's lab and `lab_foes.py`, Task 1's `FOE_MOTIONS` (bone names and slot order).
- Produces: four baked foe rigs; `FOE_PROBES` and the Hydre pair rules in `rigs.test.ts`; the skill's "Foes" section begun.

Frame coordinates: a foe's portrait sits at x 219-804 of the 1024 frame (the grid view shows it padded; read every point off `tools/art/rig-out/grid_<id>.png`). The blocks below are first drafts read off the pictures at planning time; the grid view decides.

- [ ] **Step 1: The grid views**

Run: `tools/art/run_docker.sh rig grid --stage eris` is refused until a block exists; first add the four blocks of Step 2 to `tools/art/rig.json` (after `ancestral`), then run `tools/art/run_docker.sh rig grid` and read `grid_eris.png`, `grid_eris_flustered.png`, `grid_hydre.png`, `grid_chimere.png` (Read tool). Correct each draft's points against them before baking.

- [ ] **Step 2: Write the four blocks** (first drafts)

```json
  "eris": {
    "sprite": "web/public/art/characters/eris_cut.webp",
    "bones": {
      "hair":      { "pivot": [585, 150], "poly": [[575,60],[640,90],[720,150],[790,260],[790,525],[690,525],[660,470],[665,330],[630,280],[600,240],[585,170]], "ramp_from_pivot": [40, 260], "blur": 10 },
      "hairFront": { "pivot": [440, 100], "poly": [[400,90],[460,90],[465,240],[420,250],[395,200]], "ramp_from_pivot": [20, 140], "blur": 8 },
      "arm":       { "pivot": [414, 360], "poly": [[245,145],[345,145],[350,215],[380,260],[440,330],[430,380],[395,375],[340,320],[280,260],[248,215]], "ramp_from_pivot": [20, 150], "blur": 8 },
      "hem":       { "pivot": [520, 600], "poly": [[310,600],[700,600],[800,930],[800,990],[300,990],[300,920]], "ramp": [640, 900], "blur": 14 },
      "chest":     { "pivot": [505, 300], "ellipse": [505, 300, 70, 80], "blur": 30 },
      "lift":      { "pivot": [510, 900], "all": true, "ramp": [900, 600], "blur": 0 }
    },
    "pin": { "rect": [360, 890, 740, 1024], "blur": 12 }
  },
  "eris_flustered": {
    "sprite": "web/public/art/characters/eris_flustered_cut.webp",
    "bones": {
      "hairL": { "pivot": [420, 280], "poly": [[345,285],[420,285],[440,460],[380,470],[345,400]], "ramp_from_pivot": [20, 150], "blur": 8 },
      "hairR": { "pivot": [590, 140], "poly": [[575,100],[640,100],[690,200],[715,400],[700,540],[645,540],[635,430],[632,260],[600,220],[575,170]], "ramp_from_pivot": [30, 250], "blur": 8 },
      "head":  { "pivot": [499, 250], "poly": [[310,190],[400,90],[420,10],[580,10],[580,120],[570,210],[520,230],[450,230],[420,250],[330,260],[310,240]], "ramp": [260, 180], "blur": 10 },
      "hem":   { "pivot": [500, 800] },
      "chest": { "pivot": [520, 300], "ellipse": [520, 300, 60, 70], "blur": 30 },
      "lift":  { "pivot": [500, 900], "all": true, "ramp": [900, 600], "blur": 0 }
    },
    "pin": { "rect": [360, 890, 760, 1024], "blur": 12 }
  },
  "hydre": {
    "sprite": "web/public/art/lieutenants/hydre_cut.webp",
    "bones": {
      "pairHaut":   { "pivot": [420, 520], "polys": [[[420,20],[620,20],[620,135],[520,140],[500,260],[440,280],[420,180]], [[260,120],[460,120],[460,245],[340,250],[300,290],[255,285]]], "ramp_from_pivot": [150, 350], "blur": 8 },
      "pairDroite": { "pivot": [640, 620], "polys": [[[525,115],[745,115],[745,230],[600,240],[560,300],[525,290]], [[595,250],[785,250],[785,560],[730,560],[700,370],[600,365]]], "ramp_from_pivot": [150, 350], "blur": 8 },
      "pairBas":    { "pivot": [300, 680], "polys": [[[255,295],[480,280],[480,395],[340,400],[300,470],[255,460]], [[300,445],[480,445],[480,550],[300,550]]], "ramp_from_pivot": [60, 200], "blur": 8 },
      "tail":       { "pivot": [720, 880], "poly": [[545,930],[620,900],[700,860],[745,860],[745,960],[680,990],[560,1010],[545,1000]], "ramp_from_pivot": [30, 180], "blur": 8 },
      "chest":      { "pivot": [500, 650], "ellipse": [500, 650, 160, 90], "blur": 30 },
      "lift":       { "pivot": [480, 900], "all": true, "ramp": [900, 600], "blur": 0 }
    },
    "pin": { "rect": [250, 900, 540, 1024], "blur": 8 }
  },
  "chimere": {
    "sprite": "web/public/art/lieutenants/chimere_cut.webp",
    "bones": {
      "lion":  { "pivot": [470, 470], "poly": [[360,30],[548,30],[548,330],[540,420],[440,440],[360,420]], "ramp": [480, 360], "blur": 12 },
      "mane":  { "pivot": [380, 200], "poly": [[270,100],[360,100],[370,250],[380,520],[330,525],[270,420]], "ramp_from_pivot": [30, 220], "blur": 10 },
      "goat":  { "pivot": [590, 360], "poly": [[548,50],[650,50],[680,140],[690,210],[650,300],[600,340],[560,320],[548,200]], "ramp_from_pivot": [40, 200], "blur": 8 },
      "snake": { "pivot": [690, 625], "poly": [[625,330],[770,330],[775,420],[765,600],[700,640],[680,600],[650,500],[625,420]], "ramp_from_pivot": [30, 200], "blur": 8 },
      "chest": { "pivot": [500, 540], "ellipse": [500, 540, 90, 90], "blur": 30 },
      "lift":  { "pivot": [500, 760], "all": true, "ramp": [740, 480], "blur": 0 }
    },
    "pin": { "rect": [320, 730, 770, 1024], "blur": 12 }
  }
```

What each region must hold (the checks of Step 4):
- **eris**: `hair` the whole mass streaming right, to every strand tip, never her raised left elbow or the hand on her hip; `hairFront` the locks at her right shoulder, never the face; `arm` the forearm, the hand and the golden apple to its leaf (pivot at the elbow), the upper arm fading; `hem` the robe's lower flares, growing toward the hem, both flares included, the sandals inside the feet box; `chest` her bust; `lift` from the feet up.
- **eris_flustered**: `head` the head, the crown's spikes to their tips, the hand at her brow and the forearm (it moves with the head; the elbow takes part of it); `hairL` and `hairR` the hair masses on either side below the raised arm, never the arm holding the apple; `hem` has a pivot and no region.
- **hydre**: each pair is two heads with their upper necks, the pair's two heads carrying one bone (the user's wish); the three pairs: `pairHaut` the top head and the upper-left head, `pairDroite` the upper-right and the middle-right heads, `pairBas` the middle-left and the lower-left heads; where two necks of different pairs cross, end the polygons before the crossing (the mesh is one layer: a pixel follows one blend); `tail` the last curl to the tip, the coil lying on the ground inside the feet box.
- **chimere**: `lion` the lion's face and the top of the mane; `mane` the mane's long locks on the left; `goat` the goat head with both horns (it sits behind the lion's mane on the right: the boundary runs between them); `snake` the snake tail from its base to the head and tongue; the rock and the four paws inside the pin (the front paws stand on the rock's top, the hind paw at the bottom right).

If a picture wants a different grouping (another pair of heads, the mane in the lion's bone), change the block and `FOE_MOTIONS` together (the rig-order test pins them), and say so in the skill's notes.

- [ ] **Step 3: Bake and look at the debug views**

Run: `tools/art/run_docker.sh rig bake --stage eris` (then each of the three others), `tools/art/run_docker.sh rig debug --stage eris` (each), and read `tools/art/rig-out/rig_<id>.png` (Read tool). The bake prints each feet box: every foot (or the coil's ground line, the rock) inside it.

- [ ] **Step 4: Check and fix until all hold** (per rig, on the debug view)

- each rigid region coloured to its tips and a little beyond into the background, fading toward its pivot as its ramp says; no colour on a part that must stay (a face, a body, another pair's head);
- the four rigid colours never overlap except along a blur;
- every foot (the base) inside the magenta feet box, nothing coloured inside it;
- the pivots at the joints (the elbow, the neck bases, the hip of the tail, the snake's base).

- [ ] **Step 5: Probes (unit tests)**

Append to `web/src/lib/living/rigs.test.ts`, inside `describe('the rigs', ...)` (the coordinates are the plan's first reading of the pictures: read each one off the grid view; a probe that falls a few px off its part moves to the part's nearest opaque pixel, never to a looser threshold):

```ts
  // The foes' tips and parts, read off the grid views (rig grid --stage <id>): each takes its bone.
  const FOE_PROBES: [string, string, string, number, number][] = [
    ['eris', 'arm', 'apple', 305, 185],
    ['eris', 'hair', 'streaming strands', 750, 330],
    ['eris', 'hem', 'left flare', 330, 935],
    ['eris_flustered', 'head', 'crown spike', 469, 25],
    ['eris_flustered', 'hairR', 'right locks', 690, 450],
    ['hydre', 'tail', 'last curl', 700, 930],
    ['chimere', 'lion', 'eye', 431, 190],
    ['chimere', 'goat', 'eye', 577, 205],
    ['chimere', 'snake', 'head', 729, 383],
    ['chimere', 'mane', 'long lock', 310, 460],
  ];
  it.each(FOE_PROBES)('%s: the %s carries its %s (%i, %i)', (rig, bone, _what, x, y) => {
    const r = rigOf(rig);
    expect(weightsAt(r.weights, x, y)[r.bones.indexOf(bone)]).toBeGreaterThanOrEqual(0.9);
  });

  // The Hydra's six heads in three pairs (the user: "make a couple of heads move together as a pair"):
  // each head's eye carries its pair's bone, and no other pair's.
  const HYDRA_HEADS: [string, string, number, number][] = [
    ['pairHaut', 'top head', 539, 78],
    ['pairHaut', 'upper-left head', 396, 186],
    ['pairDroite', 'upper-right head', 682, 176],
    ['pairDroite', 'middle-right head', 657, 308],
    ['pairBas', 'middle-left head', 412, 333],
    ['pairBas', 'lower-left head', 417, 510],
  ];
  it.each(HYDRA_HEADS)('hydre: the %s bone moves the %s (%i, %i), alone', (pair, _what, x, y) => {
    const r = rigOf('hydre');
    const w = weightsAt(r.weights, x, y);
    for (const p of ['pairHaut', 'pairDroite', 'pairBas']) {
      if (p === pair) expect(w[r.bones.indexOf(p)], p).toBeGreaterThanOrEqual(0.9);
      else expect(w[r.bones.indexOf(p)], p).toBeLessThanOrEqual(0.1);
    }
  });
```

Run: `STACK=battle scripts/npm.sh run test -- src/lib/living`
Expected: PASS (fix the rig, not the probe's threshold, until it does).

- [ ] **Step 6: Watch them in the lab** (frames the implementer looks at)

Rebuild the lab, serve it on 8745 (background), run `lab_foes.py eris eris_flustered hydre chimere` under the lock. Read every shot (`<id>_a1.5_t1.2.png`, `_t3.6`, `_a3_t1.2.png`, `_a3_t3.6.png`, `_weights.png`): at 1.5x and at 3x, no tearing, no streak off the outline, no part lagging behind its bone (a strand, a horn, a head), the face never warped, the feet (the coil, the rock) still; the weights view as on the debug view. Fix the rig and repeat until clean. `errors` must be empty. Stop the server.

- [ ] **Step 7: The skill's notes**

In `.claude/skills/dragon-rig/SKILL.md`: update the description frontmatter to "Author, bake and check the living figures' rigs: the dragon's stages (head, wings, tail, breath) and the battle's foes (spec 2026-10-03 living battle), on one painted sprite each, WebGL2 mesh skinning. Use when a dragon stage or a foe picture changes, when a part lags, tears or moves when it should not (a horn, a wing tip, the feet), or to tune a rig's motion regions." Add a section `## The foes` after "Stage notes": the foe keys, the padding (x 219-804), `"sprite"`, `polys`, the four rigid bones per foe (from `foes.ts`), `rig foe-sheet`, the lab's « Les adversaires » with « Comme au combat », and one note line per rig of this task saying what was hard and how it was solved (e.g. the Hydre: where two necks of different pairs cross, the polygons stop short of the crossing).

- [ ] **Step 8: Commit**

```bash
git add tools/art/rig.json web/src/lib/living/rig/foe_eris.json web/src/lib/living/rig/foe_eris_flustered.json web/src/lib/living/rig/foe_hydre.json web/src/lib/living/rig/foe_chimere.json web/src/lib/living/rigs.test.ts web/src/lib/living/foes.ts .claude/skills/dragon-rig/SKILL.md
git commit -m "Living battle, rigs I: Éris (hair, apple arm, hem), Éris routed (head with the hand at her brow, hair), the Hydre (six heads in three pairs, each pair one bone; the tail tip) and the Chimère (lion, mane, goat, snake), baked, checked on the debug views and in the lab at 1.5x and 3x; probes pin the apple, the crown, the pairs and the snake"
```

---

### Task 5: Rigs II: Écho, Léthé, Protée, les Sirènes; every foe alive

**Files:**
- Modify: `tools/art/rig.json`, `web/src/lib/living/rigs.test.ts`, `web/src/lib/living/foes.test.ts`, `.claude/skills/dragon-rig/SKILL.md`, `web/src/lib/living/foes.ts` (only if a picture asks)
- Create (baked): `web/src/lib/living/rig/foe_echo.json`, `foe_lethe.json`, `foe_protee.json`, `foe_sirenes.json`; `docs/art/foe-rig.png`

**Interfaces:**
- Consumes: as Task 4.
- Produces: all eight foe rigs baked; `livingFoe(r) === r` for every `FOE_RIGS` entry; `docs/art/foe-rig.png`.

- [ ] **Step 1: Write the four blocks** (first drafts; read the grid views first, as in Task 4 Step 1)

```json
  "echo": {
    "sprite": "web/public/art/lieutenants/echo_cut.webp",
    "bones": {
      "ghostL": { "pivot": [340, 500], "poly": [[265,50],[400,50],[405,200],[400,430],[420,860],[350,880],[300,860],[265,330]], "ramp": [900, 420], "blur": 6 },
      "ghostR": { "pivot": [660, 500], "poly": [[600,50],[740,50],[755,330],[700,860],[640,880],[580,860],[600,430],[595,200]], "ramp": [900, 420], "blur": 6 },
      "hairL":  { "pivot": [420, 200], "poly": [[395,200],[445,200],[450,440],[395,440]], "ramp_from_pivot": [20, 200], "blur": 6 },
      "hairR":  { "pivot": [620, 200], "poly": [[595,200],[645,200],[650,440],[595,440]], "ramp_from_pivot": [20, 200], "blur": 6 },
      "chest":  { "pivot": [500, 330], "ellipse": [500, 330, 60, 60], "blur": 30 },
      "lift":   { "pivot": [500, 900], "all": true, "ramp": [900, 500], "blur": 0 }
    },
    "pin": { "rect": [340, 860, 690, 1024], "blur": 12 }
  },
  "lethe": {
    "sprite": "web/public/art/lieutenants/lethe_cut.webp",
    "bones": {
      "ribbonL": { "pivot": [400, 400], "poly": [[300,420],[420,400],[430,560],[400,640],[420,800],[330,800],[295,640]], "ramp_from_pivot": [40, 300], "blur": 10 },
      "ribbonR": { "pivot": [630, 380], "poly": [[620,380],[720,400],[740,560],[740,800],[650,800],[640,640],[620,500]], "ramp_from_pivot": [40, 300], "blur": 10 },
      "robe":    { "pivot": [520, 560], "poly": [[430,560],[620,560],[635,820],[425,820]], "ramp": [560, 800], "blur": 14 },
      "hair":    { "pivot": [515, 60], "polys": [[[375,150],[440,150],[440,420],[380,420]], [[580,150],[650,150],[655,420],[590,420]]], "ramp": [150, 400], "blur": 8 },
      "chest":   { "pivot": [515, 280], "ellipse": [515, 280, 70, 70], "blur": 30 },
      "lift":    { "pivot": [515, 880], "all": true, "ramp": [880, 560], "blur": 0 }
    },
    "pin": { "rect": [280, 860, 730, 1024], "blur": 12 }
  },
  "protee": {
    "sprite": "web/public/art/lieutenants/protee_cut.webp",
    "bones": {
      "tentacle": { "pivot": [650, 440], "poly": [[640,430],[740,440],[790,560],[780,700],[700,730],[640,690],[630,560]], "ramp_from_pivot": [30, 220], "blur": 8 },
      "beard":    { "pivot": [515, 230], "poly": [[445,220],[575,220],[580,350],[560,500],[480,505],[445,380]], "ramp_from_pivot": [30, 200], "blur": 10 },
      "waveL":    { "pivot": [290, 880], "poly": [[255,800],[310,800],[310,960],[255,960]], "ramp": [960, 820], "blur": 6 },
      "waveR":    { "pivot": [670, 850], "poly": [[570,730],[770,780],[770,950],[580,950]], "ramp": [960, 760], "blur": 10 },
      "chest":    { "pivot": [610, 400], "ellipse": [610, 400, 70, 80], "blur": 24 },
      "lift":     { "pivot": [500, 900] }
    },
    "pin": { "rect": [250, 940, 780, 1024], "blur": 8 }
  },
  "sirenes": {
    "sprite": "web/public/art/lieutenants/sirenes_cut.webp",
    "bones": {
      "wingL":     { "pivot": [340, 260], "poly": [[235,250],[340,230],[360,400],[350,650],[300,840],[240,830],[230,600]], "ramp_from_pivot": [40, 300], "blur": 10 },
      "wingInner": { "pivot": [430, 430], "poly": [[400,430],[470,430],[470,620],[400,620]], "ramp_from_pivot": [20, 180], "blur": 8 },
      "wingC":     { "pivot": [520, 380], "poly": [[510,360],[620,380],[700,600],[700,880],[640,880],[600,700],[560,560],[510,440]], "ramp_from_pivot": [40, 300], "blur": 10 },
      "wingR":     { "pivot": [690, 320], "poly": [[680,300],[770,320],[780,700],[740,700],[700,560],[680,420]], "ramp_from_pivot": [40, 300], "blur": 10 },
      "chest":     { "pivot": [500, 380], "ellipse": [500, 380, 220, 120], "blur": 30 },
      "lift":      { "pivot": [500, 620], "all": true, "ramp": [600, 300], "blur": 0 }
    },
    "pin": { "rect": [330, 580, 650, 1024], "blur": 8 }
  }
```

What each region must hold:
- **echo**: `ghostL`, `ghostR` the two faded copies' visible parts (heads, raised arms, robes' edges beside the main figure), drifting more toward their heads (ramp), their feet inside the feet box; never the main figure; `hairL`, `hairR` the main figure's side locks below her hands.
- **lethe**: `ribbonL`, `ribbonR` the two outer river bands, flowing from their tops; `robe` the lower robe between them, drifting sideways more toward its foot; `hair` the long hair on both shoulders (one turn about the crown sways both sides together); the pool at her base inside the pin.
- **protee**: the trident (its three tips, the shaft through the waves, and the hand holding it) has **no** weight at all: no region reaches it (blur included: keep 30 px between a region and the shaft) and `lift` has no region; `tentacle` the tentacle arm from the elbow to the curl's tip; `beard` the beard from the chin to its tip; `waveL`, `waveR` the wave crests either side, their foot inside the feet box.
- **sirenes**: the four wing regions: the left sister's outer wing, her inner wing (between her and the middle sister, below the lyre), the middle sister's wing, the right sister's wing; every wing tip that hangs below the rock's top included; the rock and the talons inside the pin. If the inner wing is not a part of its own on the picture, give `wingInner` a pivot and no region and set its motion to `null` in `foes.ts` (say so in the notes).

- [ ] **Step 2: Bake, debug, check** exactly as Task 4 Steps 3-4 (`--stage echo`, `lethe`, `protee`, `sirenes`).

- [ ] **Step 3: Probes, the steady trident, every foe alive**

Extend `FOE_PROBES` in `rigs.test.ts` with (read each point off its grid view):

```ts
    ['echo', 'ghostL', 'face', 375, 125],
    ['echo', 'ghostR', 'face', 628, 125],
    ['lethe', 'ribbonL', 'band', 320, 650],
    ['lethe', 'ribbonR', 'band', 720, 700],
    ['protee', 'tentacle', 'curl', 690, 650],
    ['protee', 'beard', 'tip', 510, 480],
    ['sirenes', 'wingL', 'tip', 262, 800],
    ['sirenes', 'wingC', 'tip', 690, 860],
    ['sirenes', 'wingR', 'tip', 770, 680],
```

and add, inside `describe('the rigs', ...)`:

```ts
  // Spec 2026-10-03: "the trident stays steady". Its tips, its shaft and the shaft through the waves,
  // read off the grid view (rig grid --stage protee): no bone at all.
  it.each([
    [274, 90],
    [329, 20],
    [384, 60],
    [354, 300],
    [359, 600],
    [355, 850],
  ])("protee: the trident (%i, %i) carries no bone's weight", (x, y) => {
    const w = weightsAt(rigOf('protee').weights, x, y);
    expect(Math.max(...w)).toBeLessThanOrEqual(0.02);
  });

  it('rigs every foe', () => {
    expect([...FOES].sort()).toEqual([...FOE_RIGS].sort());
  });
```

In `web/src/lib/living/foes.test.ts`, replace the "lives only once its rig is baked" body with the now-final rule: `for (const r of FOE_RIGS) expect(livingFoe(r), r).toBe(r);`.

Run: `STACK=battle scripts/npm.sh run test -- src/lib/living`
Expected: PASS.

- [ ] **Step 4: Watch all eight in the lab**

Rebuild the lab, serve on 8745, run `lab_foes.py` (every tile) under the lock, and read every shot of the four new rigs as in Task 4 Step 6; then read one `_a1.5_t1.2.png` of each of the eight (all alive, no tile left as « image fixe » or « chargement »). Fix and repeat until clean. Stop the server.

- [ ] **Step 5: The record and the notes**

Run: `tools/art/run_docker.sh rig foe-sheet` and read `docs/art/foe-rig.png` (all eight debug views). Add this task's four note lines to the skill's "The foes" section (Protée: the trident and its hand carry nothing, `lift` has no region, the breath is the chest's alone; Écho: the ghosts drift, ramped so their feet stay; ...).

- [ ] **Step 6: Run everything, then commit**

Run: `STACK=battle scripts/npm.sh run test`, `STACK=battle scripts/npm.sh run check`, `STACK=battle scripts/npm.sh run build`
Expected: PASS; 0 errors, 0 warnings; the build lists eight `foe_<id>-<hash>.js` chunks of about 35 KB and no warning.

```bash
git add tools/art/rig.json web/src/lib/living/rig/foe_echo.json web/src/lib/living/rig/foe_lethe.json web/src/lib/living/rig/foe_protee.json web/src/lib/living/rig/foe_sirenes.json web/src/lib/living/rigs.test.ts web/src/lib/living/foes.test.ts web/src/lib/living/foes.ts docs/art/foe-rig.png .claude/skills/dragon-rig/SKILL.md
git commit -m "Living battle, rigs II: Écho (the two ghosts drift, her hair), Léthé (two river bands, the robe, her hair), Protée (tentacle, beard, waves; the trident carries no weight at all) and les Sirènes (four wing bones), baked and checked on the debug views and in the lab; every foe now lives; docs/art/foe-rig.png records the eight rigs"
```

---

### Task 6: The battle alive

**Files:**
- Modify: `web/src/components/battle/Combatant.svelte`, `web/src/components/battle/BattleStage.svelte`, `web/playwright.config.ts`, `web/e2e/dragon.ts`, `web/e2e/helpers.ts`, `web/e2e/living-dragon.spec.ts`, `web/e2e/scenes-battle-victory.spec.ts`, `web/e2e/scenes-battle-play.spec.ts`, `web/e2e/playability-ui4.spec.ts`
- Create: `web/e2e/living-battle.spec.ts`

**Interfaces:**
- Consumes: `DragonFigure` prop `living?: LivingRig | null` (Task 3); `livingStage`, `livingFoe`, `foeRigFor`, `FOE_ASPECT` (`stages.ts`, Task 1); the eight baked foe rigs (Tasks 4-5); e2e helpers `settledDragon`, `dragonTint`, `dragonWorn`, `isolateDragon`, `compareShots`, `Region` (`web/e2e/dragon.ts`).
- Produces: `Combatant` props `{ src; alt; side; mirror; tint?; overlays?; living?: LivingRig | null; aspect: number; reaction; nonce; testId; reduced; hits? }` (no `idle`); `web/e2e/dragon.ts` `mockDragon(page: Page, id: number, dragon: () => Record<string, unknown>): Promise<void>`; `web/e2e/helpers.ts` `victoryProgression(o?: Record<string, unknown>)`.

- [ ] **Step 1: Move the shared e2e helpers**

- Move `mockDragon` from `web/e2e/living-dragon.spec.ts` to `web/e2e/dragon.ts` (exported, same body, with `import type { Page } from '@playwright/test'` already there), and import it in `living-dragon.spec.ts`.
- Move `progression()` from `web/e2e/scenes-battle-victory.spec.ts` to `web/e2e/helpers.ts` as `export function victoryProgression(o: Record<string, unknown> = {})` (same body and comment), and in the victory spec replace every `progression(` with `victoryProgression(` and import it.

- [ ] **Step 2: Write the failing e2e**

`web/playwright.config.ts`: `chromium-gl` gets `testMatch: ['**/living-dragon.spec.ts', '**/living-battle.spec.ts']`; `desktop`'s `testIgnore` gets `'**/living-battle.spec.ts'`; extend the projects comment: "`chromium-gl` also runs living-battle.spec.ts (spec 2026-10-03 living battle: the fighters' canvases, their motion and fallbacks, the battle's sizes)".

Create `web/e2e/living-battle.spec.ts`:

```ts
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
const FOES = { eris, hydre, chimere, echo, lethe, protee, sirenes };
/** stages.ts FOE_WIDTH: a foe's portrait, padded, centred, into the 1024 frame. */
const FOE_WIDTH = 585;
const PAD = Math.floor((1024 - FOE_WIDTH) / 2);
// The largest channel change two shots of a foe must reach: a starting value, replaced in Step 6 by half
// the smallest foe's measured change (at least 8), with the numbers and their date written here.
const MOVES = 12;
// The fighters' own files: the living chunk and every rig (`dragon_<stage>`, `foe_<id>`; a build's
// `-<hash>.js`, the dev server's `.json`).
const LIVING_FILES = /\/(LivingDragon[^/]*\.(js|svelte)|(dragon|foe)_[a-z_]+(-[\w-]+)?\.(js|json))(\?|$)/;
const opponent = (page: Page) => page.getByTestId('battle-opponent');
const dragon = (page: Page) => page.getByTestId('battle-dragon');
const canvases = (page: Page) => page.locator('[data-testid="scene-battle"] .dragon-living canvas');
const frames = (layer: ReturnType<Page['getByTestId']>) => layer.locator('canvas').evaluate((c) => Number((c as HTMLCanvasElement).dataset.frames ?? 0));

async function hero(request: APIRequestContext, testInfo: TestInfo, tag: string) {
  const id = await createProfileApi(request, uniqueName(`${tag}-${testInfo.project.name}`));
  const text = await createText(request, { title: uniqueName('Combat vivant'), body: BODY, level: '10H' });
  return { id, text };
}

async function muster(page: Page, id: number, textId: number, foe: string) {
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
  await muster(page, id, text.id, 'hydre');
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
    await muster(page, id, text.id, foe);
    expect(await settledDragon(opponent(page)), foe).toBe('living');
    await reactionsDone(page);
    await page.screenshot({ path: testInfo.outputPath(`battle-${foe}.png`) });
    await isolateDragon(page, 'battle', 'battle-opponent');
    const box = opponent(page).locator('.combatant-figure');
    const mirrored = await opponent(page).locator('.facing').evaluate((el) => el.classList.contains('mirror'));
    const first = await box.screenshot();
    // The threshold: half the smallest foe's largest channel change measured here, and well above the
    // base's 0 (write the measured numbers and their date in this comment, as living-dragon.spec.ts does).
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
});

test('a hit plays on the living opponent', async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LB8');
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  const HALF = 'Les fées dansent dans la clairière. Elles chante et les oiseaux les écoutent.';
  await seedPlay(page, { profileId: id, textId: text.id, phase: 'results', draft: DRAFT, current: HALF, opponent: 'sirenes', progression: victoryProgression() });
  await page.goto(`/#/p/${id}/play/${text.id}`);
  await expectBattle(page, 'victory');
  await expect(opponent(page)).toHaveAttribute('data-hits', '1');
  expect(await settledDragon(opponent(page))).toBe('living');
  await expect(opponent(page)).toHaveAttribute('data-reaction', /retreat|defeat|taunt/);
  await expect(canvases(page)).toHaveCount(2);
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
```

Run: `PW_WORKERS=1 STACK=battle scripts/playwright.sh living-battle > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/battle/t6-red.log 2>&1`
Expected: FAIL (the battle still draws `img` pictures: `data-motion` is `still` for both).

- [ ] **Step 3: `Combatant.svelte`**

Replace the script and markup with:

```svelte
<script lang="ts">
  // A combatant on the battle stage (UI4 Ruling C10; spec 2026-10-03 living battle, plan Rulings B5,
  // B7): an existing cut-out, alive on a canvas when `living` names its rig (DragonFigure's living path:
  // the still picture while it loads, under reduced motion, without WebGL2 or on any failure), reacting
  // through the Web Animations API. `.actor` moves in screen space; `.facing` mirrors the art so the two
  // sides look at each other. `aspect` (the picture's width over its height) gives the figure its box,
  // so the still picture and the canvas take the same place. The dragon wears its pieces (`overlays`,
  // spec 2026-09-29 drachmes §4, R19); the mirror flips the whole figure, pieces included.
  import DragonFigure from '../DragonFigure.svelte';
  import type { OverlayLayer } from '../../lib/world/accessories';
  import type { LivingRig } from '../../lib/living/stages';
  import type { Tint } from '../../lib/world/types';
  import { reactionAnimation, type Reaction } from '../../lib/battle/reactions';

  let {
    src,
    alt,
    side,
    mirror,
    tint = null,
    overlays = [],
    living = null,
    aspect,
    reaction,
    nonce,
    testId,
    reduced,
    hits = 0,
  }: {
    src: string;
    alt: string;
    side: 'left' | 'right';
    mirror: boolean;
    tint?: Tint | null;
    overlays?: OverlayLayer[];
    living?: LivingRig | null;
    aspect: number;
    reaction: Reaction;
    nonce: number;
    testId: string;
    reduced: boolean;
    hits?: number;
  } = $props();

  let actor: HTMLDivElement | undefined = $state();

  $effect(() => {
    void nonce; // every reaction replays, the same one twice included
    const el = actor;
    const spec = reactionAnimation(reaction, { away: side === 'right' ? 1 : -1, reduced });
    if (!el || !spec) return;
    const a = el.animate(spec.keyframes, spec.options);
    return () => {
      // A held end pose (defeat, retreat) stays until the next reaction replaces it.
      if (spec.options.fill !== 'forwards') a.cancel();
    };
  });
</script>

<div class="combatant {side}" data-testid={testId} data-reaction={reaction} data-hits={hits}>
  <div class="actor" bind:this={actor}>
    <div class="facing" class:mirror>
      <DragonFigure {src} {alt} {tint} {overlays} {living} className="combatant-figure" style="aspect-ratio: {aspect}" />
    </div>
  </div>
</div>
```

and in its style block replace the last rule's selector with `.facing :global(.combatant-figure img.dragon-base)` (the living host is sized by its own aspect).

- [ ] **Step 4: `BattleStage.svelte`**

- import `import { FOE_ASPECT, foeRigFor, livingFoe, livingStage } from '../../lib/living/stages';`
- replace the `idle` comment with: "Ruling C12: the particles drift only while no text is read or written: the muster and the victory (M14, the TTS runs on an iPad). The combatants live in every phase (spec 2026-10-03 living battle, plan Ruling B7)."
- replace the `opponentArt` derivation with:

```ts
  // UI4 Task A: Éris's routed pose - a sore loser caught off guard - replaces her standing card once
  // her `defeat` reaction plays, on top of the boss card the muster already showed; she has her own rig
  // for it (spec 2026-10-03 living battle, plan Ruling B6).
  const flustered = $derived(battle?.opponent.id === 'eris' && battleStage.opponent.reaction === 'defeat');
  const opponentArt = $derived(flustered ? ART.erisFlustered : (battle?.opponent.art ?? ''));
  // Both fighters alive (plan Rulings B7, B8): the dragon's stage (never the egg) and the opponent's
  // rig, none under reduced motion.
  const dragonLiving = $derived(reduced ? null : livingStage(dragonStage));
  const opponentLiving = $derived(reduced || !battle ? null : livingFoe(foeRigFor(battle.opponent.id, flustered)));
```

- the dragon's `<Combatant>`: remove `{idle}`, add `living={dragonLiving}` and `aspect={1}`; the opponent's: remove `{idle}`, add `living={opponentLiving}` and `aspect={FOE_ASPECT}`.

- [ ] **Step 5: The WebKit specs read the fighter in either form**

- `web/e2e/scenes-battle-victory.spec.ts` (the lit-combatants check, around line 58): `page.getByTestId('battle-opponent').locator('.dragon-base')` in place of `.locator('img')`.
- `web/e2e/playability-ui4.spec.ts` (Éris's two boss poses, around line 330): `page.getByTestId('battle-opponent').locator('.dragon-base')).toHaveAttribute('data-src', pose === 'defeat' ? ... : ...)` in place of `.locator('img')).toHaveAttribute('src', ...)`.
- `web/e2e/scenes-battle-play.spec.ts` (around line 298): the comment becomes "Final review M14: while she writes, nothing moves behind the text by CSS or Web Animations: no particles, no breathing; the combatants live on canvases (spec 2026-10-03 living battle), which run no animation of the document's."
- grep `web/e2e` for any other `battle-(opponent|dragon)"?\)?\.locator\('img` or `idle-breathe` and convert it the same way.

- [ ] **Step 6: Run the new spec, measure, set the threshold**

Run: `PW_WORKERS=1 STACK=battle scripts/playwright.sh living-battle > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/battle/t6-green.log 2>&1`
Expected: PASS. Read the "foe motion" annotation (the list reporter prints it; or add `console.log` temporarily and remove it): set `MOVES` to half the smallest measured value (and at least 8), and write the measured numbers with the date in the comment above it. Look at the seven `battle-<foe>.png` files under `web/test-results/` (Read tool): each opponent drawn alive, mirrored as before, nothing torn. Run the spec again: PASS.

- [ ] **Step 7: The battle specs on WebKit and the walk**

Run: `PW_WORKERS=1 STACK=battle scripts/playwright.sh scenes-battle living-dragon > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/battle/t6-battle.log 2>&1`
Expected: PASS on `desktop`, `ipad`, `chromium` and `chromium-gl`.

Run: `PW_WORKERS=1 STACK=battle scripts/playwright.sh --config playwright.playability.config.ts playability-ui4 > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/battle/t6-walk.log 2>&1`
Expected: PASS.

Then `STACK=battle scripts/npm.sh run check` and `STACK=battle scripts/npm.sh run test`: 0 errors, 0 warnings; PASS.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/battle/Combatant.svelte web/src/components/battle/BattleStage.svelte web/playwright.config.ts web/e2e
git commit -m "Living battle, the stage: both fighters live in every phase through DragonFigure's living path (the opponent's rig untinted, the dragon's stage with its tint and pieces, the egg and reduced motion still), Éris routed swaps to her own rig under her held defeat pose, the CSS breathing goes; living-battle.spec.ts (chromium-gl) checks the canvases, the fallbacks, each foe's motion and still base, the reactions, the compact band and ten battles in a row; the WebKit specs read either form"
```

---

### Task 7: Bigger fighters

**Files:**
- Modify: `web/src/components/battle/BattleStage.svelte` (styles), `web/e2e/living-battle.spec.ts`

**Interfaces:**
- Consumes: Task 6's stage and spec (`hero`, `muster`, `mockDragon`, `seedPlay`, `resumeSeeded`, `victoryProgression`, `settledDragon`).
- Produces: `.battle-stage` custom properties `--feet`, `--dragon-feet`, `--hold-room`, `--foe-h`, `--dragon-h` (plan Ruling B9).

- [ ] **Step 1: Write the failing layout test**

Append to `web/e2e/living-battle.spec.ts`:

```ts
// Plan Ruling B9: each fighter fills its side column, may tuck under the parchment's edge (drawn above
// it) by at most 20 % (the dragon) or 15 % (the opponent) of its box width, never passes under the hold
// bar, the HUD or the exit sign, nor off the screen; the opponent stays the larger; neither is smaller
// than before this spec (the dragon clamp(140px, 36vh, 320px), the opponent clamp(180px, 50vh, 440px)).
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 1024 },
  { width: 1024, height: 640 },
];
const TUCK = { dragon: 0.2, opponent: 0.15 };

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
      dragon: one('[data-testid="battle-dragon"] .combatant-figure'),
      opponent: one('[data-testid="battle-opponent"] .combatant-figure'),
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

async function expectClear(page: Page, where: string) {
  const s = await stageBoxes(page);
  const d = s.dragon!;
  const o = s.opponent!;
  for (const [name, f, tuck] of [['dragon', d, TUCK.dragon], ['opponent', o, TUCK.opponent]] as const) {
    expect(f.x, `${where}: the ${name} stays on screen`).toBeGreaterThanOrEqual(-1);
    expect(f.x + f.w, `${where}: the ${name} stays on screen`).toBeLessThanOrEqual(s.vw + 1);
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

test('the bigger fighters keep the battle UI clear at 1280x720, 1366x1024 and 1024x640', async ({ page, request }, testInfo) => {
  test.setTimeout(300_000);
  const sizes: string[] = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    const at = `${vp.width}x${vp.height}`;
    // The muster: the HUD and the exit sign are on the stage.
    const m = await hero(request, testInfo, `LS-m${vp.width}`);
    await mockDragon(page, m.id, () => ({ stage: 'ancestral' }));
    await muster(page, m.id, m.text.id, 'eris');
    await reactionsDone(page);
    const s = await expectClear(page, `${at} muster`);
    sizes.push(`${at}: dragon ${Math.round(s.dragon!.h)}, opponent ${Math.round(s.opponent!.h)} (stage ${s.vh})`);
    await page.screenshot({ path: testInfo.outputPath(`sizes-${at}-muster.png`) });
    // The proofreading: the tools and the text on the parchment.
    const p = await hero(request, testInfo, `LS-p${vp.width}`);
    await mockDragon(page, p.id, () => ({ stage: 'adult' }));
    await seedPlay(page, { profileId: p.id, textId: p.text.id, phase: 'proofreading', draft: DRAFT, opponent: 'hydre' });
    await page.goto(`/#/p/${p.id}/play/${p.text.id}`);
    await expectBattle(page, 'muster');
    await resumeSeeded(page);
    await expectBattle(page, 'proofreading');
    await reactionsDone(page);
    await expectClear(page, `${at} proofreading`);
    await page.screenshot({ path: testInfo.outputPath(`sizes-${at}-proofreading.png`) });
    // The victory: the sheet and its dialogue dock.
    const v = await hero(request, testInfo, `LS-v${vp.width}`);
    await mockDragon(page, v.id, () => ({ stage: 'illustre' }));
    await seedPlay(page, { profileId: v.id, textId: v.text.id, phase: 'results', draft: DRAFT, current: BODY, opponent: 'sirenes', progression: victoryProgression() });
    await page.goto(`/#/p/${v.id}/play/${v.text.id}`);
    await expectBattle(page, 'victory');
    await reactionsDone(page);
    await expectClear(page, `${at} victory`);
    await page.screenshot({ path: testInfo.outputPath(`sizes-${at}-victory.png`) });
  }
  testInfo.annotations.push({ type: 'fighter sizes', description: sizes.join('; ') });
});

test('the living and the still fighters take the same box', async ({ page, request }, testInfo) => {
  const { id, text } = await hero(request, testInfo, 'LS-box');
  await mockDragon(page, id, () => ({ stage: 'adult' }));
  await muster(page, id, text.id, 'chimere');
  expect(await settledDragon(opponent(page))).toBe('living');
  expect(await settledDragon(dragon(page))).toBe('living');
  await reactionsDone(page);
  const living = await stageBoxes(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await settledDragon(opponent(page))).toBe('still');
  expect(await settledDragon(dragon(page))).toBe('still');
  const still = await stageBoxes(page);
  for (const k of ['dragon', 'opponent'] as const) {
    for (const f of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(living[k]![f] - still[k]![f]), `${k} ${f}`).toBeLessThanOrEqual(1);
  }
});
```

Run: `PW_WORKERS=1 STACK=battle scripts/playwright.sh living-battle > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/battle/t7-red.log 2>&1`
Expected: the sizes test FAILS (today's dragon tucks more than 20 % at 1024x640 and the fighters are the old sizes); the same-box test PASSES (Task 6 already gives both forms one box: if it fails, fix `Combatant`/`LivingDragon` first).

- [ ] **Step 2: The new sizes**

In `web/src/components/battle/BattleStage.svelte`'s styles:

- in `.battle-stage`, after `--top`:

```css
    /* Spec 2026-10-03 living battle, plan Ruling B9: each fighter fills its side column and may tuck
       under the parchment's edge (drawn above it) by a bounded share of its box: 20 % for the dragon,
       15 % for the opponent, whose portrait box is 585 / 1024 as wide as high. 2.06 = 1 / (0.5713 x
       0.85); 1.25 = 1 / 0.8. The height caps keep the opponent under the hold bar and both under the
       HUD. Measured on screenshots at 1280x720, 1366x1024 and 1024x640 (living-battle.spec.ts). */
    --feet: calc(4vh + env(safe-area-inset-bottom));
    --dragon-feet: var(--feet);
    --hold-room: 96px;
    --foe-h: min(calc((var(--side) - 8px) * 2.06), calc(100vh - var(--feet) - var(--top) - var(--hold-room)));
    --dragon-h: min(calc((var(--side) - 8px) * 1.25), calc(100vh - var(--dragon-feet) - var(--top) - 16px));
```

- replace the two combatant rules and the has-exit rule with:

```css
  .battle-scene :global(.combatant.left) {
    --h: var(--dragon-h);
    --feet: var(--dragon-feet);
    --left-x: max(8px, calc((var(--side) - var(--h)) / 2));
  }
  .battle-scene :global(.combatant.right) {
    --h: var(--foe-h);
    --right-x: max(8px, calc((var(--side) - var(--h) * 0.5713) / 2));
  }
  /* The exit sign sits in the bottom-left corner: the dragon stands above it, not behind it. */
  .battle-stage.has-exit {
    --dragon-feet: calc(84px + env(safe-area-inset-bottom));
  }
```

- `.hit-burst`: `bottom: calc(var(--feet) + var(--foe-h) / 2 - 60px);` in place of `bottom: 30vh;` (the burst stays at the opponent's middle).
- The compact rules are unchanged (they set `--h` and `--feet` on the combatants with a more specific selector).

- [ ] **Step 3: Tune on the screenshots**

Run the layout tests: `PW_WORKERS=1 STACK=battle scripts/playwright.sh living-battle > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/battle/t7-tune.log 2>&1`. Read the nine `sizes-<viewport>-<phase>.png` under `web/test-results/` (Read tool). Tune `--hold-room` to the hold bar's real height plus 12 px, and the 2.06 / 1.25 factors, until: the tests pass; each fighter stands in its column with no face, head or apple under the parchment (only a wing tip, a hair strand, a tail may pass under it); nothing touches the hold bar, the HUD or the exit sign. Keep the factors' derivation comment true. Record the measured heights (the "fighter sizes" annotation) for Task 8.

- [ ] **Step 4: Every battle spec still holds**

Run: `PW_WORKERS=1 STACK=battle scripts/playwright.sh scenes-battle scenes-ipad-layout living-battle > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/battle/t7-battle.log 2>&1`
Expected: PASS (the compact band's checks, the opponent's height `> 150` in full layout, the parchment's legibility).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/battle/BattleStage.svelte web/e2e/living-battle.spec.ts
git commit -m "Living battle, sizes: each fighter fills its side column (the opponent up to 2.06 x the column, the dragon 1.25 x), tucking under the parchment's edge by at most 15 % / 20 % of its box, under the hold bar and the HUD and clear of the exit sign; the hit burst follows the opponent's middle; living-battle.spec.ts measures it at 1280x720, 1366x1024 and 1024x640 in the muster, the proofreading and the victory, and checks the living and still fighters share one box"
```

---

### Task 8: Full gate, docs, the look checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-10-03-living-battle-design.md`, `.claude/skills/dragon-rig/SKILL.md` (if anything is stale)

- [ ] **Step 1: The full gate**

Run: `STACK=battle PW_WORKERS=2 scripts/check.sh > C:/Users/nicol/.claude/jobs/9ac9a508/tmp/battle/check.log 2>&1` (background; follow the Playwright container with `docker logs -f` if the shell is reaped)
Expected: everything green: vitest (the guards included), `svelte-check` 0 errors 0 warnings, the e2e `tsc`, a warning-free build, every e2e project. Any failure is fixed (CLAUDE.md: never "pre-existing"), then the gate is run again.

- [ ] **Step 2: The lab for the user**

Rebuild the lab (`STACK=battle scripts/npm.sh exec -- vite build --config vite.lab.config.ts`) and run `lab_foes.py` once more; read one frame per foe. Leave nothing served.

- [ ] **Step 3: Update the spec: status, and the look checklist**

In `docs/superpowers/specs/2026-10-03-living-battle-design.md`, set the status line to "Status: implemented (plan 2026-10-03-living-battle.md); awaiting the user's look." and append:

```markdown
## The look (for the user)

The rigs went into the battle without a stop (the user's choice, 2026-10-03): this is what to look at,
and the small adjustments come after.

How to see them:
- The lab: `STACK=battle scripts/npm.sh exec -- vite build --config vite.lab.config.ts`, then
  `python -m http.server 8745 --directory web/dist-lab` and open http://localhost:8745/lab.html,
  section « Les adversaires » (« Comme au combat » mirrors them as in the battle; « Poids » shows each
  bone's region; « Amplitude » 1.5x is the game's).
- In a battle: any free text with `?encounter=<id>` (eris, hydre, chimere, echo, lethe, protee,
  sirenes) on the play link; Éris's flustered pose shows when she is beaten.
- The record: `docs/art/foe-rig.png` (the eight rigs' regions).

What to check, per foe:
- [ ] Éris: the hair streams, the apple arm bobs about the elbow, the hem sways; nothing on her face.
- [ ] Éris routed: her head sways with the hand at her brow; her hair on both sides.
- [ ] Hydre: the heads move in three pairs (top + upper-left, upper-right + middle-right, middle-left
      + lower-left); the tail tip curls. Another pairing is a rig change.
- [ ] Chimère: the lion's head and mane, the mane's locks, the goat, the snake.
- [ ] Écho: the two ghosts drift apart a little; her side locks.
- [ ] Léthé: the two river bands and the robe flow; her long hair.
- [ ] Protée: the tentacle, the beard, the waves; the trident does not move.
- [ ] Sirènes: the four wing bones.
- [ ] Everyone: slow and slight enough (the amplitude is the dragon's 1.5x), the feet / base still.
- [ ] The dragon in battle: alive, tinted, its pieces on.
- [ ] The sizes (measured <fill in from Task 7's "fighter sizes" annotation, per viewport>): bigger,
      the opponent the larger, nothing over the hold bar, the parchment, the HUD or the exit sign.
      The parchment's width bounds the fighters (each fills its side column and tucks under the
      parchment's edge by at most 15-20 %); filling the whole height would need a narrower parchment.
```

Replace the `<fill in ...>` with the measured heights from Task 7 before committing (no placeholder may remain). Under the spec's "Tests", note "A human look ... in the lab, then in a battle: after the implementation (see The look)". List any open item found during the work (CLAUDE.md) under a new "## Open items" heading, or write "None." there.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-10-03-living-battle-design.md .claude/skills/dragon-rig/SKILL.md
git commit -m "Living battle, done: the full gate is green; the spec records the status, the open items and the user's look checklist (the lab's « Les adversaires », a battle per foe, the measured sizes)"
```

---

## Self-review notes

- Spec coverage: generalised engine (Task 1, B1-B4); rigs per creature at most 6 bones (Tasks 4-5, `pose.test`, `rigs.test`); the portraits padded (B2, Tasks 1-3); rigs keyed by creature id, dragon stages keep theirs (B3, Task 2); 8 rigs baked and checked on overlays (Tasks 4-5), the STOP waived by the user (B10) with lab frames and the final look (Task 8); Combatant through DragonFigure's living path for both fighters (B5, Task 6); new sizes tuned at the three viewports, UI clear, opponent larger (B9, Task 7); cost control: the shared loop (30 fps, paused hidden) and two canvases (B12, Task 6); reduced motion / no WebGL2 / lost context / failed shader (shared fallback; Task 6 reduced and no-WebGL2 and failed rig; the lost context and the shader are LivingDragon's, proven by living-dragon.spec.ts on the same component); never tinted (Task 3, Task 6); reactions, mirroring, Éris's swap (Task 6); idle-breathe goes (Task 6); unit tests: each rig bakes, feet zero, Hydra pairs share a bone, poses within amplitudes (Tasks 1, 2, 4, 5); e2e (Tasks 6, 7); the human look (Task 8).
- Out of scope respected: no change outside the battle stage's combatants (the war tent, codex, oracle, victory thumbs keep their still pictures), no new art.
