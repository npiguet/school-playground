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
