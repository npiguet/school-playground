<script lang="ts">
  // The way back to the camp from a place (UI3 Ruling A7): a bronze sign at the bottom-left of
  // the safe zone, left of the dialogue dock (x 27 %), so no hotspot and no dialogue covers it.
  import { href } from '../../lib/routes';
  import { navigate } from '../../lib/router.svelte';
  import { playSfx, unlockAudio } from '../../lib/juice/sfx';

  let { profileId }: { profileId: number } = $props();

  function go() {
    unlockAudio();
    playSfx('tap');
    navigate(href('camp', { profileId: String(profileId) }));
  }
</script>

<button type="button" class="scene-exit kit-bronze" data-testid="scene-exit" onclick={go}>
  <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
    <path d="M19 7L10 16l9 9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
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
