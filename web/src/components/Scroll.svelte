<script lang="ts">
  // One of Delphes's three sealed scrolls (SP3 Task 7, spec §3.6 decision 9). Purely presentational:
  // Oracle.svelte owns when a scroll unseals and what it reveals - this component only plays the
  // wax-seal-break animation, exactly once, the moment `sealed` actually flips to false. A step
  // taken *while still sealed* (the 'ecole' monster picker) uses `sealedStep` instead of `sealed`,
  // so choosing/cancelling never triggers that animation or sound (M4). Once open, `children`
  // holds a "closed until Monday" note for the two scrolls not chosen.
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';
  import Particles from './juice/Particles.svelte';
  import Medallion from './juice/Medallion.svelte';
  import { MARK_ICONS, rewardKindOf } from '../lib/world/art';
  import { playSfx } from '../lib/juice/sfx';

  let {
    title,
    hint,
    sealed,
    revealed = null,
    reward,
    rewardId = null,
    onOpen,
    testid,
    busy = false,
    children,
    sealedStep,
    quiet = false,
  }: {
    title: string;
    hint: string;
    sealed: boolean;
    revealed?: { name: string; art: string } | null;
    reward: string;
    rewardId?: string | null;
    onOpen: () => void;
    testid: string;
    busy?: boolean;
    children?: Snippet;
    // A step (e.g. the 'ecole' monster picker) that replaces the "Briser le sceau" button while
    // still sealed - it must not itself unseal the scroll (M4): only actually consulting it does,
    // via `onOpen`/`sealed` flipping from the *caller*, never by this step's own presence.
    sealedStep?: Snippet;
    // M4: when a consult succeeds, all three scrolls' `sealed` flip false together (one choice
    // seals the whole week) - but only the chosen scroll should play the seal-break/unroll sound
    // and sparkle burst. The two not chosen pass `quiet` so they still fade open to their "closed
    // until Monday" note, without the sound/sparkle effects.
    quiet?: boolean;
  } = $props();

  let sparkleTrigger = $state(0);
  let previousSealed = untrack(() => sealed);

  // Fires the seal-break -> unroll sound pair and the sparkle burst exactly once, the moment this
  // scroll transitions from sealed to open (never on first mount if it starts open, never again
  // once it has opened, never at all when `quiet`).
  $effect(() => {
    if (previousSealed && !sealed && !quiet) {
      playSfx('seal');
      setTimeout(() => playSfx('unroll'), 130);
      sparkleTrigger += 1;
    }
    previousSealed = sealed;
  });
</script>

<div class="scroll parchment" class:sealed data-testid={testid}>
  <div class="roll" aria-hidden="true">
    <span class="roll-end"></span>
    <span class="wax-seal"><img src={MARK_ICONS.oracleSeal} alt="" /></span>
    <span class="roll-end"></span>
  </div>
  <h3 class="scroll-title">{title}</h3>

  {#if sealed}
    <p class="hint muted">{hint}</p>
    <div class="reward-line">
      {#if rewardId}<Medallion {rewardId} kind={rewardKindOf(rewardId)} size={36} />{/if}
      <span>Récompense de la semaine : {reward}</span>
    </div>
    {#if sealedStep}
      {@render sealedStep()}
    {:else}
      <button type="button" class="btn btn-primary" data-testid="scroll-open" disabled={busy} onclick={onOpen}>
        {busy ? "L'Oracle déroule le rouleau…" : 'Briser le sceau'}
      </button>
    {/if}
  {/if}

  <div class="content" class:open={!sealed}>
    {#if revealed}
      <img src={revealed.art} alt={revealed.name} class="revealed-art pop" />
      <p class="revealed-name pop">{revealed.name}</p>
    {:else if children}
      {@render children()}
    {/if}
  </div>

  {#if sparkleTrigger > 0}
    <Particles trigger={sparkleTrigger} kind="sparkle" />
  {/if}
</div>

<style>
  .scroll {
    position: relative;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
  .roll {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .roll-end {
    width: 36px;
    height: 14px;
    border-radius: 999px;
    background: var(--marble-dark);
    border: 1px solid #d9c9a3;
  }
  .wax-seal {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--terracotta);
    color: var(--marble);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .wax-seal img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .scroll-title {
    margin: 0;
  }
  .hint {
    margin: 0;
  }
  .reward-line {
    margin: 0;
    font-weight: 600;
    /* A darker bronze: gold on cream was too faint to read (UI1 playability #13). */
    color: #8a5a1c;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    overflow: hidden;
    max-height: 0;
    transition: max-height 0.5s ease;
  }
  .content.open {
    max-height: 600px;
  }
  .revealed-art {
    max-height: 180px;
    object-fit: contain;
  }
  .revealed-name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 18px;
    margin: 0;
  }
  .pop {
    animation: pop 0.4s both;
  }
</style>
