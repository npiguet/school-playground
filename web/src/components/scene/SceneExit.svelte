<script lang="ts">
  // The way back to the camp from a place (UI3 Ruling A7): a bronze sign at the bottom-left of
  // the safe zone, left of the dialogue dock (x 27 %), so no hotspot and no dialogue covers it.
  import { href } from '../../lib/routes';
  import { go } from '../../lib/scene/panelNav';
  import Icon from '../ui/Icon.svelte';

  /** `onExit` runs first, before the way home (the battle's victory drops its saved results). */
  let { profileId, onExit }: { profileId: number; onExit?: () => void } = $props();

  const toCamp = () => {
    onExit?.();
    go(href('camp', { profileId: String(profileId) }));
  };
</script>

<button type="button" class="scene-exit kit-bronze" data-testid="scene-exit" onclick={toCamp}>
  <Icon name="arrow-left" size={22} />
  <span>Le camp</span>
</button>

<style>
  .scene-exit {
    position: absolute;
    left: 13.5%;
    bottom: 3%;
    z-index: 4;
  }
</style>
