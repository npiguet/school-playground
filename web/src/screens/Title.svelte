<script lang="ts">
  // The title scene (scenes UI spec §3, UI3 Ruling A4): the camp gates at dusk, Éris's shadow in
  // the sky. « Entrer » (once per page load) unlocks audio and asks for tilt inside the tap, then
  // opens the gate onto the heroes' painted shields. A new hero is named in an overlay on
  // #/profiles/new; every hero is listed on #/?panel=tous. Replaces ProfilePicker/ProfileCreate.
  import { fade } from 'svelte/transition';
  import SceneStage from '../components/scene/SceneStage.svelte';
  import Hotspot from '../components/scene/Hotspot.svelte';
  import Overlay from '../components/scene/Overlay.svelte';
  import Avatar from '../components/Avatar.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import HeroForm from '../components/places/title/HeroForm.svelte';
  import { SHIELD_SLOTS, TITLE_HOTSPOTS, TITLE_SCENE, titleShields } from '../lib/world/scenes/title';
  import { titleGate } from '../lib/scene/titleGate.svelte';
  import { requestTilt } from '../lib/scene/tiltState.svelte';
  import { closePanel, go } from '../lib/scene/panelNav';
  import { playSfx, unlockAudio } from '../lib/juice/sfx';
  import { api, ApiError } from '../lib/api';
  import { href } from '../lib/routes';
  import { OVERLAY_TITLES, type PanelId } from '../lib/world/places';
  import { VOICES } from '../lib/world/voices';
  import type { Profile } from '../lib/types';

  let { panel }: { panel: PanelId | null } = $props();

  let profiles = $state<Profile[]>([]);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      profiles = await api.profiles.list();
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }
  load();

  const gate = TITLE_HOTSPOTS[0];
  const shields = $derived(titleShields(profiles));
  const byName = $derived([...profiles].sort((a, b) => a.name.localeCompare(b.name, 'fr')));

  // Inside the tap itself (iOS grants audio and the tilt permission only in a user gesture).
  function gesture() {
    unlockAudio();
    void requestTilt();
  }

  function enter() {
    playSfx('chime');
    titleGate.entered = true;
  }

  const pick = (p: Profile) => go(href('camp', { profileId: String(p.id) }));
  const openNew = () => go(href('profile-new'), 'panel');
  const openAll = () => go(href('profiles', {}, { panel: 'tous' }), 'panel');

  const closeToTitle = () => closePanel(href('profiles'));
</script>

