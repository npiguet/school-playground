<script lang="ts">
  // UI4 Task A: the painted treasure chest above the victory sheet's tally - VictorySheet's `crown`
  // snippet slot, filled by VictoryPhase whenever the spoils hold a reward (progression.rewards.length
  // > 0); the drawn LaurelWreath stays the default everywhere else, so a missing prop never breaks
  // the sheet. The open chest swaps in 600ms after the sheet appears, a plain fade under reduced
  // motion (spec §4 "fades only"), a small pop otherwise.
  import { onMount } from 'svelte';
  import { ART } from '../../lib/world/art';

  let { reduced = false }: { reduced?: boolean } = $props();

  let opened = $state(false);
  onMount(() => {
    const id = setTimeout(() => (opened = true), 600);
    return () => clearTimeout(id);
  });
</script>

<div class="chest" class:opened class:still={reduced} data-testid="victory-chest" aria-hidden="true">
  <img src={ART.battle.chestClosed} alt="" class="chest-img closed" draggable="false" />
  <img src={ART.battle.chestOpen} alt="" class="chest-img open" draggable="false" />
</div>

<style>
  .chest {
    position: relative;
    width: 128px;
    height: 128px;
    margin: 0 auto 4px;
  }
  .chest-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: opacity 0.4s ease;
  }
  .chest-img.closed {
    opacity: 1;
  }
  .chest-img.open {
    opacity: 0;
  }
  .chest.opened .chest-img.closed {
    opacity: 0;
  }
  .chest.opened .chest-img.open {
    opacity: 1;
    animation: pop-in 0.4s ease;
  }
  .chest.still .chest-img.open {
    animation: none;
  }
  @keyframes pop-in {
    from {
      transform: scale(0.92);
    }
    to {
      transform: scale(1);
    }
  }
</style>
