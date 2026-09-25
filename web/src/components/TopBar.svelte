<script lang="ts">
  import Avatar from './Avatar.svelte';
  import Icon from './ui/Icon.svelte';
  import { clearProfile } from '../lib/profileStore.svelte';
  import { href } from '../lib/routes';
  import { soundStore, setMuted } from '../lib/juice/soundStore.svelte';
  import { unlockAudio } from '../lib/juice/sfx';
  import type { Profile } from '../lib/types';

  let { profile, title = '' }: { profile: Profile; title?: string } = $props();

  const profileId = $derived(String(profile.id));

  function onChangeHero() {
    clearProfile();
  }

  function toggleMute() {
    unlockAudio();
    void setMuted(profile.id, !soundStore.muted);
  }
</script>

<header class="topbar">
  <div class="left">
    <Avatar avatar={profile.avatar} size={36} />
    <span class="name">{profile.name}</span>
  </div>
  <h1 class="title">{title}</h1>
  <nav class="right">
    <a class="link" data-testid="topbar-camp" aria-label="Retour au camp" href={href('camp', { profileId })}
      ><span class="icon"><Icon name="arrow-left" size={20} /></span><span class="label">Retour au camp</span></a
    >
    <a class="link" aria-label="Progrès" href={href('dossier', { profileId })}
      ><span class="icon"><Icon name="journal" size={22} /></span><span class="label">Progrès</span></a
    >
    <a class="link" aria-label="Réglages" href={href('settings', { profileId })}
      ><span class="icon"><Icon name="lamp" size={22} /></span><span class="label">Réglages</span></a
    >
    <button
      type="button"
      class="link"
      data-testid="topbar-mute"
      aria-pressed={soundStore.muted}
      aria-label="Son"
      onclick={toggleMute}
    >
      <span class="icon"><Icon name={soundStore.muted ? 'lyre-muted' : 'lyre'} size={22} /></span><span class="label">Son</span>
    </button>
    <a class="link" aria-label="Changer de héros" href={href('profiles')} onclick={onChangeHero}>
      <span class="icon"><Icon name="shield" size={22} /></span><span class="label">Changer de héros</span>
    </a>
  </nav>
</header>

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    padding-top: calc(10px + env(safe-area-inset-top));
    background: var(--marble-dark);
    border-bottom: 1px solid var(--terracotta);
  }
  .left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    font-family: var(--font-display);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .title {
    font-size: 20px;
    margin: 0;
    text-align: center;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .right {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  button.link {
    appearance: none;
    background: transparent;
    border: none;
    cursor: pointer;
    font: inherit;
  }
  .link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 8px 12px;
    border-radius: var(--radius);
    color: var(--ink);
    text-decoration: none;
    font-size: 15px;
  }
  .link:hover {
    background: var(--marble);
  }
  .icon {
    display: inline-flex;
    color: var(--bronze);
    /* The muted lyre's mute-slash halo (Icon.svelte) is drawn in this surface, not the scene's
       night backdrop, or it reads as a near-black stripe on the marble bar (fix round 1 #5). */
    --icon-halo: var(--marble-dark);
  }
  @media (max-width: 900px) {
    .label {
      display: none;
    }
    .title {
      font-size: 16px;
    }
    .name {
      max-width: 80px;
    }
  }
</style>
