<script lang="ts">
  // Dragon-voiced break suggestion after ~25 minutes of active play (spec §3.6, decision 16).
  // Never blocking: "Pause" leaves for the camp, "Encore un texte" just resets the clock and
  // lets the player carry on.
  import { ART } from '../lib/world/art';
  import { campStore } from '../lib/world/campStore.svelte';

  let { dragonName, onPause, onContinue }: { dragonName: string; onPause: () => void; onContinue: () => void } =
    $props();

  const stage = $derived(campStore.data?.dragon.stage ?? 'egg');

  // M6: the dragon can't yawn before it has hatched - the egg stirs instead (spec §3.6).
  const message = $derived(
    stage === 'egg'
      ? "L'œuf frémit : ça fait vingt-cinq minutes qu'on chasse les pièges. On souffle un peu ?"
      : `${dragonName} bâille : ça fait vingt-cinq minutes qu'on chasse les pièges. On souffle un peu ?`,
  );
</script>

<div class="parchment break-nudge" data-testid="break-nudge">
  <img src={ART.dragon[stage]} alt="" class="break-dragon" loading="lazy" decoding="async" />
  <p>{message}</p>
  <div class="break-actions">
    <button type="button" class="btn btn-primary" data-testid="break-pause" onclick={onPause}>Pause</button>
    <button type="button" class="btn" data-testid="break-continue" onclick={onContinue}>Encore un texte</button>
  </div>
</div>

<style>
  .break-nudge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px;
    text-align: center;
    margin-bottom: 16px;
  }
  .break-dragon {
    width: 96px;
    height: 96px;
    object-fit: contain;
  }
  .break-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
