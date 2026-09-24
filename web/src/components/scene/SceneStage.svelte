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
  import HotspotDebug from './HotspotDebug.svelte';
  import { pointerToNorm, stageBox } from '../../lib/scene/geometry';
  import { createSceneRuntime, provideSceneRuntime } from '../../lib/scene/runtime.svelte';
  import { isDebugMode } from '../../lib/scene/debugMode';
  import { reducedMotion, watchReducedMotion } from '../../lib/juice/motion';
  import { router } from '../../lib/router.svelte';
  import type { SceneContext, SceneDef } from '../../lib/scene/types';

  let {
    scene,
    children,
    hud,
    ctx,
  }: { scene: SceneDef; children?: Snippet; hud?: Snippet; ctx?: SceneContext } = $props();

  const runtime = createSceneRuntime({ reduced: reducedMotion() });
  provideSceneRuntime(runtime);

  const EMPTY_CTX: SceneContext = { camp: null, catalog: null };
  // The overlay must mirror exactly what's clickable, so it filters by the same per-hotspot
  // state the real <Hotspot> buttons use (falling back to an empty context for scenes that don't
  // pass one, e.g. before their data has loaded).
  const debugHotspots = $derived(scene.hotspots.filter((h) => h.state(ctx ?? EMPTY_CTX).visible));

  let vw = $state(typeof innerWidth === 'number' ? innerWidth : 1280);
  let vh = $state(typeof innerHeight === 'number' ? innerHeight : 720);
  const box = $derived(stageBox(vw, vh));

  $effect(() =>
    watchReducedMotion((r) => {
      runtime.reduced = r;
      if (r) resetPointer();
    }),
  );

  $effect(() => {
    runtime.debug = isDebugMode(location.search, router.route.query);
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
  onpointermove={onPointerMove}
  onpointerleave={resetPointer}
  onpointerup={onPointerUp}
  onpointercancel={resetPointer}
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
        {#if runtime.debug}
          <HotspotDebug sceneId={scene.id} hotspots={debugHotspots} />
        {/if}
      </div>
    </SceneTransition>
    {@render hud?.()}
  </div>
  <!-- Plan Ruling P6: RotateScreen must out-rank every overlay/modal in the app, not just this
       stage. `.scene-stage` is `position: fixed`, which always opens its own stacking context
       (CSS spec), so a z-index inside it can never beat a sibling overlay mounted outside it
       (e.g. Onboarding). RotateScreen itself portals its DOM node to <body> on mount to escape
       this stacking context; see RotateScreen.svelte and `--z-rotate-screen` in kit.css. -->
  <RotateScreen />
</main>

<style>
  .scene-stage {
    position: fixed;
    inset: 0;
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
  /* Keep in sync with RotateScreen.svelte's media query: a square viewport must not hide the
     stage (spec §4: "portrait and aspect < 1"). */
  @media (orientation: portrait) and (aspect-ratio < 1) {
    .stage-content {
      display: none;
    }
  }
</style>
