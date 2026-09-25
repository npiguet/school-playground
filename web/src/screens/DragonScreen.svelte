<script lang="ts">
  // The dragon's own page: naming it once it hatches, picking an unlocked tint, and watching it
  // grow (spec §2, §3.6; plan Decision 11). Tints are known in advance (locked swatches show how
  // to unlock them, ethics: nothing is a gamble) and changing one is instant/optimistic.
  import TopBar from '../components/TopBar.svelte';
  import Dragon from '../components/Dragon.svelte';
  import Gauge from '../components/juice/Gauge.svelte';
  import { ART, MARK_ICONS } from '../lib/world/art';
  import { worldApi } from '../lib/world/api';
  import { campStore, refreshCamp, loadCatalog } from '../lib/world/campStore.svelte';
  import { stageLabel, TINT_FILTERS, TINT_NAMES, validName } from '../lib/world/dragon';
  import type { Tint } from '../lib/world/types';
  import { ApiError } from '../lib/api';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  $effect(() => {
    void refreshCamp(profile.id);
    void loadCatalog();
  });

  const dragon = $derived(campStore.data?.dragon ?? null);

  // `min(420, 55vw)` per the plan - computed here (`Dragon`'s `size` is a plain pixel number)
  // rather than passed as a CSS expression.
  let viewportWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 800);
  $effect(() => {
    function onResize() {
      viewportWidth = window.innerWidth;
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });
  const dragonSize = $derived(Math.min(420, viewportWidth * 0.55));

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
      showToast('C’est noté.');
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

  const gaugeMax = $derived(dragon ? (dragon.next_stage_at ?? Math.max(1, dragon.available)) : 1);
  const gaugeLabel = $derived(
    dragon?.next_stage_at !== null && dragon?.next_stage_at !== undefined
      ? `Prochaine étape : ${dragon.next_stage_at} technique(s) neutralisée(s)`
      : 'Étape finale atteinte',
  );
</script>

<TopBar {profile} title={dragon?.name ?? 'Ton dragon'} />

<div class="screen dragon-screen">
  <div class="scene" style="background-image:url({ART.scenes.camp})">
    {#if dragon}
      <div class="portrait">
        <Dragon stage={dragon.stage} tint={dragon.tint} size={dragonSize} mood="idle" name={dragon.name} />
      </div>
    {/if}
  </div>

  {#if !campStore.data}
    {#if campStore.error}
      <p class="orange">Impossible de rejoindre ton dragon : {campStore.error}</p>
    {:else}
      <p class="muted">Les Muses cherchent ton dragon…</p>
    {/if}
  {:else if dragon}
    <div class="stage-block">
      <span class="chip" data-testid="dragon-stage">{stageLabel(dragon.stage)}</span>
      <Gauge value={dragon.neutralised} max={gaugeMax} label={gaugeLabel} />
    </div>

    <section class="name-section">
      <h2>Nom</h2>
      {#if dragon.stage === 'egg'}
        <p class="muted">Tu lui donneras un nom quand il éclora.</p>
      {:else}
        <div class="name-form">
          <input
            data-testid="dragon-name-input"
            maxlength="20"
            lang="fr"
            autocapitalize="words"
            bind:value={nameInput}
          />
          <button type="button" class="btn btn-primary" data-testid="dragon-name-save" disabled={savingName} onclick={saveName}>
            Garder ce nom
          </button>
        </div>
        {#if nameError}<p class="orange" role="alert">{nameError}</p>{/if}
        {#if toast}<p class="toast" role="status">{toast}</p>{/if}
      {/if}
    </section>

    <section class="tint-section">
      <h2>Teinte</h2>
      {#if tintError}<p class="orange" role="alert">{tintError}</p>{/if}
      <div class="tints">
        {#each TINTS_ALL as t (t)}
          {@const unlocked = isUnlocked(t)}
          <button
            type="button"
            class="tint-swatch"
            data-testid="dragon-tint-{t}"
            disabled={!unlocked || savingTint !== null}
            title={unlocked ? undefined : 'À gagner : quête de l’Oracle'}
            class:selected={dragon.tint === t}
            class:locked={!unlocked}
            onclick={() => pickTint(t)}
          >
            <span class="swatch-circle" style={`filter: ${TINT_FILTERS[t]}`}>
              <img src={ART.dragon.egg} alt="" />
              {#if !unlocked}<span class="lock" aria-hidden="true"><img src={MARK_ICONS.lock} alt="" /></span>{/if}
            </span>
            <span class="swatch-name">{TINT_NAMES[t]}</span>
          </button>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .dragon-screen {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .scene {
    height: 34vh;
    min-height: 220px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .portrait {
    position: relative;
    z-index: 1;
  }
  .stage-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .chip {
    font-family: var(--font-display);
    font-weight: 600;
  }
  .name-section,
  .tint-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .name-form {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .name-form input {
    flex: 1;
    min-width: 180px;
    min-height: 48px;
    padding: 0 12px;
    border-radius: var(--radius);
    border: 1px solid var(--marble-dark);
    font-size: 16px;
  }
  .toast {
    color: var(--olive);
    font-weight: 600;
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
  .swatch-circle img {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
  .tint-swatch.selected .swatch-circle {
    border-color: var(--olive);
    box-shadow: 0 0 0 2px var(--olive-light);
  }
  .tint-swatch.locked .swatch-circle {
    filter: grayscale(1);
    opacity: 0.6;
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
</style>
