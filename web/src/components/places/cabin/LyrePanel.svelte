<script lang="ts">
  // The lyre (UI3 Ruling B6, was the Settings screen): the dictation voice, the hero's class, the
  // game's single mute (shared with the HUD, UI3a Ruling A17), the weekly goal as medallions, the
  // seal (PIN) and the credits (immersion Deferred #7), on a scroll in the cabin. UI3b playability
  // #6: every choice is a medallion (the mute too: « Joués » / « Coupés », real radios), the voice's
  // select wears the parchment look with no label over it, and the dragon says what the lyre is for
  // from the overlay's voice plate (CabinRoom.svelte), so the headings stay short.
  import { untrack } from 'svelte';
  import LevelMedallions from '../../ui/LevelMedallions.svelte';
  import { api, ApiError } from '../../../lib/api';
  import { listFrenchVoices, pickVoice, speak, waitForVoices } from '../../../lib/dictation/tts';
  import { profileStore } from '../../../lib/profileStore.svelte';
  import { useToast } from '../../../lib/ui/toast.svelte';
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
  const toast = useToast();
  let saving = $state(false);
  let removingPin = $state(false);

  // The mute as a medallion pair; it applies at once (not with « Enregistrer »), like the HUD's.
  const SOUNDS_ON = 'Joués';
  const SOUNDS_OFF = 'Coupés';
  let sounds = $state(untrack(() => (soundStore.muted ? SOUNDS_OFF : SOUNDS_ON)));
  $effect(() => {
    sounds = soundStore.muted ? SOUNDS_OFF : SOUNDS_ON;
  });
  function onSoundsChange(value: string) {
    void setMuted(profile.id, value === SOUNDS_OFF);
  }

  async function loadVoices() {
    const all = await waitForVoices();
    voices = listFrenchVoices(all);
    if (!voiceName && voices.length > 0) voiceName = voices[0].name;
  }

  loadVoices();

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
      error = 'Ton sceau a quatre chiffres.';
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
      toast.show("C'est noté.");
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
      toast.show("C'est noté.");
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
          <select id="voice" aria-label="Voix de la dictée" data-testid="lyre-voice" bind:value={voiceName}>
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
      <LevelMedallions legend="Les sons du camp" name="camp-sounds" options={[SOUNDS_ON, SOUNDS_OFF]} bind:value={sounds} onchange={onSoundsChange} testId="lyre-sounds" />
      <p class="note">La dictée est toujours lue.</p>
    </section>

    <section>
      <h3 class="kit-section">Ton objectif</h3>
      <LevelMedallions legend="Textes par semaine" name="weekly-goal" options={['2', '3', '4', '5']} bind:value={weeklyGoal} />
    </section>

    <section>
      <h3 class="kit-section">Ton sceau</h3>
      <div class="field">
        <label for="new-pin">Tes quatre chiffres</label>
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
    {#if toast.message}
      <p class="kit-note" role="status">{toast.message}</p>
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
  .note {
    margin: 4px 0 0;
    font-size: 15px;
    font-style: italic;
    color: var(--form-ink-soft);
  }
  .lyre-credits {
    margin-top: 22px;
  }
  .lyre-credits p {
    margin: 8px 0 0;
    font-size: 15px;
  }
</style>
