<script lang="ts">
  import { api, ApiError } from '../lib/api';
  import { markUnlocked } from '../lib/profileStore.svelte';
  import { href } from '../lib/routes';
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

<div class="screen pin-gate">
  <h1 class="title">Code de {profile.name}</h1>
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
  <a href={href('profiles')}>Changer de héros</a>
</div>

<style>
  .pin-gate {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    text-align: center;
  }
  .title {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 600;
    margin: 0;
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
  .pin-input {
    width: 200px;
    text-align: center;
    font-size: 40px;
    letter-spacing: 0.4em;
    min-height: 64px;
  }
</style>
