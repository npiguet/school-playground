<script lang="ts">
  // Dragon-voiced break suggestion after ~25 minutes of active play (spec §3.6, decision 16), spoken
  // by the dragon on the victory sheet (UI4 Ruling C7). Never blocking: "Pause" leaves for the camp,
  // "Encore un texte" just resets the clock and lets the player carry on.
  import OverlayVoice from '../scene/OverlayVoice.svelte';
  import { dragonSays } from '../../lib/world/scenes/speakers';
  import type { DragonOut } from '../../lib/world/types';

  // `dragon`: this hero's (campFor), never the shared store's snapshot (final review I2).
  let { dragon, onPause, onContinue }: { dragon: DragonOut | null; onPause: () => void; onContinue: () => void } =
    $props();

  const speaker = $derived(dragon ?? ({ name: null, stage: 'egg', tint: 'bronze' } as DragonOut));
  const dragonName = $derived(speaker.name ?? 'Ton dragon');

  // M6: the dragon can't yawn before it has hatched - the egg stirs instead (spec §3.6).
  const message = $derived(
    speaker.stage === 'egg'
      ? "L'œuf frémit : ça fait vingt-cinq minutes qu'on chasse les pièges. On souffle un peu ?"
      : `${dragonName} bâille : ça fait vingt-cinq minutes qu'on chasse les pièges. On souffle un peu ?`,
  );
</script>

<div class="dragon-nudge" data-testid="break-nudge">
  <OverlayVoice line={dragonSays(speaker, message)} testId="break-voice" />
  <div class="nudge-actions">
    <button type="button" class="kit-bronze" data-testid="break-pause" onclick={onPause}>Pause</button>
    <button type="button" class="kit-bronze is-quiet" data-testid="break-continue" onclick={onContinue}>Encore un texte</button>
  </div>
</div>

<style>
  .dragon-nudge {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 16px 22px 0;
  }
  .dragon-nudge :global(.overlay-voice) {
    margin: 0;
  }
  .nudge-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
