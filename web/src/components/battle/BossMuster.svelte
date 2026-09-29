<script lang="ts">
  // The boss's muster in Éris's lair (UI4 Task 7, Ruling C7): her challenge for this tier as her own
  // voice plate on the parchment, then the fight's stakes and rules and the grand button. The
  // stage's plaque names her, so no heading repeats it. A lost fight never costs anything: the
  // button always offers the fight again.
  import { onMount } from 'svelte';
  import Medallion from '../juice/Medallion.svelte';
  import OverlayVoice from '../scene/OverlayVoice.svelte';
  import { BOSS } from '../../lib/battle/lines';
  import { react } from '../../lib/battle/stage.svelte';
  import { romanTier } from '../../lib/world/quests';
  import type { DialogueLine } from '../../lib/scene/types';

  let {
    tier,
    rewardId,
    rewardXp,
    rewardName,
    starting,
    startError,
    taunt,
    onStart,
  }: {
    tier: number;
    rewardId: string | null;
    rewardXp: number;
    rewardName: string;
    starting: boolean;
    startError: string;
    /** Éris's challenge for this tier. */
    taunt: DialogueLine;
    onStart: () => void;
  } = $props();

  // She throws down the challenge: her cut-out taunts as her line appears.
  onMount(() => react('opponent', 'taunt'));
</script>

<div class="boss-muster">
  <!-- The fight's banner first, then Éris's challenge under it (UI4 playability #14). -->
  <p class="kit-ribbon tier" data-testid="boss-tier">{BOSS.tier(romanTier(tier))}</p>
  <OverlayVoice line={taunt} testId="battle-voice" />
  <p class="stakes" data-testid="boss-reward">
    {#if rewardId}<Medallion {rewardId} size={40} />{/if}
    <span>{BOSS.reward(rewardXp, rewardName)}</span>
  </p>
  <p class="rules">{BOSS.rules}</p>
  {#if startError}<p class="kit-note" data-tone="eris" role="alert">{startError}</p>{/if}
  <button type="button" class="kit-bronze start" data-testid="boss-start" disabled={starting} onclick={onStart}>
    {BOSS.start}
  </button>
</div>

<style>
  /* The parchment hugs this muster (BattleStage `hug`) and it scrolls inside once it would pass the
     stage's lines. Its flex basis is its content (`auto`), never `flex: 1`'s 0 %, which iPad Safari
     resolved to 0: the hugging parchment collapsed to a strip (MusterPhase.svelte, iPad report
     2026-09-28). */
  .boss-muster {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: 22px 28px;
    color: var(--ink);
    text-align: center;
  }
  .boss-muster :global(.overlay-voice) {
    align-self: stretch;
    margin: 0;
    text-align: left;
  }
  .boss-muster p {
    margin: 0;
  }
  /* Centred in the parchment's height while it fits, scrolling from the top when it does not. */
  .boss-muster > :global(:first-child) {
    margin-top: auto;
  }
  .boss-muster > :global(:last-child) {
    margin-bottom: auto;
  }
  .tier {
    padding-inline: 44px;
    font-family: var(--font-display);
    font-size: 28px;
    letter-spacing: 0.06em;
  }
  .stakes {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-family: var(--font-body);
    font-size: 19px;
    font-weight: 700;
    color: var(--reward-ink);
  }
  .rules {
    max-width: 34em;
    font-family: var(--font-body);
    font-size: 17px;
    line-height: 1.5;
    color: var(--ink-soft);
  }
  .kit-note {
    align-self: stretch;
    text-align: left;
  }
  /* The grand button: the fight is one tap away. */
  .start {
    min-height: 56px;
    padding: 12px 36px;
    font-size: 19px;
  }
</style>