<SceneStage scene={TITLE_SCENE}>
  {#if !titleGate.entered}
    <Hotspot def={gate} status={gate.state({ camp: null, catalog: null })} sceneId="title" onPress={gesture} onActivate={enter} />
  {:else}
    <div class="shields" role="group" aria-label="Choisis ton bouclier" data-testid="title-shields" in:fade={{ duration: 300 }}>
      {#each shields as s, i (s.kind === 'hero' ? s.profile.id : s.kind)}
        {@const slot = SHIELD_SLOTS[i]}
        {#if s.kind === 'hero'}
          <button
            type="button"
            class="shield"
            data-testid="title-hero-{s.profile.id}"
            style="left:{slot.x}%;top:{slot.y}%"
            aria-label="{s.profile.name}, {s.profile.level}"
            onclick={() => pick(s.profile)}
          >
            <span class="shield-ring" aria-hidden="true"></span>
            <span class="shield-face"><Avatar avatar={s.profile.avatar} size={44} ring /></span>
            <span class="shield-plaque stage-text">
              <span class="shield-name">{s.profile.name}</span>
              <span class="shield-level">{s.profile.level}</span>
            </span>
          </button>
        {:else if s.kind === 'all'}
          <button type="button" class="shield" data-testid="title-all" style="left:{slot.x}%;top:{slot.y}%" aria-label="Tous les héros ({s.count})" onclick={openAll}>
            <span class="shield-ring" aria-hidden="true"></span>
            <span class="shield-face"><span class="shield-count">{s.count}</span></span>
            <span class="shield-plaque stage-text"><span class="shield-name">Tous les héros</span></span>
          </button>
        {:else}
          <button type="button" class="shield" data-testid="title-new" style="left:{slot.x}%;top:{slot.y}%" aria-label="Nouveau héros" onclick={openNew}>
            <span class="shield-ring" aria-hidden="true"></span>
            <span class="shield-face is-blank"><Icon name="plus" size={30} /></span>
            <span class="shield-plaque stage-text"><span class="shield-name">Nouveau héros</span></span>
          </button>
        {/if}
      {/each}
    </div>
    {#if loading}
      <p class="kit-ribbon title-note stage-text">Les Muses cherchent les héros…</p>
    {:else if error}
      <!-- Final review M16: the server's message wraps inside the art box, and the heroes can be
           fetched again without a reload (the camp's own « Réessayer »). -->
      <div class="kit-ribbon title-note title-error stage-text" role="alert" data-testid="title-error">
        <span>Impossible de charger les héros : {error}</span>
        <button type="button" class="kit-bronze" data-testid="title-retry" onclick={load}>Réessayer</button>
      </div>
    {:else}
      <p class="kit-ribbon title-note stage-text" data-testid="title-hint">
        {profiles.length === 0 ? 'Accroche ton bouclier à la porte du camp.' : 'Choisis ton bouclier'}
      </p>
    {/if}
  {/if}
</SceneStage>

{#if panel === 'nouveau'}
  <Overlay
    variant="scroll"
    size="wide"
    title={OVERLAY_TITLES.nouveau}
    testId="overlay-hero-new"
    voice={VOICES.ritual}
    onClose={closeToTitle}
    returnFocus={'[data-testid="title-new"]'}
  >
    <HeroForm />
  </Overlay>
{:else if panel === 'tous'}
  <Overlay variant="scroll" title={OVERLAY_TITLES.tous} testId="overlay-heroes" onClose={closeToTitle} returnFocus={'[data-testid="title-all"]'}>
    <ul class="hero-list">
      {#each byName as p (p.id)}
        <li>
          <button type="button" class="hero-row" aria-label="{p.name}, {p.level}" onclick={() => pick(p)}>
            <Avatar avatar={p.avatar} size={44} ring />
            <span class="hero-row-name">{p.name}</span>
            <span class="hero-row-level">{p.level}</span>
          </button>
        </li>
      {/each}
    </ul>
  </Overlay>
{/if}

<style>
  .shields {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
  }
  .shield {
    position: absolute;
    transform: translateX(-50%);
    width: 5.5%;
    min-width: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--bronze-ink);
    cursor: pointer;
    pointer-events: auto;
  }
  /* Playability #13: the ring sits on the painted hook (the slot's y is the hook's tip). */
  .shield-ring {
    width: 14px;
    height: 14px;
    margin-bottom: -4px;
    border-radius: 50%;
    border: 3px solid var(--bronze-light);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  /* A painted bronze shield hanging from its hook, the hero's emblem at its boss. */
  .shield-face {
    width: 78%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: 3px solid var(--bronze-dark);
    background: radial-gradient(circle at 38% 32%, var(--bronze-light), var(--bronze) 58%, var(--bronze-dark));
    box-shadow:
      inset 0 0 0 4px rgba(255, 240, 200, 0.25),
      0 4px 10px rgba(0, 0, 0, 0.45);
  }
  /* The new-hero shield is a blank shield to forge, not a coin (playability #13). */
  .shield-face.is-blank {
    background: radial-gradient(circle, rgba(243, 230, 200, 0.28), rgba(243, 230, 200, 0.12) 70%);
    border: 3px dashed var(--bronze-light);
    color: var(--gold-light);
    box-shadow: inset 0 0 14px rgba(0, 0, 0, 0.35);
  }
  .shield:hover .shield-face {
    filter: brightness(1.1);
  }
  .shield:focus-visible {
    outline: none;
  }
  .shield:focus-visible .shield-face {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .shield-plaque {
    max-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid var(--bronze-light);
    background: rgba(21, 18, 26, 0.72);
  }
  /* Fix round 1 #5: two lines (line-clamp), not a one-line ellipsis - similar first names (e.g.
     two "Alexandre"s with different avatars) stayed indistinguishable at ~8-9 visible characters.
     B2 fix round 1 #1: 2 lines at 14px still cut a realistic name (« Anne-Charlotte » showed as
     « Anne-Charlott… »). Up to 3 lines at a smaller size, breaking at the hyphen or, failing that,
     anywhere, so a real name is never truncated; the line-clamp/ellipsis stay only as a fallback
     for a name so long no reasonable size would fit it. */
  .shield-name {
    max-width: 100%;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    overflow: hidden;
    text-overflow: ellipsis;
    overflow-wrap: anywhere;
    white-space: normal;
    text-align: center;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 11px;
    line-height: 1.15;
  }
  .shield-level {
    font-size: 12px;
  }
  .shield-count {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 22px;
  }
  .title-note {
    position: absolute;
    left: 50%;
    bottom: 8%;
    transform: translateX(-50%);
    z-index: 3;
    margin: 0;
    /* max-content up to 70 % of the art box: `left: 50%` alone would cap the shrink-to-fit width
       at the remaining half. */
    width: max-content;
    max-width: 70%;
    white-space: normal;
    text-align: center;
  }
  .title-error {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .title-error span {
    flex: 1;
  }
  .hero-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
  }
  .hero-row {
    width: 100%;
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border: 1px solid var(--parchment-edge);
    border-radius: 10px;
    background: rgba(255, 250, 238, 0.55);
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }
  .hero-row-name {
    flex: 1;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hero-row-level {
    font-size: 14px;
    color: var(--form-ink-soft);
  }
</style>
