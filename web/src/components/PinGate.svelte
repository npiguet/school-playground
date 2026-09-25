<script lang="ts">
  // The hero's code (legacy logic unchanged), staged as a sealed parchment over the blurred camp
  // gates (UI3 Ruling A4; the painted padlock is icon inventory row 20).
  import { api, ApiError } from '../lib/api';
  import { markUnlocked } from '../lib/profileStore.svelte';
  import { href } from '../lib/routes';
  import { de } from '../lib/text/french';
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
    <h1 class="kit-plaque pin-title">Le sceau {de(profile.name)}</h1>
    <!-- Playability #14: four wax slots fill as digits arrive; the real input lies over them
         (opacity 0), so a tap anywhere on the slots opens the keypad. -->
    <div class="pin-slots" data-testid="pin-slots">
      {#each [0, 1, 2, 3] as i (i)}
        <span class="kit-seal pin-slot" class:is-empty={pin.length <= i} aria-hidden="true"></span>
      {/each}
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
    </div>
    <label class="pin-caption" for="pin-input">Tes quatre chiffres</label>
    {#if error}
      <p class="orange" role="alert">{error}</p>
    {/if}
    <a class="kit-link" href={href('profiles')}>Changer de héros</a>
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
  /* Playability #14: `inset: -16px` pushes the blur's dark edge halo off screen. */
  .pin-backdrop {
    position: absolute;
    inset: -16px;
    width: calc(100% + 32px);
    height: calc(100% + 32px);
    object-fit: cover;
    filter: blur(8px) brightness(0.45);
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
    max-width: 100%;
    font-size: 18px;
    white-space: normal;
    text-wrap: balance;
  }
  .pin-slots {
    position: relative;
    display: flex;
    gap: 14px;
  }
  .pin-slot {
    --seal-size: 52px;
  }
  .pin-slot.is-empty {
    background: rgba(92, 64, 24, 0.12);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
    border: 2px dashed rgba(138, 90, 40, 0.5);
  }
  .pin-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    font-size: 16px; /* no iOS zoom on focus */
    caret-color: transparent;
    /* Fix round 1 #6: mask the code like a real PIN entry. WebKit-only app (Desktop Safari + iPad
       projects), and `inputmode="numeric"` still drives the on-screen numeric keypad with `type`
       left as `text`, so no logic below has to change. */
    -webkit-text-security: disc;
  }
  .pin-slots:focus-within {
    outline: 3px solid var(--gold-light);
    outline-offset: 6px;
    border-radius: 12px;
  }
  .pin-caption {
    font-family: var(--font-body);
    font-variant: normal;
    font-weight: 600;
    font-size: 16px;
    color: var(--form-ink-soft);
  }
</style>
