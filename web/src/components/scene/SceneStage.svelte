<script lang="ts">
  // The scene stage (scenes UI spec §4, plan Ruling 3): fixed full-screen, a 16:9 art box sized to
  // the viewport height (sides cropped on iPad, blurred bands on ultra-wide), the 4:3 safe zone
  // inside it, pointer parallax, reduced motion, and the portrait rotate screen. Children render
  // inside the art box, so their absolute % positions are art %. The HUD snippet renders over the
  // visible part of the art box (final review M13: on a viewport wider than 16:9 it stays on the
  // painting instead of drifting to the window corners over the blurred bands).
  import { onMount, type Snippet } from 'svelte';
  import SceneLayer from './SceneLayer.svelte';
  import SceneTransition from './SceneTransition.svelte';
  import FxCanvas from './FxCanvas.svelte';
  import RotateScreen from './RotateScreen.svelte';
  import HotspotDebug from './HotspotDebug.svelte';
  import { pointerToNorm, stageBox } from '../../lib/scene/geometry';
  import { createSceneRuntime, provideSceneRuntime } from '../../lib/scene/runtime.svelte';
  import { overlayState } from '../../lib/scene/overlayState.svelte';
  import { isDebugMode } from '../../lib/scene/debugMode';
  import { reducedMotion, watchReducedMotion } from '../../lib/juice/motion';
  import { router } from '../../lib/router.svelte';
  import type { SceneContext, SceneDef } from '../../lib/scene/types';

  let {
    scene,
    children,
    hud,
    ctx,
    debug = $bindable(false),
  }: { scene: SceneDef; children?: Snippet; hud?: Snippet; ctx?: SceneContext; debug?: boolean } = $props();

  const readDebug = () => isDebugMode(typeof location === 'undefined' ? '' : location.search, router.route.query);
  const runtime = createSceneRuntime({ reduced: reducedMotion(), debug: readDebug() });
  provideSceneRuntime(runtime);
  // Final review M11: the stage owns the ?debug flag; the scene screen reads it back through
  // `bind:debug` instead of re-deriving it. Published synchronously so the screen's own effects
  // (which run after this child has initialised) already see the right value.
  debug = runtime.debug;

  const EMPTY_CTX: SceneContext = { camp: null, catalog: null };
  // The overlay must mirror exactly what's clickable, so it filters by the same per-hotspot
  // state the real <Hotspot> buttons use (falling back to an empty context for scenes that don't
  // pass one, e.g. before their data has loaded).
  const debugHotspots = $derived(scene.hotspots.filter((h) => h.state(ctx ?? EMPTY_CTX).visible));

  let vw = $state(typeof innerWidth === 'number' ? innerWidth : 1280);
  let vh = $state(typeof innerHeight === 'number' ? innerHeight : 720);
  const box = $derived(stageBox(vw, vh));
  // Final review M4: the blurred backdrop only exists to fill bands around a smaller art box; on
  // an iPad (art box cropped by the viewport) it would be a full-screen blur nobody sees.
  const hasBands = $derived(box.left > 0.5 || box.top > 0.5);
  // The part of the art box that is on screen: the HUD's frame.
  const hudFrame = $derived({
    left: Math.max(0, box.left),
    top: Math.max(0, box.top),
    width: Math.min(vw, box.width),
  });
  // Final review I5: while an overlay is open, the scene behind it is inert (no focus, no taps,
  // hidden from assistive tech). Every scene gets this from the stage.
  const covered = $derived(overlayState.open > 0);

  $effect(() =>
    watchReducedMotion((r) => {
      runtime.reduced = r;
      if (r) resetPointer();
    }),
  );

  $effect(() => {
    runtime.debug = readDebug();
    debug = runtime.debug;
  });

  $effect(() => {
    runtime.artW = box.width;
    runtime.artH = box.height;
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
    if (runtime.reduced || runtime.debug) return;
    const n = pointerToNorm(e.clientX, e.clientY, vw, vh);
    runtime.nx = n.nx;
    runtime.ny = n.ny;
  }

  // A touch drag (or the pointer leaving the stage) has no "resting position" to ease back to on
  // its own, unlike a mouse that keeps hovering somewhere: recentre the parallax so layers ease
  // back to their resting offset instead of staying stuck at the last drag position.
  function resetPointer() {
    runtime.nx = 0;
    runtime.ny = 0;
  }

  // pointerup fires on an ordinary desktop mouse click too, which would snap parallax back to
  // centre while the mouse is still sitting right where it was (there's no "lift the pointer off"
  // for a mouse the way there is for a touch drag); only reset it there for a non-mouse pointer
  // (touch/pen). pointerleave and pointercancel always reset, mouse included.
  function onPointerUp(e: PointerEvent) {
    if (e.pointerType !== 'mouse') resetPointer();
  }
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<main
  class="scene-stage"
  data-testid="scene-{scene.id}"
  data-reduced-motion={runtime.reduced ? 'true' : 'false'}
  inert={covered}
  onpointermove={onPointerMove}
  onpointerleave={resetPointer}
  onpointerup={onPointerUp}
  onpointercancel={resetPointer}
>
  {#if hasBands}
    <img class="stage-backdrop" data-testid="stage-backdrop" src={scene.background} alt="" aria-hidden="true" />
  {/if}
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
        {#if runtime.debug}
          <HotspotDebug sceneId={scene.id} hotspots={debugHotspots} />
        {/if}
      </div>
    </SceneTransition>
    <div
      class="stage-hud"
      data-testid="stage-hud"
      style="left:{hudFrame.left}px;top:{hudFrame.top}px;width:{hudFrame.width}px"
    >
      {@render hud?.()}
    </div>
  </div>
  <!-- Plan Ruling P6: RotateScreen must out-rank every overlay/modal in the app, not just this
       stage. `.scene-stage` is `position: fixed`, which always opens its own stacking context
       (CSS spec), so a z-index inside it can never beat a sibling overlay mounted outside it
       (e.g. Onboarding). RotateScreen itself portals its DOM node to <body> on mount to escape
       this stacking context; see RotateScreen.svelte and `--z-rotate-screen` in kit.css. -->
  <RotateScreen background={scene.background} />
</main>

<style>
  .scene-stage {
    position: fixed;
    inset: 0;
    /* `clip`, not `hidden`: a hidden overflow is still a scroll container, and WebKit scrolled it
       sideways (scrollLeft 139 px on an iPad, seen in the UI1 fix-wave walk) to bring an
       off-screen part of the cropped art box into view - shifting the whole stage and the HUD.
       A clipped box can never be scrolled. */
    overflow: clip;
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
  .stage-hud {
    position: absolute;
    z-index: 5;
    height: 0;
  }
  .art {
    position: absolute;
    overflow: clip;
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
  /* Keep in sync with RotateScreen.svelte's media query: a square viewport must not hide the
     stage (spec §4: "portrait and aspect < 1"). */
  @media (orientation: portrait) and (aspect-ratio < 1) {
    .stage-content {
      display: none;
    }
  }
</style>
