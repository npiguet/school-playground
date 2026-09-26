<script lang="ts">
  // The boss's muster (UI4 Task 2): Boss's challenge and info card, moved as they were onto the
  // battle stage's parchment in Éris's lair. Task 7 restyles it and gives her challenge its voice
  // plate. A lost fight never costs anything: the button always offers the fight again.
  import Medallion from '../juice/Medallion.svelte';
  import { romanTier } from '../../lib/world/quests';
  import type { DialogueLine } from '../../lib/scene/types';

  let {
    tier,
    rewardId,
    rewardXp,
    rewardName,
    retry,
    starting,
    startError,
    taunt,
    onStart,
  }: {
    tier: number;
    rewardId: string | null;
    rewardXp: number;
    rewardName: string;
    /** A grimoire-flagged retry (P1-5 follow-up): « Relancer le combat ». */
    retry: boolean;
    starting: boolean;
    startError: string;
    /** Éris's challenge for this tier. */
    taunt: DialogueLine;
    onStart: () => void;
  } = $props();
</script>

<div class="boss-muster">
  <div class="parchment eris-panel challenge">
    <p class="challenge-line">« {taunt.text} »</p>
  </div>

  <div class="card info-card">
    <p class="tier" data-testid="boss-tier">Combat {romanTier(tier)}</p>
    <div class="reward" data-testid="boss-reward">
      {#if rewardId}<Medallion {rewardId} size={40} />{/if}
      <span>Récompense si tu gagnes : {rewardXp} XP · {rewardName}</span>
    </div>
    <p class="rules muted">
      Un long texte · les Yeux d'Argus restent éteints · chaque piège trouvé reste acquis, même si Éris s'enfuit : tu
      pourras recommencer.
    </p>

    {#if startError}<p class="orange" role="alert">{startError}</p>{/if}

    <button type="button" class="btn btn-primary" data-testid="boss-start" disabled={starting} onclick={onStart}>
      {retry ? 'Relancer le combat' : 'Affronter Éris'}
    </button>
  </div>
</div>

<style>
  /* The parchment has a fixed height (the stage's); the muster scrolls inside it. */
  .boss-muster {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 16px;
  }
  .challenge {
    padding: 18px 20px;
  }
  .challenge-line {
    margin: 0;
    font-style: italic;
    font-size: 18px;
  }
  .info-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .tier {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 20px;
  }
  .reward {
    margin: 0;
    font-weight: 600;
    color: var(--gold);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .rules {
    margin: 0;
  }
</style>
