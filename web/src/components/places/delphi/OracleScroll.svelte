<script lang="ts">
  // One of the Pythia's three scrolls (spec §3 Delphi, playability #9): rolled and sealed on its
  // stand, unrolled across the whole panel once opened (or while its monster is being chosen), or
  // closed until Monday. Presentational: PythiaPanel owns the state, the sounds and the sparkles.
  import type { Snippet } from 'svelte';
  import { ART, MARK_ICONS } from '../../../lib/world/art';

  let {
    title,
    hint,
    mode,
    busy = false,
    onOpen,
    testid,
    children,
  }: {
    title: string;
    hint: string;
    mode: 'rolled' | 'unrolled' | 'closed';
    busy?: boolean;
    onOpen?: () => void;
    testid: string;
    children?: Snippet;
  } = $props();
</script>

{#if mode === 'unrolled'}
  <div class="kit-sheet oracle-sheet" data-testid={testid}>
    <!-- An h4: the Pythia overlay's « Les trois rouleaux » section (h3) holds the scrolls. -->
    <h4 class="scroll-title">{title}</h4>
    {@render children?.()}
  </div>
{:else}
  <div class="oracle-roll" class:is-closed={mode === 'closed'} data-testid={testid}>
    <span class="kit-roll is-upright" aria-hidden="true">
      <img class="roll-art" src={ART.ui.scrollRolled} alt="" draggable="false" />
      <span class="kit-seal" class:is-broken={mode === 'closed'}><img src={MARK_ICONS.oracleSeal} alt="" /></span>
    </span>
    <h4 class="scroll-title">{title}</h4>
    {#if mode === 'rolled'}
      <p class="hint">{hint}</p>
      <button type="button" class="kit-bronze" data-testid="scroll-open" disabled={busy} onclick={onOpen}>
        {busy ? "L'Oracle déroule le rouleau…" : 'Briser le sceau'}
      </button>
    {:else}
      {@render children?.()}
    {/if}
  </div>
{/if}

<style>
  .oracle-roll {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }
  .oracle-roll.is-closed {
    opacity: 0.75;
  }
  /* A closed roll stands smaller beside the opened one; its box shrinks with it. */
  .oracle-roll.is-closed .kit-roll {
    height: 140px;
    transform: scale(0.7);
  }
  .scroll-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 16px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  .hint {
    margin: 0;
    font-size: 16px;
  }
  .oracle-sheet .scroll-title {
    text-align: center;
    margin-bottom: 12px;
  }
</style>
