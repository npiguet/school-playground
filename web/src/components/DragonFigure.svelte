<script lang="ts" module>
  // LivingDragon and the living dragon's code (renderer, rigs, mesh) load on first use, as their own
  // chunk, so the game's entry chunk stays lean (lazy.test.ts). One load for the session; a failed
  // one is forgotten, so the next living figure tries again.
  type LivingComponent = typeof import('./LivingDragon.svelte').default;
  let livingModule: Promise<LivingComponent> | null = null;
  function loadLiving(): Promise<LivingComponent> {
    livingModule ??= import('./LivingDragon.svelte').then(
      (m) => m.default,
      (e: unknown) => {
        livingModule = null;
        throw e;
      },
    );
    return livingModule;
  }
</script>

<script lang="ts">
  // The dragon as drawn on screen (spec 2026-09-29 drachmes §4, R19): its stage picture in its tint
  // (OKLCH, tinted once on a canvas: living/stillTint.ts; `null` for a figure never tinted, an enemy),
  // and the pieces it wears on top, untinted (a tint recolours the dragon, never its gear). The
  // overlays are percentages of the picture's own box, so the figure scales as one.
  // `className` carries the caller's animation (idle, mood), so the pieces move with the dragon.
  // Spec 2026-10-02 living dragon: given a `living` rig (a dragon stage, or a battle foe), it mounts
  // LivingDragon in place of the picture; the still markup shows while it loads (`data-motion`
  // pending), goes once its first frame is drawn (living) and stays for good if it fails (still),
  // until the rig or the picture changes or reduced motion is lifted: then a fresh try (Ruling L2).
  // The egg, reduced motion and every other caller (the victory, the reveal) pass none; the battle
  // passes its fighters' rigs (spec 2026-10-03 living battle).
  import type { OverlayLayer } from '../lib/world/accessories';
  import { tintedDragon } from '../lib/living/stillTint';
  import { untrack } from 'svelte';
  import { hasWebGL2, isFoeRig, type LivingRig, type Motion } from '../lib/living/stages';
  import type { Tint } from '../lib/world/types';

  let {
    src,
    alt,
    tint = null,
    overlays = [],
    className = '',
    style = '',
    living = null,
  }: {
    src: string;
    alt: string;
    tint?: Tint | null;
    overlays?: OverlayLayer[];
    className?: string;
    style?: string;
    living?: LivingRig | null;
  } = $props();

  let motion = $state<Motion>('pending');
  let Living = $state<LivingComponent | null>(null);
  // A browser without WebGL2 (asked once, stages.ts) never tries: the still picture at once.
  const livingNow = $derived(living && hasWebGL2() ? living : null);
  const srcNow = $derived(src);
  // A new rig, a new picture or reduced motion lifted (`living` back from null): a fresh try, even
  // after a failure. By value: the props read through the parent's expressions change with every
  // camp snapshot (a tint picked, a piece put on) even when the rig and picture stay the same.
  // The component's chunk loads on the first living rig; a chunk that fails to load is a failure
  // too, and every fresh try (a new picture alone included) asks for it again, so `data-motion`
  // never stays `pending` over a still picture (living-dragon final review).
  $effect(() => {
    void srcNow;
    const rig = livingNow;
    motion = 'pending';
    if (!rig || untrack(() => Living)) return;
    let gone = false;
    loadLiving().then(
      (c) => {
        if (!gone) Living = c;
      },
      () => {
        if (!gone) motion = 'still';
      },
    );
    return () => {
      gone = true;
    };
  });
  const shown = $derived<Motion>(livingNow ? motion : 'still');
  // A foe's still picture is never tinted either, whatever its caller gives (spec 2026-10-03 living battle).
  const stillTint = $derived(living && isFoeRig(living) ? null : tint);
</script>

<div class="dragon-figure {className}" {style} data-motion={shown}>
  {#if livingNow && Living && motion !== 'still'}
    {#key livingNow}
      <!-- A dragon stage carries the dragon's tint (the nest's, the camp's and the battle's layers); a
           foe is never tinted (spec 2026-10-03 living battle). -->
      <Living rig={livingNow} {src} {alt} tint={isFoeRig(livingNow) ? null : (tint ?? 'bronze')} {overlays} onmotion={(m: Motion) => (motion = m)} />
    {/key}
  {/if}
  {#if shown !== 'living'}
    <img class="dragon-base" use:tintedDragon={{ src, tint: stillTint }} {alt} draggable="false" />
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

<style>
  .dragon-figure {
    position: relative;
  }
  .dragon-base {
    display: block;
    width: 100%;
    height: auto;
  }
  .dragon-overlay {
    position: absolute;
    display: block;
    pointer-events: none;
  }
</style>
