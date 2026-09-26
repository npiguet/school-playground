<script lang="ts">
  // The dragon's care (UI3 Ruling B5, was DragonScreen): naming it once it hatches and picking an
  // unlocked tint (spec §2, §3.6; plan Decision 11). The nest itself shows the dragon, its stage and
  // its growth; the dragon speaks from the overlay's voice plate (it asks for its name, so no « Son
  // nom » heading). UI3b playability #4: she writes the name on a painted ribbon, as she wrote her own
  // on the forge's banner (HeroForm.svelte), not in a « label + field + submit » form. Tints are known
  // in advance (the locked ones say once, under the row, how to win them; ethics: nothing is a
  // gamble) and changing one is instant/optimistic.
  import { ART, MARK_ICONS } from '../../../lib/world/art';
  import { worldApi } from '../../../lib/world/api';
  import { untrack } from 'svelte';
  import { campFor, campStore, refreshCamp, replaceCamp } from '../../../lib/world/campStore.svelte';
  import { useToast } from '../../../lib/ui/toast.svelte';
  import { TINT_NAMES, eggFilter, validName } from '../../../lib/world/dragon';
  import type { Tint } from '../../../lib/world/types';
  import { ApiError } from '../../../lib/api';
  import { playSfx, unlockAudio } from '../../../lib/juice/sfx';
  import type { Profile } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  // The nest's PlaceScene loads /camp (final review M15); this hero's snapshot only (I2): the store
  // is shared across heroes.
  const camp = $derived(campFor(profile.id));
  const dragon = $derived(camp?.dragon ?? null);

  const TINTS_ALL: Tint[] = ['bronze', 'ecume', 'olivier', 'braise', 'jade', 'argent'];

  let nameInput = $state('');
  let nameError = $state('');
  let savingName = $state(false);
  const toast = useToast();

  // Final review I5: the input follows the saved name only. A new camp snapshot (a tint tapped, a
  // late /camp) carries the same name and must never wipe what the player is typing; the field is
  // seeded when the saved name changes (it arrives, or a save lands), and only while the player has
  // not typed anything else.
  let savedName: string | null = null;
  $effect(() => {
    const name = dragon?.name ?? null;
    untrack(() => {
      if (name === savedName) return;
      if (nameInput === (savedName ?? '')) nameInput = name ?? '';
      savedName = name;
    });
  });

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
      toast.show("C'est noté.");
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
    const previous = camp;
    tintError = '';
    savingTint = t;
    // Optimistic: the picker feels instant; a 422 (tint locked after all - stale camp data)
    // reverts to the server's own state. Only over this hero's own snapshot (final review I2).
    if (previous) replaceCamp(profile.id, { ...previous, dragon: { ...previous.dragon, tint: t } });
    try {
      await worldApi.patchDragon(profile.id, { tint: t });
      unlockAudio();
      playSfx('chime');
    } catch (e) {
      if (previous) replaceCamp(profile.id, previous);
      tintError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      savingTint = null;
    }
  }
</script>

<div class="panel-care">
  {#if !camp}
    {#if campStore.error && !campStore.loading}
      <p class="kit-note" data-tone="eris">Impossible de rejoindre ton dragon{'\u202f: '}{campStore.error}</p>
    {:else}
      <p class="muted">Les Muses cherchent ton dragon…</p>
    {/if}
  {:else if dragon}
    <section class="name-section">
      {#if dragon.stage === 'egg'}
        <p class="muted">Tu lui donneras un nom quand il éclora.</p>
      {:else}
        <div class="name-form">
          <span class="name-banner">
            <input
              class="name-field"
              data-testid="dragon-name-input"
              aria-label="Le nom de ton dragon"
              placeholder="Écris son nom…"
              maxlength="20"
              lang="fr"
              autocapitalize="words"
              bind:value={nameInput}
            />
          </span>
          <button type="button" class="kit-bronze" data-testid="dragon-name-save" disabled={savingName} onclick={saveName}>
            Garder ce nom
          </button>
        </div>
        {#if nameError}<p class="kit-note" data-tone="eris" role="alert">{nameError}</p>{/if}
        {#if toast.message}<p class="kit-note" role="status">{toast.message}</p>{/if}
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
            {#if !unlocked}<span class="sr-only"> (à gagner dans les quêtes de l'Oracle)</span>{/if}
          </button>
        {/each}
      </div>
      {#if TINTS_ALL.some((t) => !isUnlocked(t))}
        <p class="tint-how" data-testid="dragon-tint-how">Les autres teintes se gagnent dans les quêtes de l'Oracle.</p>
      {/if}
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
  /* The name on a cloth ribbon under the dragon's plate, the forge's banner (HeroForm.svelte): the
     ribbon is the field. The cloth is the wrapper's ::before (its clip-path would also clip a focus
     ring drawn on the input), and the ring goes round the wrapper. */
  .name-form {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .name-banner {
    position: relative;
    isolation: isolate;
    display: block;
    width: 260px;
  }
  .name-banner::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(180deg, #a5532f, #7e3b20);
    clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 50%, 100% 100%, 0 100%, 14px 50%);
  }
  .name-banner:focus-within {
    outline: 3px solid var(--gold-light);
    outline-offset: 3px;
    border-radius: 4px;
  }
  /* Outranks `.kit-form input:not(...)` (the parchment field look) with the component's classes. */
  .panel-care .name-banner input.name-field {
    width: 100%;
    min-height: 48px;
    padding: 6px 28px;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    outline: none;
    color: var(--bronze-ink);
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 20px;
    text-align: center;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }
  .panel-care .name-banner input.name-field::placeholder {
    color: rgba(255, 240, 220, 0.72);
    font-style: italic;
  }
  /* Equal columns, so the six eggs stand in one even row (UI3b walk b13: a wrapping flex row left
     the unlocked pair huddled and the last egg alone on a second line). */
  .tints {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 16px 8px;
    align-items: start;
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
    font-size: 14px;
  }
  .tint-how {
    font-style: italic;
    color: var(--reward-ink);
    text-align: center;
  }
</style>
