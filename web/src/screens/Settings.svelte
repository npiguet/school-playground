<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import LevelSelect from '../components/LevelSelect.svelte';
  import { api, ApiError } from '../lib/api';
  import { listFrenchVoices, pickVoice, speak, waitForVoices } from '../lib/dictation/tts';
  import { profileStore } from '../lib/profileStore.svelte';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  let voices = $state<SpeechSynthesisVoice[]>([]);
  let voiceName = $state(profile.settings.voice ?? '');
  let level = $state(profile.level);
  let newPin = $state('');
  let error = $state('');
  let toast = $state('');
  let saving = $state(false);
  let removingPin = $state(false);

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
      const body: { settings: { voice?: string }; level: string; pin?: string } = {
        settings: { voice: voiceName || undefined },
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

<TopBar {profile} title="Réglages" />

<div class="screen">
  <form onsubmit={save}>
    <section>
      <h2>Voix de la dictée</h2>
      {#if voices.length === 0}
        <p class="orange">
          Aucune voix française trouvée sur cet appareil. Sur iPad : Réglages → Accessibilité →
          Contenu énoncé → Voix → Français.
        </p>
      {:else}
        <div class="field">
          <label for="voice">Voix</label>
          <select id="voice" bind:value={voiceName}>
            {#each voices as v (v.name)}
              <option value={v.name}>{v.name}</option>
            {/each}
          </select>
        </div>
        <button type="button" class="btn" onclick={tryVoice}>Écouter un essai</button>
      {/if}
    </section>

    <section>
      <h2>Niveau</h2>
      <LevelSelect label="Ton niveau" bind:value={level} id="settings-level" />
    </section>

    <section>
      <h2>Code</h2>
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
        <button type="button" class="btn" onclick={removePin} disabled={removingPin}>
          Retirer le code
        </button>
      {/if}
    </section>

    {#if error}
      <p class="orange" role="alert">{error}</p>
    {/if}
    {#if toast}
      <p class="toast" role="status">{toast}</p>
    {/if}

    <button type="submit" class="btn btn-primary" disabled={saving}>Enregistrer</button>
  </form>
</div>

<style>
  section {
    margin-bottom: 28px;
  }
  .field {
    margin-bottom: 12px;
  }
  select {
    width: 100%;
    max-width: 360px;
  }
  .toast {
    color: var(--olive);
    font-weight: 600;
  }
</style>
