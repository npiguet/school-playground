<script lang="ts">
  // A reward medallion (UI3 Ruling A12): the painted reward icon in a gold ring; a tint is a flat
  // colour swatch; `locked` greys the ring and shows a plain « ? » so an undiscovered reward reads
  // as a mystery, never a blank (an unknown id falls back to the same « ? », also announced as
  // such - review round 1 #3). `label` names the reward for screen readers when no visible text
  // sits next to this medallion (review round 1 #2); it never overrides the locked/unknown mystery
  // state, which must never leak which reward it is.
  import { rewardIcon } from '../../lib/world/art';
  import { TINT_SWATCH } from '../../lib/world/dragon';
  import type { RewardKind, Tint } from '../../lib/world/types';

  let {
    rewardId,
    kind,
    size = 72,
    locked = false,
    label,
  }: { rewardId: string; kind: RewardKind; size?: number; locked?: boolean; label?: string } = $props();

  const swatch = $derived(kind === 'tint' ? (TINT_SWATCH[rewardId.slice('tint:'.length) as Tint] ?? null) : null);
  const icon = $derived(kind === 'tint' ? null : rewardIcon(rewardId));
  const isUnknown = $derived(!swatch && !icon);
  const mysteryLabel = $derived(locked ? 'Récompense à découvrir' : isUnknown ? 'Récompense inconnue' : undefined);
</script>

<div
  class="medallion"
  class:locked
  data-kind={kind}
  data-reward={rewardId}
  style="width:{size}px;height:{size}px;font-size:{size * 0.5}px"
  role={mysteryLabel ? 'img' : undefined}
  aria-label={mysteryLabel}
>
  {#if !locked && swatch}
    <span class="swatch" style="background:radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.55), {swatch} 62%)" aria-hidden="true"></span>
  {:else if !locked && icon}
    <img class="icon" src={icon} alt={label ?? ''} draggable="false" />
  {:else}
    <span class="mystery" aria-hidden="true">?</span>
  {/if}
</div>

<style>
  .medallion {
    border-radius: 50%;
    border: 3px solid var(--gold);
    background: radial-gradient(circle at 35% 30%, var(--gold-light), var(--gold) 70%);
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    flex-shrink: 0;
    overflow: hidden;
  }
  .icon {
    width: 82%;
    height: 82%;
    object-fit: contain;
  }
  .swatch {
    width: 72%;
    height: 72%;
    border-radius: 50%;
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.15);
  }
  .mystery {
    font-family: var(--font-display);
    font-weight: 700;
  }
  .medallion.locked {
    filter: grayscale(1);
    background: radial-gradient(circle at 35% 30%, #ececec, #b8b8b8 70%);
    color: var(--ink-soft);
    border-color: #b8b8b8;
  }
</style>
