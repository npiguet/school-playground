<script lang="ts">
  // The muster (UI4 Task 2): what Play showed before the battle - the resume banner and the intro
  // (the dictation's pace choice, or the grimoire's opening) - moved as it was onto the battle
  // stage's parchment. Task 3 restyles it in the kit and gives Éris's `taunt` its voice plate.
  import PaceSelect from '../PaceSelect.svelte';
  import { api } from '../../lib/api';
  import { formatSwissDate, isProphecy } from '../../lib/dates';
  import { ttsAvailable } from '../../lib/dictation/tts';
  import type { Pace } from '../../lib/dictation/script';
  import type { PlayState } from '../../lib/playState';
  import { go } from '../../lib/scene/panelNav';
  import { href } from '../../lib/routes';
  import type { DialogueLine } from '../../lib/scene/types';
  import type { PlayMode, TextFull } from '../../lib/types';

  let {
    text,
    mode,
    playState = $bindable(),
    minPace,
    questId,
    encounter,
    resume,
    corrupting,
    corruptError,
    taunt,
    profileId,
    onContinue,
    onRestart,
    onStart,
    onOpenGrimoire,
    onToLibrary,
  }: {
    text: TextFull;
    mode: PlayMode;
    /** Bound for the pace choice. */
    playState: PlayState;
    minPace: Pace;
    questId: number | null;
    encounter: string | null;
    /** A saved dictation or proofreading waits: the resume banner instead of the intro. */
    resume: boolean;
    corrupting: boolean;
    corruptError: string | null;
    /** Éris's line at the muster (Ruling C7), rendered by Task 3. */
    taunt: DialogueLine | null;
    profileId: number;
    onContinue: () => void;
    onRestart: () => void;
    onStart: () => void;
    onOpenGrimoire: () => void;
    onToLibrary: () => void;
  } = $props();

  // Intro-only: never toggled during dictation/proofreading (the photo is the reference,
  // spec §3.2 - it must stay hidden while the child is writing).
  let showPhotos = $state(false);

  function credits(t: TextFull): string {
    if (t.credits) return t.credits;
    if (t.source === 'custom' && t.added_by_name) return `Ajouté par ${t.added_by_name}`;
    return '';
  }
</script>

<div class="muster">
  {#if resume}
    <div class="screen">
      <h2 class="title">{text.title}</h2>
      <div class="banner" data-testid="battle-resume">
        <p>Tu reprends là où tu t’étais arrêtée.</p>
        <div class="banner-actions">
          <button type="button" class="btn btn-primary" data-testid="battle-resume-continue" onclick={onContinue}>Continuer</button>
          <button type="button" class="btn" data-testid="battle-resume-restart" onclick={onRestart}>Recommencer</button>
        </div>
      </div>
    </div>
  {:else}
    <div class="screen">
      <h2 class="title">{mode === 'grimoire' ? 'Grimoire corrompu' : text.title}</h2>
      {#if credits(text)}<p class="credits muted">{credits(text)}</p>{/if}
      <div class="chips">
        <span class="chip">{text.level}</span>
        <span class="chip">≈ {text.word_count} mots</span>
      </div>

      {#if text.due_date && isProphecy(text.due_date)}
        <p class="prophecy" data-testid="play-prophecy">
          Dictée préparée pour le {formatSwissDate(text.due_date)} — la prophétie de l'Oracle.
        </p>
      {/if}

      {#if questId}
        <div class="parchment quest-banner" data-testid="play-quest-banner">
          <p>Ce texte compte pour ta quête.</p>
        </div>
      {/if}

      {#if encounter === 'eris'}
        <div class="eris-panel boss-banner" data-testid="play-boss-banner">
          <p>Combat contre Éris — les Yeux d'Argus restent éteints.</p>
        </div>
      {/if}

      {#if text.photo_count > 0}
        <button type="button" class="btn photos-toggle" onclick={() => (showPhotos = !showPhotos)}>
          {showPhotos ? 'Cacher la feuille' : 'Voir la feuille'}
        </button>
        {#if showPhotos}
          <div class="scan-photos">
            {#each Array.from({ length: text.photo_count }, (_, i) => i + 1) as n (n)}
              <img
                src={api.scan.pageUrl(text.scan_id ?? '', n)}
                alt={`Page ${n} de la feuille scannée`}
                class="scan-photo"
              />
            {/each}
          </div>
        {/if}
      {/if}

      {#if mode === 'grimoire'}
        <p>Éris a recopié ce parchemin en y semant ses dés-accords. Pas de dictée cette fois : retrouve-les et répare-les.</p>

        {#if corruptError}
          <p class="orange">{corruptError}</p>
          <button type="button" class="btn" data-testid="btn-back-library" onclick={onToLibrary}>Retour aux Parchemins</button>
        {:else if corrupting}
          <p class="muted">Éris corrompt le grimoire…</p>
        {:else}
          <button type="button" class="btn btn-primary" data-testid="btn-open-grimoire" onclick={onOpenGrimoire}>
            Ouvrir le grimoire
          </button>
        {/if}
      {:else}
        {#if !ttsAvailable()}
          <p class="orange">
            Cet appareil ne sait pas lire à voix haute. La dictée avancera toute seule, sans son.
          </p>
        {/if}

        <h3>Choisis ton rythme</h3>
        <PaceSelect bind:pace={playState.pace} {minPace} />
        <p class="muted">Les récompenses augmentent avec le rythme.</p>

        <button type="button" class="btn btn-primary" onclick={onStart}>
          Commencer la dictée
        </button>

        <button
          type="button"
          class="btn"
          data-testid="btn-grimoire"
          onclick={() => go(href('grimoire', { profileId: String(profileId), textId: String(text.id) }))}
        >
          Grimoire corrompu
        </button>
        <p class="muted">
          Éris a déjà recopié ce texte… avec ses dés-accords. Pas de dictée : relis et répare.
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  /* The parchment has a fixed height (the stage's); the muster scrolls inside it. */
  .muster {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .muster .screen {
    min-height: 0;
  }
  .title {
    margin-top: 0;
  }
  .chips {
    display: flex;
    gap: 8px;
    margin: 12px 0 20px;
  }
  .prophecy {
    color: var(--gold);
    font-weight: 600;
    margin: 0 0 16px;
  }
  .quest-banner,
  .boss-banner {
    padding: 12px 16px;
    margin: 0 0 16px;
  }
  .quest-banner p,
  .boss-banner p {
    margin: 0;
    font-weight: 600;
  }
  .photos-toggle {
    margin-bottom: 16px;
  }
  .scan-photos {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }
  .scan-photo {
    width: 100%;
    object-fit: contain;
    max-height: 70vh;
    border-radius: var(--radius);
    border: 1px solid var(--marble-dark);
    background: #fff;
  }
  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    background: var(--aegean-light);
    border: 1px solid var(--aegean);
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-bottom: 20px;
  }
  .banner p {
    margin: 0;
  }
  .banner-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  h3 {
    margin-top: 24px;
  }
</style>
