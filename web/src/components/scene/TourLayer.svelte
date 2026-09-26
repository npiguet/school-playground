<script lang="ts">
  // A place's first-visit tour (spec §8, Ruling E13): a modal next to the stage (the stage is inert
  // under it, as under any overlay, but keeps its labels: overlayState.tour), the place dimmed at
  // night but for a gold ring around the step's hotspot, and the place's character speaking each
  // step in the dialogue box, docked in the art box as usual. « Passer la visite » ends it. The HUD
  // band stays clear of the dimming (visible, inert with the stage).
  import { onDestroy } from 'svelte';
  import DialogueBox from './DialogueBox.svelte';
  import { isTopModal, modal, overlayState } from '../../lib/scene/overlayState.svelte';
  import { hotspotSelector } from '../../lib/scene/hotspotId';
  import { HUD_BAND, shapeBox, stageBox } from '../../lib/scene/geometry';
  import { reducedMotion } from '../../lib/juice/motion';
  import type { DialogueLine, SceneDef } from '../../lib/scene/types';

  let { scene, lines, targets, onDone }: { scene: SceneDef; lines: DialogueLine[]; targets: (string | null)[]; onDone: () => void } = $props();

  let index = $state(0);
  let vw = $state(typeof innerWidth === 'number' ? innerWidth : 1280);
  let vh = $state(typeof innerHeight === 'number' ? innerHeight : 720);
  const art = $derived(stageBox(vw, vh));
  const target = $derived(targets[index] ?? null);
  const box = $derived.by(() => {
    const h = target ? scene.hotspots.find((x) => x.id === target) : null;
    return h ? shapeBox(h.shape) : null;
  });
  const still = reducedMotion();
  // Where focus goes when the tour ends (never <body>): the last hotspot it ringed, else the place's
  // first one.
  const returnFocus = $derived.by(() => {
    const ringed = targets.slice(0, index + 1).filter((t): t is string => !!t).at(-1);
    const id = ringed ?? scene.hotspots[0]?.id;
    return id ? hotspotSelector(scene.id, id) : undefined;
  });

  overlayState.tour = true;
  onDestroy(() => (overlayState.tour = false));

  // Escape skips the tour, as « Passer la visite » does (a modal's way out, like an overlay's seal),
  // when the tour is the topmost modal.
  $effect(() => {
    const node = root;
    if (!node) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isTopModal(node)) return;
      e.preventDefault();
      onDone();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Never a wall: a tap anywhere on the place (the ringed hotspot included) moves the tour on, as the
  // dialogue box's own « Suite » does. A listener, not an onclick on the dialog element: the box's
  // buttons stay the keyboard's way through.
  let root: HTMLDivElement | undefined = $state();
  $effect(() => {
    const node = root;
    if (!node) return;
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest('[data-testid="dialogue-box"]')) return;
      node.querySelector<HTMLButtonElement>('[data-testid="dialogue-advance"]')?.click();
    };
    node.addEventListener('click', onClick);
    return () => node.removeEventListener('click', onClick);
  });
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

<div
  class="tour"
  role="dialog"
  aria-modal="true"
  aria-label="Visite{'\u202f: '}{scene.title}"
  tabindex="-1"
  data-testid="tour"
  data-tour={scene.id}
  data-step={index}
  data-target={target ?? ''}
  bind:this={root}
  use:modal={{ returnFocus }}
>
  <div class="art" style="left:{art.left}px;top:{art.top}px;width:{art.width}px;height:{art.height}px">
    <div
      class="dim"
      class:whole={!box}
      class:still
      aria-hidden="true"
      style="--hud:{HUD_BAND}%;{box ? `--x:${box.x + box.w / 2}%;--y:${box.y + box.h / 2}%;--rx:${box.w / 2 + 3}%;--ry:${box.h / 2 + 4}%` : ''}"
    ></div>
    {#if box}
      <div
        class="ring"
        class:still
        aria-hidden="true"
        data-testid="tour-ring"
        style="left:{box.x - 1}%;top:{box.y - 1}%;width:{box.w + 2}%;height:{box.h + 2}%"
      ></div>
    {/if}
    <DialogueBox {lines} {onDone} onLine={(i) => (index = i)} skipLabel="Passer la visite" />
  </div>
</div>

<style>
  .tour {
    position: fixed;
    inset: 0;
    z-index: 40;
    outline: none;
  }
  .art {
    position: absolute;
  }
  .dim {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse var(--rx) var(--ry) at var(--x) var(--y), transparent 92%, color-mix(in srgb, var(--night) 55%, transparent) 100%);
    transition: background 300ms ease;
    /* The HUD band (the plate, the hero chip) stays in daylight. */
    -webkit-mask-image: linear-gradient(to bottom, transparent calc(var(--hud) - 4%), #000 var(--hud));
    mask-image: linear-gradient(to bottom, transparent calc(var(--hud) - 4%), #000 var(--hud));
  }
  .dim.whole {
    background: color-mix(in srgb, var(--night) 35%, transparent);
  }
  .dim.still {
    transition: none;
  }
  .ring {
    position: absolute;
    border: 3px solid var(--gold-light);
    border-radius: 50%;
    box-shadow: 0 0 18px color-mix(in srgb, var(--gold-light) 70%, transparent);
    animation: tour-ring 1.6s ease-in-out infinite;
    pointer-events: none;
  }
  .ring.still {
    animation: none !important;
  }
  @keyframes tour-ring {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }
</style>
