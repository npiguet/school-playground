<script lang="ts">
  // One clickable place of a scene (scenes UI spec §4): a real <button> covering the shape's box,
  // a glow clipped to the shape, a visible Cinzel label (+ caption, badge), idle glow + bob, a
  // flash on tap. Test id `<sceneId>-<hotspot id>` (UI1 Ruling 4). UI3: `labelPos: 'on'` writes
  // the label in ink on the landmark itself; `leader` pins the plaque to its landmark with a
  // short bronze line (carry #17); `icon` draws a painted icon on the plaque; a locked place
  // explains itself through `onLocked`; `onPress` runs inside the tap itself (user-gesture work
  // such as the audio unlock and the tilt permission, UI3 Ruling A5).
  import { clipPath, labelShift, shapeBox } from '../../lib/scene/geometry';
  import { useSceneRuntime } from '../../lib/scene/runtime.svelte';
  import type { HotspotDef, HotspotState } from '../../lib/scene/types';

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
  const pinned = $derived(def.leader === true && !inked);
  let flashing = $state(false);
  // Layout width of the plaque (offsetWidth ignores the scene's zoom-in transform), so the label
  // can be clamped inside the safe zone (final review I4, playability #1).
  let labelW = $state(0);
  const shift = $derived(inked ? 0 : labelShift(box.x + box.w / 2, labelW, rt.artW));
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => () => clearTimeout(timer));

  function onclick() {
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
    timer = setTimeout(
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
    class:pinned
    data-testid="{sceneId}-{def.id}"
    aria-disabled={status.locked ? 'true' : undefined}
    style="left:{box.x + box.w / 2}%;top:{box.y + box.h / 2}%;width:{box.w}%;height:{box.h}%"
    {onclick}
  >
    <span class="hotspot-glow" style="clip-path:{clipPath(def.shape)}" aria-hidden="true"></span>
    {#if pinned}<span class="hotspot-leader" aria-hidden="true"></span>{/if}
    <span class="hotspot-label" style="left:calc(50% + {shift}px)" bind:offsetWidth={labelW}>
      <span class="hotspot-name">
        {#if def.icon}<img class="hotspot-icon" src={def.icon} alt="" draggable="false" />{/if}{def.label}
      </span>
      {#if status.caption}<span class="hotspot-caption">{status.caption}</span>{/if}
      <!-- Playability #5: a badge lives on the plaque it counts for, never on the shape. -->
      {#if status.badge !== null}<span class="hotspot-badge" data-testid="{sceneId}-{def.id}-badge">{status.badge}</span>{/if}
    </span>
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
  .label-on .hotspot-name,
  .label-on .hotspot-caption {
    font-size: 12px;
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
