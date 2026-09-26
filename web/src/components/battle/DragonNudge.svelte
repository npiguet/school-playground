<script lang="ts">
  // Dragon-voiced break suggestion after ~25 minutes of active play (spec §3.6, decision 16), spoken
  // by the dragon on the victory sheet (UI4 Ruling C7). Never blocking: « On rentre souffler » leaves for the camp,
  // "Encore un texte" just resets the clock and lets the player carry on.
  import OverlayVoice from '../scene/OverlayVoice.svelte';
  import { VICTORY } from '../../lib/battle/lines';
  import { dragonSays } from '../../lib/world/scenes/speakers';
  import type { DragonOut } from '../../lib/world/types';

  // `dragon`: this hero's (campFor), never the shared store's snapshot (final review I2).
  let { dragon, onPause, onContinue }: { dragon: DragonOut | null; onPause: () => void; onContinue: () => void } =
    $props();

  const speaker = $derived(dragon ?? ({ name: null, stage: 'egg', tint: 'bronze' } as DragonOut));

  // M6: the dragon can't yawn before it has hatched - the egg stirs instead (spec §3.6). UI4
  // playability #16: the plate names the speaker, so the line is the dragon's own, in the first person.
  const message = $derived(speaker.stage === 'egg' ? VICTORY.nudgeEgg : VICTORY.nudgeDragon);
</script>

<div class="dragon-nudge" data-testid="break-nudge">
  <OverlayVoice line={dragonSays(speaker, message)} testId="break-voice" />
  <div class="nudge-actions">
    <button type="button" class="kit-bronze" data-testid="break-pause" onclick={onPause}>{VICTORY.nudgeHome}</button>
    <button type="button" class="kit-bronze is-quiet" data-testid="break-continue" onclick={onContinue}>{VICTORY.nudgeMore}</button>
  </div>
</div>

<style>
  /* Compact (fix round 1 #4): the plate and its two buttons side by side, at the top of the sheet's
     scrolling body, so the sheet below keeps its room at 1280x720. */
  .dragon-nudge {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .dragon-nudge :global(.overlay-voice) {
    flex: 1;
    min-width: 0;
    margin: 0;
  }
  .nudge-actions {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
