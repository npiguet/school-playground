<script lang="ts">
  // The hero's code (legacy logic unchanged), staged as a sealed parchment over the blurred camp
  // gates (UI3 Ruling A4; the painted padlock is icon inventory row 20).
  import { api, ApiError } from '../lib/api';
  import { markUnlocked } from '../lib/profileStore.svelte';
  import { href } from '../lib/routes';
  import { ART, MARK_ICONS } from '../lib/world/art';
  import type { Profile } from '../lib/types';

  let { profile, onUnlocked }: { profile: Profile; onUnlocked: () => void } = $props();

  let pin = $state('');
  let error = $state('');
  let checking = $state(false);

  async function submit(value: string) {
    checking = true;
    error = '';
    try {
      const res = await api.profiles.verifyPin(profile.id, value);
      if (res.ok) {
        markUnlocked(profile.id);
        onUnlocked();
      } else {
        error = "Ce n'est pas le bon code. Réessaie.";
        pin = '';
      }
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue. Réessaie.';
      pin = '';
    } finally {
      checking = false;
    }
  }

  function onInput(event: Event) {
    const value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
    pin = value;
    if (value.length === 4 && !checking) submit(value);
  }
</script>

<div class="pin-gate" data-testid="pin-gate">
  <img class="pin-backdrop" src={ART.scenes.titleGates} alt="" aria-hidden="true" />
  <div class="pin-seal kit-parchment kit-form">
    <img class="pin-lock" src={MARK_ICONS.lock} alt="" />
    <h1 class="kit-plaque pin-title">Code de {profile.name}</h1>
    <label class="visually-hidden" for="pin-input">Code de {profile.name}</label>
    <input
      id="pin-input"
      class="pin-input"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength="4"
      autocomplete="off"
      value={pin}
      oninput={onInput}
      disabled={checking}
    />
    {#if error}
      <p class="orange" role="alert">{error}</p>
    {/if}
    <a class="kit-bronze" href={href('profiles')}>Changer de héros</a>
  </div>
</div>

<style>
  .pin-gate {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--night);
    overflow: hidden;
  }
  .pin-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: blur(8px) brightness(0.45);
    transform: scale(1.06);
  }
  .pin-seal {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    width: min(420px, 100%);
    padding: 28px 24px;
    text-align: center;
  }
  .pin-lock {
    width: 64px;
    height: 64px;
    object-fit: contain;
  }
  .pin-title {
    font-size: 18px;
  }
  .pin-input {
    width: 180px;
    text-align: center;
    font-size: 32px;
    letter-spacing: 0.4em;
    font-family: var(--font-display);
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
