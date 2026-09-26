<script lang="ts">
  // The hero panel (UI1 Ruling 6, carry #4 → UI3 Ruling B2): three bronze medallions. It lives in the
  // cabin; the HUD's hero chip is its shortcut from every place. « La lyre » and « Ton journal » open
  // the cabin's own overlays as a tagged push (`go(…, 'panel')`), so their seal steps back here.
  import Avatar from '../../Avatar.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { clearProfile } from '../../../lib/profileStore.svelte';
  import { go } from '../../../lib/scene/panelNav';
  import { href } from '../../../lib/routes';
  import type { Profile } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  const profileId = $derived(String(profile.id));

  function inCabin(e: MouseEvent, path: string) {
    e.preventDefault();
    go(path, 'panel');
  }
</script>

<div class="hero-panel">
  <Avatar avatar={profile.avatar} size={72} ring />
  <p class="hero-name">{profile.name}</p>
  <!-- Playability #4: three bronze medallions, not a stack of settings buttons. -->
  <nav class="medallions" aria-label="Ton héros">
    <a class="medallion" data-testid="hero-settings" href={href('settings', { profileId })} onclick={(e) => inCabin(e, href('settings', { profileId }))}>
      <span class="medallion-disc" aria-hidden="true"><Icon name="lyre" size={34} /></span>
      <span class="medallion-caption">La lyre</span>
    </a>
    <a class="medallion" data-testid="hero-journal" href={href('stats', { profileId })} onclick={(e) => inCabin(e, href('stats', { profileId }))}>
      <span class="medallion-disc" aria-hidden="true"><Icon name="journal" size={34} /></span>
      <span class="medallion-caption">Ton journal</span>
    </a>
    <a class="medallion" data-testid="hero-switch" href={href('profiles')} onclick={() => clearProfile()}>
      <span class="medallion-disc" aria-hidden="true"><Icon name="shield" size={34} /></span>
      <span class="medallion-caption">Changer de héros</span>
    </a>
  </nav>
</div>

<style>
  .hero-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .hero-name {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 20px;
  }
  .medallions {
    display: flex;
    justify-content: center;
    gap: 28px;
    margin-top: 4px;
  }
  .medallion {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 96px;
    color: var(--ink);
    text-decoration: none;
  }
  .medallion-disc {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 68px;
    height: 68px;
    border-radius: 50%;
    border: 2px solid var(--bronze-dark);
    background: radial-gradient(circle at 35% 30%, var(--bronze-light), var(--bronze) 55%, var(--bronze-dark));
    color: var(--bronze-ink);
    box-shadow:
      inset 0 0 0 4px rgba(255, 240, 200, 0.2),
      0 4px 10px rgba(0, 0, 0, 0.3);
    transition: transform 0.1s ease;
  }
  .medallion:active .medallion-disc {
    transform: translateY(1px);
  }
  .medallion:focus-visible {
    outline: none;
  }
  .medallion:focus-visible .medallion-disc {
    outline: 3px solid var(--gold-light);
    outline-offset: 3px;
  }
  .medallion-caption {
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 16px;
  }
</style>
