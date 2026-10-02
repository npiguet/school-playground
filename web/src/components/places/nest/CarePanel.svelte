<script lang="ts">
  // The dragon's care (UI3 Ruling B5, was DragonScreen): naming it once it hatches and picking an
  // unlocked tint (spec §2, §3.6; plan Decision 11). The nest itself shows the dragon, its stage and
  // its growth; the dragon speaks from the overlay's voice plate (it asks for its name, so no « Son
  // nom » heading). UI3b playability #4: she writes the name on a painted ribbon, as she wrote her own
  // on the forge's banner (HeroForm.svelte), not in a « label + field + submit » form. Tints are known
  // in advance (the locked ones say once, under the row, how to win them; ethics: nothing is a
  // gamble) and changing one is instant/optimistic. And its parure: one owned piece or nothing per slot
  // (spec 2026-09-29 drachmes §4, R20), optimistic like the tints.
  import { ART, MARK_ICONS } from '../../../lib/world/art';
  import { SLOTS, SLOT_NAMES, accessoryPicture, wears, wornAfter } from '../../../lib/world/accessories';
  import { worldApi } from '../../../lib/world/api';
  import { tick, untrack } from 'svelte';
  import { campFor, campStore, refreshCamp, replaceCamp } from '../../../lib/world/campStore.svelte';
  import { useToast } from '../../../lib/ui/toast.svelte';
  import { LOCKED_EGG_FILTER, TINT_NAMES, validName } from '../../../lib/world/dragon';
  import { tintedDragon } from '../../../lib/living/stillTint';
  import type { RewardOut, Slot, Tint } from '../../../lib/world/types';
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

  // The pieces owned, fetched once per hero (R20); the worn ones come with the camp (`dragon.worn`).
  // A failed load never guesses « nothing owned » (it would send to Hermès a hero who owns a collar,
  // and hide the piece worn): the rows wait, the error says why, « Réessayer » asks again (as the stall).
  let owned = $state<RewardOut[] | null>(null);
  let ownedError = $state('');
  let parureRows = $state<HTMLElement | undefined>();
  async function loadOwned(id: number) {
    try {
      const list = await worldApi.rewards(id);
      if (id === profile.id) owned = list;
    } catch (e) {
      if (id === profile.id) ownedError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    }
  }
  // The button is gone once pressed: the focus goes to « Réessayer » again if it still fails, else to
  // the first slot's « Rien », never to the page.
  async function retryOwned() {
    ownedError = '';
    await loadOwned(profile.id);
    await tick();
    parureRows?.querySelector<HTMLElement>('[data-testid="parure-retry"], [role="radio"]')?.focus();
  }
  $effect(() => {
    const id = profile.id;
    owned = null;
    ownedError = '';
    void loadOwned(id);
  });
  const itemOf = (id: string) => id.slice('accessory:'.length);
  const piecesIn = (slot: Slot) => (owned ?? []).filter((r) => r.kind === 'accessory' && itemOf(r.id).endsWith(`-${slot}`));
  const wornIn = (slot: Slot) => dragon?.worn.find((w) => w.endsWith(`-${slot}`)) ?? null;
  const ownsAny = $derived((owned ?? []).some((r) => r.kind === 'accessory'));

  let parureError = $state('');
  let savingSlot = $state<Slot | null>(null);

  async function wear(slot: Slot, item: string | null) {
    if (!dragon || wornIn(slot) === item) return;
    const previous = camp;
    const current = wornIn(slot);
    parureError = '';
    savingSlot = slot;
    // Optimistic, like the tints: a refusal (stale camp) reverts to the server's own state.
    if (previous) replaceCamp(profile.id, { ...previous, dragon: { ...previous.dragon, worn: wornAfter(previous.dragon.worn, slot, item) } });
    try {
      if (item) await worldApi.patchReward(profile.id, `accessory:${item}`, true);
      else if (current) await worldApi.patchReward(profile.id, `accessory:${current}`, false);
      unlockAudio();
      playSfx('chime');
    } catch (e) {
      if (previous) replaceCamp(profile.id, previous);
      parureError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      savingSlot = null;
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
            <!-- The tint (or the locked grey) is on the egg only: the ring and the lock keep
                 their own colours (fix round 1). -->
            <span class="swatch-circle">
              <img
                class="swatch-egg"
                use:tintedDragon={{ src: ART.dragon.egg, tint: unlocked ? t : 'bronze' }}
                alt=""
                style:filter={unlocked ? null : LOCKED_EGG_FILTER}
              />
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

    <section class="parure-section" data-testid="dragon-parure" bind:this={parureRows}>
      <h3 class="kit-section">Sa parure</h3>
      {#if !wears(dragon.stage)}<p class="parure-note">Il portera sa parure dès qu'il sera un jeune dragon.</p>{/if}
      {#if parureError}<p class="kit-note" data-tone="eris" role="alert">{parureError}</p>{/if}
      {#if ownedError}
        <p class="kit-note" data-tone="eris" role="alert" data-testid="parure-error">{ownedError}</p>
        <button type="button" class="kit-bronze is-quiet parure-retry" data-testid="parure-retry" onclick={retryOwned}>Réessayer</button>
      {/if}
      {#each owned ? SLOTS : [] as slot (slot)}
        <div class="parure-slot" role="radiogroup" aria-label={SLOT_NAMES[slot]} data-testid="parure-{slot}">
          <span class="parure-slot-name">{SLOT_NAMES[slot]}</span>
          <div class="parure-choices">
            <button
              type="button"
              role="radio"
              class="parure-choice"
              aria-checked={wornIn(slot) === null}
              data-testid="parure-{slot}-rien"
              disabled={savingSlot !== null}
              onclick={() => wear(slot, null)}
            >
              <span class="parure-none" aria-hidden="true"></span><span>Rien</span>
            </button>
            {#each piecesIn(slot) as r (r.id)}
              <button
                type="button"
                role="radio"
                class="parure-choice"
                aria-checked={wornIn(slot) === itemOf(r.id)}
                data-testid="parure-{itemOf(r.id)}"
                disabled={savingSlot !== null}
                onclick={() => wear(slot, itemOf(r.id))}
              >
                <img src={accessoryPicture(itemOf(r.id), dragon.stage) ?? ''} alt="" draggable="false" /><span>{r.name}</span>
              </button>
            {/each}
          </div>
        </div>
      {/each}
      {#if owned && !ownsAny}<p class="parure-how" data-testid="dragon-parure-how">Hermès vend des parures à son étal, dans le camp.</p>{/if}
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
  .tint-section,
  .parure-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  /* The section's flex gap spaces its lines; a paragraph's own margins would double it. */
  .name-section > p,
  .tint-section > p,
  .parure-section > p {
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
  /* « Sa parure » (R20): one row per slot, « Rien » and the owned pieces as radio buttons. */
  .parure-slot {
    display: grid;
    grid-template-columns: 110px 1fr;
    align-items: center;
    gap: 10px;
  }
  .parure-choices {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .parure-choice {
    appearance: none;
    background: transparent;
    border: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 72px;
    min-height: 48px;
    padding: 4px;
    font-size: 14px;
    cursor: pointer;
  }
  .parure-choice:disabled {
    cursor: default;
  }
  .parure-choice img,
  .parure-none {
    width: 56px;
    height: 56px;
    object-fit: contain;
  }
  .parure-none {
    display: block;
    border: 2px dashed var(--ink-soft);
    border-radius: 8px;
    box-sizing: border-box;
  }
  .parure-choice[aria-checked='true'] img,
  .parure-choice[aria-checked='true'] .parure-none {
    /* The tint swatch's selected look (olive, then a light ring): olive-light alone fades on parchment. */
    box-shadow:
      0 0 0 2px var(--olive),
      0 0 0 4px var(--olive-light);
    border-radius: 8px;
  }
  .parure-note,
  .parure-how {
    font-style: italic;
    color: var(--reward-ink);
  }
  .parure-retry {
    align-self: flex-start;
  }
</style>
