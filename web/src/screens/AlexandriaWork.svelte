<script lang="ts">
  // A single Alexandria work's scrolls ("rouleaux"): refresh the cache from the online
  // source (graceful on network failure, spec §5 SP2), filter by level, adopt a chunk
  // into Les Parchemins. Credits (author/translator/work) stay visible at all times —
  // the spec requires public-domain attribution wherever an adopted text is offered.
  import { onDestroy } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import { api, ApiError, isTimeout } from '../lib/api';
  import { LEVELS } from '../lib/levels';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import Icon from '../components/ui/Icon.svelte';
  import type { AlexandriaChunk, AlexandriaWork, Profile } from '../lib/types';

  let { profile, workId }: { profile: Profile; workId: string } = $props();

  let work = $state<AlexandriaWork | null>(null);
  let workLoading = $state(true);
  let workError = $state('');

  async function loadWork() {
    workLoading = true;
    workError = '';
    try {
      const all = await api.alexandria.works();
      const found = all.find((w) => w.id === workId) ?? null;
      work = found;
      if (!found) workError = 'Œuvre inconnue.';
    } catch (e) {
      workError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      workLoading = false;
    }
  }

  let chunks = $state<AlexandriaChunk[]>([]);
  let chunksLoading = $state(true);
  let chunksError = $state('');
  let levelFilter = $state('Tous');

  async function loadChunks() {
    chunksLoading = true;
    chunksError = '';
    try {
      chunks = await api.alexandria.chunks(workId, levelFilter === 'Tous' ? undefined : levelFilter);
    } catch (e) {
      chunksError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      chunksLoading = false;
    }
  }

  function selectLevel(l: string) {
    levelFilter = l;
    loadChunks();
  }

  loadWork();
  loadChunks();

  // A refresh can take a minute, and the player may leave meanwhile (adopt a cached scroll and
  // "Jouer maintenant", or go back): once this screen is gone its `workId` prop reads undefined,
  // so the reload at the end of that refresh must not run (it used to GET
  // /api/alexandria/works/undefined/chunks, a 404, found by the fix-round-4 e2e stress run).
  let destroyed = false;
  onDestroy(() => {
    destroyed = true;
  });

  // --- Refresh from the online source ---------------------------------------------------
  let refreshing = $state(false);
  let refreshNote = $state<{ kind: 'error' | 'olive'; message: string } | null>(null);

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    refreshNote = null;
    try {
      const result = await api.alexandria.refresh(workId);
      if (result.status === 'error') {
        refreshNote = {
          kind: 'error',
          message: `La Bibliothèque d'Alexandrie est hors d'atteinte pour le moment. ${result.error} Les rouleaux déjà recopiés restent disponibles.`,
        };
      } else if (result.error) {
        refreshNote = { kind: 'olive', message: result.error };
      }
    } catch (e) {
      // The endpoint contracts to never throw on a network failure, but we stay
      // graceful regardless: no exception should ever surface to the player. The request
      // itself is bounded (REFRESH_TIMEOUT_MS) so a stalled source can't spin forever.
      const detail = e instanceof ApiError
        ? e.detail
        : isTimeout(e)
          ? 'Les scribes mettent trop de temps à répondre.'
          : '';
      refreshNote = {
        kind: 'error',
        message: `La Bibliothèque d'Alexandrie est hors d'atteinte pour le moment. ${detail} Les rouleaux déjà recopiés restent disponibles.`,
      };
    } finally {
      refreshing = false;
      if (!destroyed) await Promise.all([loadWork(), loadChunks()]);
    }
  }

  // --- Adopt a chunk into Les Parchemins --------------------------------------------------
  let adoptingId = $state<number | null>(null);
  let adoptErrorChunkId = $state<number | null>(null);
  let adoptError = $state('');
  let confirmation = $state<{ chunkId: number; textId: number } | null>(null);

  async function adopt(chunk: AlexandriaChunk) {
    if (adoptingId !== null) return;
    adoptingId = chunk.id;
    adoptError = '';
    adoptErrorChunkId = null;
    try {
      const full = await api.alexandria.adopt(chunk.id, { profile_id: profile.id });
      chunk.text_id = full.id;
      confirmation = { chunkId: chunk.id, textId: full.id };
    } catch (e) {
      adoptError = e instanceof ApiError ? e.detail : "Les Muses n'ont pas pu ajouter ce rouleau.";
      adoptErrorChunkId = chunk.id;
    } finally {
      adoptingId = null;
    }
  }

  function playNow(textId: number) {
    navigate(href('play', { profileId: String(profile.id), textId: String(textId) }));
  }

  function dismissConfirmation() {
    confirmation = null;
  }

  function starsFor(score: number): number {
    return Math.min(5, Math.max(1, Math.round(score / 8)));
  }
</script>

<TopBar {profile} title="Bibliothèque d'Alexandrie" />

