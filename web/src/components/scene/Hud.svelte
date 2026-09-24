<script lang="ts">
  // The slim scene HUD (scenes UI spec §4): hero chip (opens the hero panel), XP laurel, dragon
  // mini-portrait, sound toggle. Viewport-anchored over the stage, inside the safe-area insets.
  // Audio channels and their sliders arrive in UI5; UI1 keeps the existing single mute.
  import Avatar from '../Avatar.svelte';
  import LaurelBar from '../ui/LaurelBar.svelte';
  import { ART } from '../../lib/world/art';
  import { TINT_FILTERS } from '../../lib/world/dragon';
  import { hudXp } from '../../lib/scene/hud';
  import { setMuted, soundStore } from '../../lib/juice/soundStore.svelte';
  import { unlockAudio } from '../../lib/juice/sfx';
  import { href } from '../../lib/routes';
  import type { CampResponse } from '../../lib/world/types';
  import type { Profile } from '../../lib/types';

  let { profile, camp, onHero }: { profile: Profile; camp: CampResponse | null; onHero: () => void } = $props();

  const xp = $derived(camp ? hudXp(camp.xp) : null);

  function toggleMute() {
    unlockAudio();
    void setMuted(profile.id, !soundStore.muted);
  }
</script>

<header class="hud">
  <button type="button" class="hud-hero" data-testid="hud-hero" aria-label="Ton héros : {profile.name}" onclick={onHero}>
    <Avatar avatar={profile.avatar} size={40} />
    <span class="hud-name">{profile.name}</span>
  </button>
  <div class="hud-center">
    {#if xp}
      <LaurelBar value={xp.value} max={xp.max} label={xp.label} testId="hud-xp" />
    {/if}
  </div>
  <div class="hud-right">
    {#if camp}
      <a class="hud-round hud-dragon" data-testid="hud-dragon" href={href('dragon', { profileId: String(profile.id) })} aria-label="Ton dragon">
        <img src={ART.dragon[camp.dragon.stage]} alt="" style="filter:{TINT_FILTERS[camp.dragon.tint]}" />
      </a>
    {/if}
    <button type="button" class="hud-round" data-testid="hud-mute" aria-pressed={soundStore.muted} aria-label="Son" onclick={toggleMute}>
      <span aria-hidden="true">{soundStore.muted ? '🔇' : '🔊'}</span>
    </button>
  </div>
</header>

<style>
  .hud {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 5;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    padding: calc(8px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) 8px
      calc(12px + env(safe-area-inset-left));
    background: linear-gradient(rgba(21, 18, 26, 0.7), rgba(21, 18, 26, 0));
    pointer-events: none;
  }
  .hud > * {
    pointer-events: auto;
  }
  .hud-hero {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 4px 14px 4px 4px;
    border-radius: 999px;
    border: 1px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.6);
    color: var(--bronze-ink);
    cursor: pointer;
  }
  .hud-name {
    font-family: var(--font-display);
    font-weight: 700;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hud-right {
    justify-self: end;
    display: flex;
    gap: 10px;
  }
  .hud-round {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 2px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.6);
    font-size: 22px;
    cursor: pointer;
  }
  .hud-dragon img {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
</style>
