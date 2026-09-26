<script lang="ts">
  // One clickable place of a scene (scenes UI spec §4): a real <button> covering the shape's box,
  // a glow clipped to the shape, a visible Cinzel label (+ caption, badge), idle glow + bob, a
  // flash on tap. Test id `<sceneId>-<hotspot id>` (UI1 Ruling 4). UI3: `labelPos: 'on'` writes
  // the label in ink on the landmark itself; `leader` pins the plaque to its landmark with a
  // short bronze line (carry #17); `icon` draws a painted icon on the plaque; a locked place wears
  // the painted lock on its plaque and explains itself through `onLocked` (a tap, Enter or Space:
  // it is not aria-disabled, since it still answers - UI3b ruling B-a; its state is said by the
  // caption and the sr-only note in its name); `onPress` runs inside the tap itself (user-gesture work
  // such as the audio unlock and the tilt permission, UI3 Ruling A5).
  import { clipPath, labelShift, shapeBox } from '../../lib/scene/geometry';
  import { useSceneRuntime } from '../../lib/scene/runtime.svelte';
  import { hotspotTestId } from '../../lib/scene/hotspotId';
  import { router } from '../../lib/router.svelte';
  import type { HotspotDef, HotspotState } from '../../lib/scene/types';
  import { MARK_ICONS } from '../../lib/world/art';
  import { plural } from '../../lib/text/french';

  let {
    def,
    status,
    sceneId,
    onActivate,
    onPress,
    onLocked,
  }: {
    def: HotspotDef;
    status: HotspotState;
    sceneId: string;
    onActivate: (def: HotspotDef) => void;
    onPress?: (def: HotspotDef) => void;
    onLocked?: (def: HotspotDef) => void;
  } = $props();

  const rt = useSceneRuntime();
  const box = $derived(shapeBox(def.shape));
  const inked = $derived(def.labelPos === 'on');
  // A label-less hotspot (the library owl) has no plaque, so nothing to pin.
  const pinned = $derived(def.leader === true && !inked && def.label !== '');
  let flashing = $state(false);
  // Layout width of the plaque (offsetWidth ignores the scene's zoom-in transform), so the label
  // can be clamped inside the safe zone (final review I4, playability #1).
  let labelW = $state(0);
  // UI3a Task 9 review round 2: an inked ("on") label used to skip this clamp entirely, on the
  // apparent assumption it always sits comfortably inside the safe zone - not true for a landmark
  // near its edge (the camp's dragon nest, hard up against the safe zone's left edge). labelShift()
  // is a pure horizontal clamp keyed off the label's own centre and width, same as above/below
  // labels use; it already returns 0 (a no-op) for a label that fits without it.
  // UI3b playability #10: `labelDx` slides the plaque sideways (in % of the shape's width, which is
  // the button's width), and the clamp keys off where the plaque really sits.
  const dx = $derived(def.labelDx ?? 0);
  const shift = $derived(labelShift(box.x + box.w / 2 + (dx * box.w) / 100, labelW, rt.artW));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => () => {
    clearTimeout(timer);
    clearTimeout(releaseTimer);
  });

  function onclick() {
    // Task 9b: the read-only `?debug` overlay must not block hotspot clicks (HotspotDebug.svelte
    // is pointer-events: none over it anyway).
    // Final review M3 + UI3 Ruling A6: one tap at a time per stage; SceneStage releases the guard
    // on the next route change (a place stays mounted under its overlays).
    if (rt.activating) return;
    if (status.locked) {
      onLocked?.(def);
      return;
    }
    onPress?.(def);
    rt.activating = true;
    flashing = true;
    // A stale timer can only still be pending here if something outside this tap already reset
    // `rt.activating` (e.g. SceneStage's route-change effect firing for an unrelated reason)
    // while our own flash was still running - clear it so its onActivate never fires twice.
    clearTimeout(timer);
    const routeBefore = router.route;
    timer = setTimeout(
      () => {
        flashing = false;
        onActivate(def);
        // A `target: null` hotspot (types.ts) handles the tap itself and never navigates, so
        // SceneStage's route-change effect never runs to release the guard for it. Release it
        // here instead, once the route is confirmed unchanged on the next tick, so the scene's
        // other hotspots stay clickable (fix round 1 minor #2).
        releaseTimer = setTimeout(() => {
          if (router.route === routeBefore) rt.activating = false;
        });
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
    class:pinned
    class:grand={def.grand === true}
    data-testid={hotspotTestId(sceneId, def.id)}
    aria-label={def.ariaLabel}
    style="left:{box.x + box.w / 2}%;top:{box.y + box.h / 2}%;width:{box.w}%;height:{box.h}%"
    {onclick}
  >
    <span class="hotspot-glow" style="clip-path:{clipPath(def.shape)}" aria-hidden="true"></span>
    {#if pinned}<span class="hotspot-leader" aria-hidden="true"></span>{/if}
    {#if def.label}
      <span class="hotspot-label" style="left:calc(50% + {dx}% + {shift}px)" bind:offsetWidth={labelW}>
        <span class="hotspot-name">
          {#if status.locked}<img class="hotspot-icon hotspot-lock" src={MARK_ICONS.lock} alt="" draggable="false" />{/if}
          {#if def.icon}<img class="hotspot-icon" src={def.icon} alt="" draggable="false" />{/if}{def.label}
          {#if status.seals > 0}
            <span class="hotspot-seals" data-testid="{hotspotTestId(sceneId, def.id)}-seals" data-count={status.seals}
              >{#each Array.from({ length: status.seals }, (_, i) => i) as i (i)}<span class="hotspot-seal"></span>{/each}<span class="sr-only"
                >({plural(status.seals, 'ruse neutralisée', 'ruses neutralisées')})</span
              ></span
            >
          {/if}
        </span>
        {#if status.caption}<span class="hotspot-caption">{status.caption}</span>{/if}
        <!-- Playability #5: a badge lives on the plaque it counts for, never on the shape. -->
        {#if status.badge !== null}<span class="hotspot-badge" data-testid="{hotspotTestId(sceneId, def.id)}-badge">{status.badge}</span>{/if}
      </span>
    {/if}
    {#if status.locked}<span class="sr-only">(fermé pour l'instant)</span>{/if}
  </button>
{/if}

<style>
  .hotspot {
    position: absolute;
    /* Centred on the shape box's centre, so the 48 px floor grows the button symmetrically. */
    transform: translate(-50%, -50%);
    min-width: 48px;
    min-height: 48px;
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
  /* Playability #11, UI3b playability #16: the next step is visible on a bright painting and in a
     still frame. Gold means « next » and nothing else: the one glowing plaque alone has the gold
     rim, a gold-leaf band behind its words and a warm halo (the other plaques keep a dark bronze
     edge), and a stronger pulse on the shape. Under reduced motion (no .bob) all but the pulse stay.
     After `.hotspot.bob .hotspot-glow` (same specificity). */
  .hotspot.is-new .hotspot-label {
    border-color: var(--gold-light);
    background: linear-gradient(#5a4520, #2b2216);
    box-shadow:
      0 0 0 2px rgba(241, 220, 154, 0.6),
      0 0 18px rgba(255, 220, 140, 0.75),
      0 3px 8px rgba(0, 0, 0, 0.35);
  }
  .hotspot.is-new .hotspot-glow {
    opacity: 0.65;
  }
  .hotspot.bob.is-new .hotspot-glow {
    animation: kit-glow-strong 2.4s ease-in-out infinite;
  }
  .hotspot.is-new:hover .hotspot-glow,
  .hotspot.is-new:focus-visible .hotspot-glow {
    opacity: 0.85;
  }
  /* The title's « Entrer »: the scene's one call to action. */
  .hotspot.grand .hotspot-label {
    padding: 8px 20px;
  }
  .hotspot.grand .hotspot-name {
    font-size: 20px;
  }
  .hotspot.bob .hotspot-label {
    animation: kit-label-bob 3.2s ease-in-out infinite;
  }
  .hotspot.bob.label-on .hotspot-label {
    animation: none;
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
    border: 1px solid rgba(90, 58, 24, 0.9);
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
  .pinned.label-below .hotspot-label {
    top: calc(100% + 16px);
  }
  .pinned.label-above .hotspot-label {
    bottom: calc(100% + 16px);
  }
  /* Carry #17: a short bronze line from the landmark to its plaque, with a gold pin at the
     landmark end, so a label never floats over the sky or the sea. */
  .hotspot-leader {
    position: absolute;
    left: 50%;
    width: 2px;
    height: 16px;
    transform: translateX(-50%);
    background: linear-gradient(var(--bronze-light), var(--bronze));
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }
  .label-below .hotspot-leader {
    top: 100%;
  }
  .label-above .hotspot-leader {
    bottom: 100%;
  }
  .hotspot-leader::before {
    content: '';
    position: absolute;
    left: 50%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: var(--gold-light);
    border: 1px solid var(--bronze-dark);
  }
  .label-below .hotspot-leader::before {
    top: 0;
  }
  .label-above .hotspot-leader::before {
    top: 100%;
  }
  /* Ink on the landmark (portrait sheets): no dark plaque, no bob. */
  .label-on .hotspot-label {
    bottom: 4%;
    padding: 2px 6px;
    border: 0;
    border-radius: 4px;
    background: rgba(243, 230, 200, 0.85);
    color: var(--ink);
    box-shadow: none;
  }
  /* UI3b playability #8: ink on a landmark is read at arm's length too, never under 14 px. */
  .label-on .hotspot-name {
    font-size: 14px;
    letter-spacing: 0.02em;
  }
  .label-on .hotspot-caption {
    font-size: 14px;
  }
  .hotspot-name {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .hotspot-icon {
    width: 26px;
    height: 26px;
    object-fit: contain;
  }
  .hotspot-caption {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 14px;
  }
  /* Things won here: small gold wax seals after the name (UI3b playability #17). */
  .hotspot-seals {
    display: inline-flex;
    gap: 3px;
    margin-left: 2px;
  }
  .hotspot-seal {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, var(--gold-light), var(--gold) 70%);
    box-shadow: 0 0 0 1px var(--bronze-dark);
  }
  .hotspot-badge {
    position: absolute;
    top: -14px;
    right: -14px;
    border: 2px solid var(--bronze-dark);
    font-family: var(--font-body);
    font-size: 15px;
    font-style: normal;
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
  /* UI1 carry #16: a locked place shows the painted lock on its plaque (and keeps its grey glow). */
  .label-on .hotspot-lock {
    width: 16px;
    height: 16px;
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
