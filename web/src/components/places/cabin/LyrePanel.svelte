<script lang="ts">
  // The lyre (UI3 Ruling B6, was the Settings screen): the dictation voice's trial, the hero's class,
  // the camp's sounds, the weekly goal as medallions, the seal (PIN), the camp's tours and the credits
  // (immersion Deferred #7), on a scroll in the cabin. The mute (A17) became three channels (UI5,
  // spec §7). UI3b playability #6: every choice is a medallion, and the dragon says what the lyre is
  // for from the overlay's voice plate (CabinRoom.svelte), so the headings stay short.
  import { onDestroy, untrack } from 'svelte';
  import LevelMedallions from '../../ui/LevelMedallions.svelte';
  import ChannelRow from './ChannelRow.svelte';
  import VoiceLostCard from '../../battle/VoiceLostCard.svelte';
  import { api, ApiError } from '../../../lib/api';
  import { createVoice, VoiceError, type VoiceFailure } from '../../../lib/dictation/voice';
  import { createWaitLine } from '../../../lib/dictation/waitLine';
  import { profileStore } from '../../../lib/profileStore.svelte';
  import { useToast } from '../../../lib/ui/toast.svelte';
  import { audioSettings } from '../../../lib/audio/store.svelte';
  import { resetTours } from '../../../lib/tours/seen.svelte';
  import { frenchSpacing } from '../../../lib/text/french';
  import { sayKey } from '../../../lib/dialogue/select';
  import { buildLine } from '../../../lib/version';
  import type { Profile } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  // Local, editable copies of the profile's settings: each field is seeded once from `profile`
  // and then owned by its own form control, so they must not track `profile` afterwards.
  let level = $state(untrack(() => profile.level));
  // A string for the medallions (radio values); sent back as a number.
  let weeklyGoal = $state(String(untrack(() => profile.settings.weekly_goal ?? 3)));
  let newPin = $state('');
  let error = $state('');
  const toast = useToast();
  let saving = $state(false);
  let removingPin = $state(false);
  let replaying = $state(false);

  // The trial line (Ruling K10): the server's voice, like the dictation; the same card when it fails.
  const TRIAL = 'Bonjour\u202f! Je lirai tes dictées. Virgule, point.';
  const TRIAL_PLAYING = 'Écoute la Pythie…';
  const voice = untrack(() => createVoice({ profileId: profile.id }));
  onDestroy(() => voice.dispose());
  let trying = $state(false);
  let trialFailure = $state<VoiceFailure | null>(null);
  // The dictation's waiting lines when the trial is late (Task 9 review #6, fix wave B ruling 1).
  let trialWait = $state<string | null>(null);
  const waitLine = createWaitLine(
    (text) => (trialWait = text),
    (key) => sayKey(key).text,
  );
  // Playability #10: the trial says it is being read (with the sound low, she still sees it played).
  let trialPlaying = $state(false);
  onDestroy(() => waitLine.clear());

  // A failed trial's card stays up while its « Réessayer » asks again (playability #5), and « Écouter
  // un essai » steps aside meanwhile, so the two never offer the same thing (#10).
  async function tryVoice() {
    if (trying) return;
    trying = true;
    // A muted voice fetches nothing (the note under « La voix » says why): nothing left to fail.
    if (audioSettings.voice.muted) trialFailure = null;
    try {
      await voice.speak(TRIAL, 0.9, {
        onSlow: () => waitLine.slow(),
        onStart: () => {
          waitLine.done();
          trialFailure = null;
          trialPlaying = true;
        },
      });
      // Said: a muted voice never starts a clip, but its trial went through (re-review N2).
      trialFailure = null;
    } catch (e) {
      trialFailure = e instanceof VoiceError ? e.failure : 'server';
    } finally {
      trying = false;
      trialPlaying = false;
      waitLine.clear();
    }
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
      const body: { settings: { weekly_goal?: number }; level: string; pin?: string } = {
        settings: { weekly_goal: Number(weeklyGoal) },
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

  // The credits' last line: the build the server runs (README troubleshooting: which version the iPad
  // runs). Nothing shown if the server does not say.
  let build = $state<string | null>(null);
  api
    .health()
    .then((h) => (build = buildLine(h.build)))
    .catch(() => {});

  // UI5 Ruling E13: every tour can be replayed, so nothing a tour says is lost.
  async function replayTours() {
    replaying = true;
    error = '';
    try {
      await resetTours(profile.id);
      toast.show('Les visites reprendront à ton prochain passage dans chaque lieu.');
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      replaying = false;
    }
  }
</script>

<div class="panel-lyre">
  <form onsubmit={save}>
    <section>
      <h3 class="kit-section">La voix de la Pythie</h3>
      <!-- Final review M7: a muted voice says nothing; the trial waits for it (the note below says why). -->
      {#if !trialFailure}
        <button type="button" class="kit-bronze is-quiet" data-testid="lyre-try-voice" disabled={audioSettings.voice.muted || trying} onclick={tryVoice}
          >Écouter un essai</button
        >
      {/if}
      <!-- While the card is up it says the Pythia tries again: no second line saying so (re-review N3). -->
      {#if trialWait && !trialFailure}
        <p class="kit-note" role="status" data-testid="lyre-voice-wait">{trialWait}</p>
      {:else if trialPlaying}
        <p class="kit-note" role="status" data-testid="lyre-voice-playing">{TRIAL_PLAYING}</p>
      {/if}
      {#if trialFailure}
        <VoiceLostCard failure={trialFailure} retrying={trying} onRetry={tryVoice} />
      {/if}
    </section>

    <section>
      <h3 class="kit-section">Les sons du camp</h3>
      <ChannelRow profileId={profile.id} channel="music" label="La musique" name="Musique" volumeLabel="Volume de la musique" />
      <ChannelRow profileId={profile.id} channel="sfx" label="Les bruitages" name="Bruitages" volumeLabel="Volume des bruitages" />
      <ChannelRow profileId={profile.id} channel="voice" label="La voix" name="Voix" volumeLabel="Volume de la voix" />
      {#if audioSettings.voice.muted}
        <p class="kit-note" data-testid="lyre-voice-muted">{frenchSpacing("En sourdine, la dictée n'est plus lue à voix haute\u202f: il faudra quelqu'un pour te la lire.")}</p>
      {/if}
    </section>

    <section>
      <LevelMedallions legend="Ta classe" name="settings-level" bind:value={level} />
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

    <!-- UI5 playability #16: « Enregistrer » closes the choices above it, in its own row; the tours
         come after an engraved line, so it never reads as the button that saves the tours. -->
    <button type="submit" class="kit-bronze" data-testid="lyre-save" disabled={saving}>Enregistrer</button>

    <section class="apart">
      <h3 class="kit-section">Les visites du camp</h3>
      <button type="button" class="kit-link" data-testid="lyre-tours" onclick={replayTours} disabled={replaying}>Refaire les visites du camp</button>
    </section>

    {#if error}
      <p class="kit-note" data-tone="eris" role="alert">{error}</p>
    {/if}
    {#if toast.message}
      <p class="kit-note" role="status">{toast.message}</p>
    {/if}
  </form>

  <details class="lyre-credits" data-testid="lyre-credits">
    <summary class="kit-link">Merci à ceux qui ont aidé le camp</summary>
    <p>Les lettres du camp{'\u202f: '}Cinzel, Alegreya et Literata, offertes par leurs auteurs sous la licence SIL Open Font.</p>
    <p>La voix de la Pythie est celle de Kokoro, offerte par ses auteurs sous la licence Apache 2.0, apprise sur les enregistrements français SIWIS, offerts sous la licence Creative Commons Attribution 4.0.</p>
    <p>Les musiques et les bruitages du camp ont été offerts à tous par leurs auteurs, sous la licence Creative Commons Zéro.</p>
    <p>Les livres d'Alexandrie viennent de Wikisource et du Projet Gutenberg. Chaque œuvre garde le nom de son auteur et de son traducteur.</p>
    <p>Les peintures du camp ont été faites pour lui.</p>
    {#if build}
      <p class="lyre-build" data-testid="lyre-build">{build}</p>
    {/if}
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
  /* An engraved line: a dark cut with a lit lip under it, on the parchment. */
  .apart {
    margin-top: 8px;
    padding-top: 18px;
    border-top: 1px solid rgba(92, 64, 24, 0.45);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }
  .lyre-credits {
    margin-top: 22px;
  }
  .lyre-credits p {
    margin: 8px 0 0;
    font-size: 15px;
  }
  .lyre-credits .lyre-build {
    margin-top: 14px;
    font-size: 13px;
    color: var(--ink-soft);
  }
</style>
