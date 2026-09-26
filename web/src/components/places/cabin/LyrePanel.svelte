<script lang="ts">
  // The lyre (UI3 Ruling B6, was the Settings screen): the dictation voice, the hero's class, the
  // game's single mute (shared with the HUD, UI3a Ruling A17), the weekly goal as medallions, the
  // seal (PIN) and the credits (immersion Deferred #7), on a scroll in the cabin.
  import { untrack } from 'svelte';
  import LevelMedallions from '../../ui/LevelMedallions.svelte';
  import { api, ApiError } from '../../../lib/api';
  import { listFrenchVoices, pickVoice, speak, waitForVoices } from '../../../lib/dictation/tts';
  import { profileStore } from '../../../lib/profileStore.svelte';
  import { soundStore, setMuted } from '../../../lib/juice/soundStore.svelte';
  import type { Profile } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  let voices = $state<SpeechSynthesisVoice[]>([]);
  // Local, editable copies of the profile's settings: each field is seeded once from `profile`
  // and then owned by its own form control, so they must not track `profile` afterwards.
  let voiceName = $state(untrack(() => profile.settings.voice ?? ''));
  let level = $state(untrack(() => profile.level));
  // A string for the medallions (radio values); sent back as a number.
  let weeklyGoal = $state(String(untrack(() => profile.settings.weekly_goal ?? 3)));
  let newPin = $state('');
  let error = $state('');
  let toast = $state('');
  let saving = $state(false);
  let removingPin = $state(false);

  function onMuteChange(event: Event) {
    void setMuted(profile.id, (event.target as HTMLInputElement).checked);
  }

  async function loadVoices() {
    const all = await waitForVoices();
    voices = listFrenchVoices(all);
    if (!voiceName && voices.length > 0) voiceName = voices[0].name;
  }

  loadVoices();

  function showToast(message: string) {
    toast = message;
    setTimeout(() => {
      if (toast === message) toast = '';
    }, 2500);
  }

  async function tryVoice() {
    const voice = pickVoice(voices, voiceName || null);
    await speak('Bonjour ! Je lirai tes dictées. Virgule, point.', { rate: 0.9, voice });
  }

  function onPinInput(event: Event) {
    newPin = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (saving) return;
    if (newPin && newPin.length !== 4) {
      error = 'Le code doit avoir quatre chiffres.';
      return;
    }
    saving = true;
    error = '';
    try {
      const body: { settings: { voice?: string; weekly_goal?: number }; level: string; pin?: string } = {
        settings: { voice: voiceName || undefined, weekly_goal: Number(weeklyGoal) },
        level,
      };
      if (newPin) body.pin = newPin;
      const updated = await api.profiles.patch(profile.id, body);
      profileStore.current = updated;
      newPin = '';
      showToast("C'est noté.");
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      saving = false;
    }
  }

  async function removePin() {
    if (removingPin) return;
    removingPin = true;
    error = '';
    try {
      const updated = await api.profiles.patch(profile.id, { pin: '' });
      profileStore.current = updated;
      showToast("C'est noté.");
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      removingPin = false;
    }
  }
</script>

<div class="panel-lyre">
  <form onsubmit={save}>
    <section>
      <h3 class="kit-section">La voix de la dictée</h3>
      {#if voices.length === 0}
        <p class="kit-note">Aucune voix française sur cet appareil. Sur iPad : ouvre Réglages, puis Accessibilité, puis Contenu énoncé, puis Voix, puis Français.</p>
      {:else}
        <div class="field">
          <label for="voice">Voix</label>
          <select id="voice" bind:value={voiceName}>
            {#each voices as v (v.name)}
              <option value={v.name}>{v.name}</option>
            {/each}
          </select>
        </div>
        <button type="button" class="kit-bronze is-quiet" onclick={tryVoice}>Écouter un essai</button>
      {/if}
    </section>

    <section>
      <LevelMedallions legend="Ta classe" name="settings-level" bind:value={level} />
    </section>

    <section>
      <h3 class="kit-section">Les sons</h3>
      <label class="checkbox-field">
        <input type="checkbox" checked={soundStore.muted} onchange={onMuteChange} />
        Couper les sons du jeu (la dictée reste lue)
      </label>
    </section>

    <section>
      <h3 class="kit-section">Ton objectif</h3>
      <LevelMedallions legend="Textes par semaine" name="weekly-goal" options={['2', '3', '4', '5']} bind:value={weeklyGoal} />
    </section>

    <section>
      <h3 class="kit-section">Ton sceau</h3>
      <div class="field">
        <label for="new-pin">Nouveau code (quatre chiffres)</label>
        <input
          id="new-pin"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="4"
          value={newPin}
          oninput={onPinInput}
        />
      </div>
      {#if profile.has_pin}
        <button type="button" class="kit-link" onclick={removePin} disabled={removingPin}>Retirer le sceau</button>
      {/if}
    </section>

    {#if error}
      <p class="kit-note" data-tone="eris" role="alert">{error}</p>
    {/if}
    {#if toast}
      <p class="kit-note" role="status">{toast}</p>
    {/if}

    <button type="submit" class="kit-bronze" disabled={saving}>Enregistrer</button>
  </form>

  <details class="lyre-credits" data-testid="lyre-credits">
    <summary class="kit-link">Merci à ceux qui ont aidé le camp</summary>
    <p>Les lettres du camp : Cinzel, Alegreya et Literata, offertes par leurs auteurs sous la licence SIL Open Font.</p>
    <p>Les livres d'Alexandrie viennent de Wikisource et du Projet Gutenberg. Chaque œuvre garde le nom de son auteur et de son traducteur.</p>
    <p>Les peintures du camp ont été faites pour lui.</p>
  </details>
</div>

<style>
  .panel-lyre form {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
  .panel-lyre section {
    align-self: stretch;
  }
  .field {
    margin-bottom: 12px;
  }
  .checkbox-field {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: normal;
    min-height: 48px;
  }
  .checkbox-field input {
    min-height: unset;
    width: 22px;
    height: 22px;
  }
  .lyre-credits {
    margin-top: 22px;
  }
  .lyre-credits p {
    margin: 8px 0 0;
    font-size: 15px;
  }
</style>
