<script lang="ts">
  // The laurel XP bar (scenes UI spec §6 UI kit): a branch of leaves that light up toward the next
  // rank. Gold on a bronze outline, never orange (orange is Éris's colour). Accessible as a progressbar.
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
  /* Playability #8: title and branch sit on a soft dark scrim (like the place plaques), so the
     leaves read over a bright sky. */
  .laurel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 4px 14px 6px;
    border-radius: 12px;
    background: rgba(21, 18, 26, 0.55);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
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
    /* An empty leaf is a dim bronze outline; a won leaf is gold (playability #8). */
    background: rgba(200, 148, 80, 0.12);
    border: 1px solid rgba(200, 148, 80, 0.7);
    box-sizing: border-box;
    transform: rotate(-30deg);
  }
  .leaf.right {
    transform: rotate(30deg) scaleX(-1);
  }
  .leaf.lit {
    background: linear-gradient(135deg, var(--gold-light), var(--gold));
    border-color: var(--bronze-dark);
    box-shadow: 0 0 6px rgba(241, 220, 154, 0.6);
  }
</style>