<div class="screen">
  {#if workLoading}
    <p class="muted">Les Muses cherchent les scribes…</p>
  {:else if workError}
    <p class="orange">{workError}</p>
  {:else if work}
    <div class="header">
      <h2>{work.title}</h2>
      <p class="credits">{work.credits}</p>
      <p class="muted domain-note">Les traducteurs et auteurs sont dans le domaine public.</p>

      <button
        type="button"
        class="btn btn-primary"
        data-testid="btn-refresh-work"
        disabled={refreshing}
        onclick={refresh}
      >
        {work.status === 'ok' ? 'Recopier à nouveau' : 'Recopier depuis la Bibliothèque'}
      </button>
      {#if refreshing}
        <p class="muted" aria-live="polite">Les scribes recopient… (cela peut prendre une minute)</p>
      {/if}

      {#if refreshNote?.kind === 'error'}
        <div class="banner-error" data-testid="alexandria-error">{refreshNote.message}</div>
      {:else if refreshNote?.kind === 'olive'}
        <div class="banner-olive">{refreshNote.message}</div>
      {/if}
    </div>

    <div class="filters">
      <button
        type="button"
        class="chip"
        class:chip-active={levelFilter === 'Tous'}
        onclick={() => selectLevel('Tous')}
      >
        Tous
      </button>
      {#each LEVELS as l (l)}
        <button
          type="button"
          class="chip"
          class:chip-active={levelFilter === l}
          onclick={() => selectLevel(l)}
        >
          {l}
        </button>
      {/each}
    </div>

    {#if chunksLoading}
      <p class="muted">Les Muses déroulent les rouleaux…</p>
    {:else if chunksError}
      <p class="orange">Impossible de lire les rouleaux : {chunksError}</p>
    {:else if chunks.length === 0}
      {#if work.status === 'ok'}
        <p class="muted">
          Les scribes n'ont trouvé aucun passage assez propre dans cette œuvre (dialogues, vers,
          vieux français…).
        </p>
      {:else}
        <p class="muted">Aucun rouleau pour le moment.</p>
      {/if}
    {:else}
      <div class="grid">
        {#each chunks as chunk (chunk.id)}
          <div class="card chunk-card" data-testid="chunk-card">
            <div class="chunk-head">
              <span class="seq">Rouleau {chunk.seq}</span>
              <span class="chip">{chunk.level}</span>
              <span class="muted">≈ {chunk.word_count} mots</span>
              <span
                class="stars"
                role="img"
                aria-label="Richesse en accords : {starsFor(chunk.score)} sur 5"
                title="Richesse en accords : {starsFor(chunk.score)} sur 5"
                >{#each Array.from({ length: starsFor(chunk.score) }, (_, i) => i) as i (i)}<Icon name="star" size={16} />{/each}</span
              >
            </div>
            <p class="preview">{chunk.preview}</p>

            {#if confirmation && confirmation.chunkId === chunk.id}
              <div class="confirm">
                <p>Rouleau ajouté aux Parchemins.</p>
                <div class="confirm-actions">
                  <button
                    type="button"
                    class="btn btn-primary"
                    data-testid="btn-adopt-play"
                    onclick={() => playNow(confirmation!.textId)}
                  >
                    Jouer maintenant
                  </button>
                  <button type="button" class="btn" onclick={dismissConfirmation}>
                    Continuer à fouiller
                  </button>
                </div>
              </div>
            {:else if chunk.text_id !== null}
              <div class="already">
                <span class="muted">Déjà dans les Parchemins</span>
                <a
                  class="btn"
                  href={href('play', { profileId: String(profile.id), textId: String(chunk.text_id) })}
                  >Jouer</a
                >
              </div>
            {:else}
              <button
                type="button"
                class="btn btn-primary"
                data-testid="btn-adopt"
                disabled={adoptingId === chunk.id}
                onclick={() => adopt(chunk)}
              >
                Ajouter aux Parchemins
              </button>
              {#if adoptErrorChunkId === chunk.id}
                <p class="orange adopt-error">{adoptError}</p>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .header {
    margin-bottom: 16px;
  }
  .header h2 {
    margin-bottom: 4px;
  }
  .credits {
    font-weight: 600;
    margin: 0 0 2px;
  }
  .domain-note {
    font-size: 14px;
    margin: 0 0 14px;
  }
  .banner-olive {
    background: #eaeedc;
    border: 1px solid var(--olive);
    border-radius: var(--radius);
    padding: 12px 16px;
    color: var(--ink);
    margin-top: 12px;
  }
  .banner-error {
    background: var(--orange-light);
    border: 1px solid var(--orange);
    border-radius: var(--radius);
    padding: 12px 16px;
    margin-top: 12px;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
  }
  .filters .chip {
    min-height: 48px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 16px;
  }
  .chunk-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chunk-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }
  .seq {
    font-family: var(--font-display);
  }
  .chunk-head .chip {
    cursor: default;
    min-height: unset;
    padding: 3px 10px;
    font-size: 13px;
  }
  .stars {
    color: var(--gold);
    letter-spacing: 1px;
    margin-left: auto;
  }
  .preview {
    font-style: italic;
    color: var(--ink-soft);
    margin: 0;
  }
  .already {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .confirm {
    background: var(--aegean-light);
    border: 1px solid var(--aegean);
    border-radius: var(--radius);
    padding: 10px 12px;
  }
  .confirm p {
    margin: 0 0 8px;
    font-weight: 600;
  }
  .confirm-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .adopt-error {
    margin: 0;
  }
</style>
