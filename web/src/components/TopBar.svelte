<script lang="ts">
  import Avatar from './Avatar.svelte';
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
    <a class="link" data-testid="topbar-camp" href={href('camp', { profileId })}
      ><span class="icon">🏕️</span><span class="label">Camp</span></a
    >
    <a class="link" href={href('dossier', { profileId })}><span class="icon">📊</span><span class="label">Progrès</span></a>
    <a class="link" href={href('settings', { profileId })}><span class="icon">⚙️</span><span class="label">Réglages</span></a>
    <button
      type="button"
      class="link"
      data-testid="topbar-mute"
      aria-pressed={soundStore.muted}
      onclick={toggleMute}
    >
      <span class="icon">{soundStore.muted ? '🔇' : '🔊'}</span><span class="label">Son</span>
    </button>
    <a class="link" href={href('profiles')} onclick={onChangeHero}>
      <span class="icon">🔄</span><span class="label">Changer de héros</span>
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
    font-size: 20px;
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
