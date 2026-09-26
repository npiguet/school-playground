<script lang="ts">
  // The dragon's care (UI3 Ruling B5, was DragonScreen): naming it once it hatches and picking an
  // unlocked tint (spec §2, §3.6; plan Decision 11). The nest itself shows the dragon, its stage and
  // its growth; the dragon speaks from the overlay's voice plate. Tints are known in advance (locked
  // swatches say how to win them, ethics: nothing is a gamble) and changing one is instant/optimistic.
  import { ART, MARK_ICONS } from '../../../lib/world/art';
  import { worldApi } from '../../../lib/world/api';
  import { campStore, refreshCamp, loadCatalog } from '../../../lib/world/campStore.svelte';
  import { TINT_NAMES, eggFilter, validName } from '../../../lib/world/dragon';
  import type { Tint } from '../../../lib/world/types';
  import { ApiError } from '../../../lib/api';
  import { playSfx, unlockAudio } from '../../../lib/juice/sfx';
  import type { Profile } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  $effect(() => {
    void refreshCamp(profile.id);
    void loadCatalog();
  });

  const dragon = $derived(campStore.data?.dragon ?? null);

  const TINTS_ALL: Tint[] = ['bronze', 'ecume', 'olivier', 'braise', 'jade', 'argent'];

  let nameInput = $state('');
  let nameError = $state('');
  let savingName = $state(false);
  let toast = $state('');

  $effect(() => {
    nameInput = dragon?.name ?? '';
  });

  function showToast(message: string) {
    toast = message;
    setTimeout(() => {
      if (toast === message) toast = '';
    }, 2500);
  }

  async function saveName() {
    nameError = '';
    if (!validName(nameInput)) {
      nameError = 'Un nom de 1 à 20 lettres.';
      return;
    }
    savingName = true;
    try {
      await worldApi.patchDragon(profile.id, { name: nameInput });
      unlockAudio();
      playSfx('chime');
      showToast("C'est noté.");
      await refreshCamp(profile.id);
    } catch (e) {
      nameError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      savingName = false;
    }
  }

  let tintError = $state('');
  let savingTint = $state<Tint | null>(null);

  function isUnlocked(t: Tint): boolean {
    return dragon?.unlocked_tints.includes(t) ?? t === 'bronze';
  }

  async function pickTint(t: Tint) {
    if (!dragon || !isUnlocked(t) || t === dragon.tint) return;
    const previous = campStore.data;
    tintError = '';
    savingTint = t;
    // Optimistic: the picker feels instant; a 422 (tint locked after all - stale camp data)
    // reverts to the server's own state.
    if (campStore.data) campStore.data = { ...campStore.data, dragon: { ...campStore.data.dragon, tint: t } };
    try {
      await worldApi.patchDragon(profile.id, { tint: t });
      unlockAudio();
      playSfx('chime');
    } catch (e) {
      campStore.data = previous;
      tintError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      savingTint = null;
    }
  }
</script>

<div class="panel-care">
  {#if !campStore.data}
    {#if campStore.error}
      <p class="kit-note" data-tone="eris">Impossible de rejoindre ton dragon : {campStore.error}</p>
    {:else}
      <p class="muted">Les Muses cherchent ton dragon…</p>
    {/if}
  {:else if dragon}
    <section class="name-section">
      <h3 class="kit-section">Son nom</h3>
      {#if dragon.stage === 'egg'}
        <p class="muted">Tu lui donneras un nom quand il éclora.</p>
      {:else}
        <div class="name-form">
          <input
            data-testid="dragon-name-input"
            aria-label="Le nom de ton dragon"
            maxlength="20"
            lang="fr"
            autocapitalize="words"
            bind:value={nameInput}
          />
          <button type="button" class="kit-bronze" data-testid="dragon-name-save" disabled={savingName} onclick={saveName}>
            Garder ce nom
          </button>
        </div>
        {#if nameError}<p class="kit-note" data-tone="eris" role="alert">{nameError}</p>{/if}
        {#if toast}<p class="kit-note" role="status">{toast}</p>{/if}
      {/if}
    </section>

    <section class="tint-section">
      <h3 class="kit-section">Sa teinte</h3>
      {#if tintError}<p class="kit-note" data-tone="eris" role="alert">{tintError}</p>{/if}
      <div class="tints">
        {#each TINTS_ALL as t (t)}
          {@const unlocked = isUnlocked(t)}
          <button
            type="button"
            class="tint-swatch"
            data-testid="dragon-tint-{t}"
            disabled={!unlocked || savingTint !== null}
            class:selected={dragon.tint === t}
            class:locked={!unlocked}
            onclick={() => pickTint(t)}
          >
            <!-- The tint (or the locked grey) filters the egg only: the ring and the lock keep
                 their own colours (fix round 1). -->
            <span class="swatch-circle">
              <img class="swatch-egg" src={ART.dragon.egg} alt="" style={`filter: ${eggFilter(t, unlocked)}`} />
              {#if !unlocked}<span class="lock" aria-hidden="true"><img src={MARK_ICONS.lock} alt="" /></span>{/if}
            </span>
            <span class="swatch-name">{TINT_NAMES[t]}</span>
            {#if !unlocked}<span class="swatch-how">À gagner : quête de l'Oracle</span>{/if}
          </button>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .panel-care {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .name-section,
  .tint-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  /* The section's flex gap spaces its lines; a paragraph's own margins would double it. */
  .name-section > p,
  .tint-section > p {
    margin: 0;
  }
  .name-form {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .tints {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .tint-swatch {
    appearance: none;
    background: transparent;
    border: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 72px;
    min-height: 48px;
    padding: 4px;
    cursor: pointer;
  }
  .tint-swatch:disabled {
    cursor: default;
  }
  .swatch-circle {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 3px solid var(--gold);
    background: var(--marble-dark);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .swatch-egg {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
  .tint-swatch.selected .swatch-circle {
    border-color: var(--olive);
    box-shadow: 0 0 0 2px var(--olive-light);
  }
  .tint-swatch.locked .swatch-circle {
    border-color: var(--ink-soft);
  }
  .lock {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lock img {
    width: 26px;
    height: 26px;
    object-fit: contain;
  }
  .swatch-name {
    font-size: 13px;
  }
  .swatch-how {
    font-size: 13px;
    font-style: italic;
    color: var(--reward-ink);
    max-width: 96px;
    text-align: center;
  }
</style>
