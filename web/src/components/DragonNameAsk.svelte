<script lang="ts">
  // The question of the dragon's name and her answer inked on the parchment's line (UI4 playability
  // #9), shared by the victory's hatch (VictorySpoils) and the camp's « grew while you were away »
  // reveal (final review I3). Saving hides it, chimes and refreshes the camp (the dragon's plate, the
  // nest's caption). Inside an Overlay (`ownKeyboard` false) the panel already keeps the focused field
  // above the iPad's keyboard; on the victory sheet it keeps its own line in view.
  import { untrack } from 'svelte';
  import { VICTORY } from '../lib/battle/lines';
  import { worldApi } from '../lib/world/api';
  import { refreshCamp } from '../lib/world/campStore.svelte';
  import { validName } from '../lib/world/dragon';
  import { ApiError } from '../lib/api';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { keepFocusedFieldAboveKeyboard } from '../lib/scene/keyboardField.svelte';

  let {
    profileId,
    testPrefix = 'reveal',
    ownKeyboard = true,
  }: { profileId: number; testPrefix?: string; ownKeyboard?: boolean } = $props();

  let input = $state('');
  let error = $state('');
  let saved = $state(false);
  let saving = $state(false);
  // iPad report 2026-09-28: her dragon's name line stays whole above the on-screen keyboard (the
  // stage folds, the sheet scrolls it into view).
  let form = $state<HTMLDivElement | undefined>(undefined);
  if (untrack(() => ownKeyboard)) keepFocusedFieldAboveKeyboard(() => form);

  async function save() {
    error = '';
    if (!validName(input)) {
      error = 'Un nom de 1 à 20 lettres.';
      return;
    }
    saving = true;
    try {
      await worldApi.patchDragon(profileId, { name: input });
      saved = true;
      unlockAudio();
      playSfx('chime');
      await refreshCamp(profileId);
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      saving = false;
    }
  }
</script>

{#if !saved}
  <div class="dragon-name">
    <p class="name-ask" id="{testPrefix}-name-ask">{VICTORY.nameAsk}</p>
    <!-- Not a kit-form field: her dragon's name is written on the parchment's line. -->
    <div class="name-form" bind:this={form}>
      <input
        class="name-line"
        data-testid="{testPrefix}-name-input"
        aria-label={VICTORY.dragonName}
        aria-describedby="{testPrefix}-name-ask"
        placeholder={VICTORY.namePlaceholder}
        maxlength="20"
        lang="fr"
        autocapitalize="words"
        autocorrect="off"
        spellcheck="false"
        bind:value={input}
      />
      <button type="button" class="kit-bronze" data-testid="{testPrefix}-name-save" disabled={saving} onclick={save}>
        {VICTORY.nameSave}
      </button>
    </div>
    {#if error}<p class="kit-note" data-tone="eris" role="alert">{error}</p>{/if}
  </div>
{/if}

<style>
  .dragon-name {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }
  .dragon-name > p {
    margin: 0;
  }
  .name-ask {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    color: var(--ink);
  }
  .name-form {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
  }
  /* Her dragon's name, inked on the parchment's line (UI4 playability #9). The component's classes
     outrank `.kit-form input:not(...)` (the parchment field look) inside an Overlay's body. */
  .dragon-name .name-form input.name-line {
    width: 12em;
    min-height: 48px;
    padding: 4px 8px;
    background: transparent;
    border: 0;
    border-bottom: 2px solid var(--bronze);
    border-radius: 0;
    box-shadow: none;
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 22px;
    text-align: center;
  }
  .dragon-name .name-form input.name-line::placeholder {
    color: var(--ink-soft);
    font-style: italic;
  }
  .dragon-name .name-form input.name-line:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
</style>
