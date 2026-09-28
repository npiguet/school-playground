<script lang="ts">
  // The hero's code (legacy logic unchanged), staged as a sealed parchment over the blurred camp
  // gates (UI3 Ruling A4; the painted padlock is icon inventory row 20). UI3b playability #22: a
  // sheet between two rods like the other in-world papers, and the hero's name never breaks at its
  // hyphen (« Le sceau d' » may wrap before it, the name itself stays whole).
  import { api, ApiError } from '../lib/api';
  import { markUnlocked } from '../lib/profileStore.svelte';
  import { href } from '../lib/routes';
  import { de } from '../lib/text/french';
  import SealSlots from './ui/SealSlots.svelte';
  import { ART, MARK_ICONS } from '../lib/world/art';
  import { viewport } from '../lib/battle/viewport.svelte';
  import { keepFocusedFieldAboveKeyboard } from '../lib/scene/keyboardField.svelte';
  import type { Profile } from '../lib/types';

  let { profile, onUnlocked }: { profile: Profile; onUnlocked: () => void } = $props();

  // iPad report 2026-09-28: while the keypad is up the gate fills the visual viewport (the band
  // above it, a pan included), as an overlay does, and the seal's slots are kept in its view.
  let gate = $state<HTMLDivElement | undefined>(undefined);
  const kb = keepFocusedFieldAboveKeyboard(() => gate);

  let pin = $state('');
  // « d'Élise-Marguerite » -> « d' » + « Élise-Marguerite », « de Yann » -> « de » + « Yann ».
  const owner = $derived.by(() => {
    const full = de(profile.name);
    const name = profile.name.trim();
    return { prefix: full.slice(0, full.length - name.length).trimEnd(), name };
  });
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

<div
  class="pin-gate"
  data-testid="pin-gate"
  bind:this={gate}
  style:top={kb.keyboard ? `${viewport.top}px` : undefined}
  style:bottom={kb.keyboard ? 'auto' : undefined}
  style:height={kb.keyboard ? `${viewport.height}px` : undefined}
>
  <img class="pin-backdrop" src={ART.scenes.titleGates} alt="" aria-hidden="true" />
  <div class="pin-seal kit-sheet kit-form">
    <img class="pin-lock" src={MARK_ICONS.lock} alt="" />
    <h1 class="kit-plaque pin-title">Le sceau {owner.prefix}{owner.prefix.endsWith("'") ? '' : ' '}<span class="pin-name">{owner.name}</span></h1>
    <!-- Playability #14: four wax slots fill as digits arrive (SealSlots, shared with the ritual). -->
    <SealSlots id="pin-input" value={pin} oninput={onInput} disabled={checking} testId="pin-slots" />
    <label class="pin-caption" for="pin-input">Tes quatre chiffres</label>
    {#if error}
      <p class="orange" role="alert">{error}</p>
    {/if}
    <a class="kit-link" href={href('profiles')}>Changer de héros</a>
  </div>
</div>

<style>
  /* The seal is centred by its auto margins, which never go below zero: a seal taller than the
     screen (the keypad up) starts at the top and scrolls, never cut above (a flex `center` would
     push its top out of reach, and `safe center` is too recent for the iPads this runs on). */
  .pin-gate {
    position: fixed;
    inset: 0;
    display: flex;
    padding: 24px;
    background: var(--night);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
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
    margin: auto;
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
  .pin-name {
    white-space: nowrap;
    font-size: clamp(16px, 2.2vw, 20px);
  }
  .pin-caption {
    font-family: var(--font-body);
    font-variant: normal;
    font-weight: 600;
    font-size: 16px;
    color: var(--form-ink-soft);
  }
  /* B2 fix round 1 #8: the flex `gap` above already spaces the error text; a `<p>`'s own default
     margin stacked on top of it, doubling the visible gap. */
  .pin-seal p {
    margin: 0;
  }
</style>
