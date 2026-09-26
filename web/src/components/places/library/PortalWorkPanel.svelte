<script lang="ts">
  // A single Alexandria work's scrolls ("rouleaux"): refresh the cache from the online
  // source (graceful on network failure, spec §5 SP2), filter by level, adopt a chunk
  // into « Tes parchemins ». The author and translator stay visible at all times: that is the
  // attribution wherever an adopted text is offered (the public-domain note itself lives in
  // ASSETS-LICENSES.md, immersion wave Ruling W9).
  // UI3a Task 11: opened as an overlay of the library tent (panel 'oeuvre') rather than a full
  // screen; « Toutes les œuvres » steps back to the portal overlay.
  // Immersion wave Task 10 (playability #7): an open codex - the work and its scribes on the left
  // page, its scrolls on the right; a never-copied work points at the button that asks for a copy.
  // UI3b playability #19: the owl speaks on the left page, between the title and that button (the
  // voice sits under the title on every spread), and the right page shows the view through the portal.
  import { onDestroy, untrack } from 'svelte';
  import { api, ApiError, isTimeout } from '../../../lib/api';
  import { LEVELS } from '../../../lib/levels';
  import { href } from '../../../lib/routes';
  import { closePanel, go } from '../../../lib/scene/panelNav';
  import Icon from '../../ui/Icon.svelte';
  import LevelMedallions from '../../ui/LevelMedallions.svelte';
  import { lengthOf, workByline } from '../../../lib/library/shelf';
  import OverlayVoice from '../../scene/OverlayVoice.svelte';
  import { ART } from '../../../lib/world/art';
  import { VOICES } from '../../../lib/world/voices';
  import type { AlexandriaChunk, AlexandriaWork, Profile } from '../../../lib/types';

  let { profile, workId }: { profile: Profile; workId: string } = $props();

  // Fix round 1 #2: LibraryTent.svelte `{#key}`s this panel by workId, so a fresh instance mounts
  // per work - `workId` itself only ever needs to be read once. Captured explicitly rather than
  // read live off the reactive prop: `workId` is still bound to `params.workId` while this instance
  // fades out (Overlay's local `out:leave`, e.g. closing back onto the portal), and a refresh
  // settling during that window must keep working with the work it was started for, not whatever
  // the route now says (which could already be a different work, or none).
  const id = untrack(() => workId);

  let work = $state<AlexandriaWork | null>(null);
  let workLoading = $state(true);
  let workError = $state('');

  async function loadWork() {
    workLoading = true;
    workError = '';
    try {
      const all = await api.alexandria.works();
      const found = all.find((w) => w.id === id) ?? null;
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
  // Playability #7: the filter filters something - hidden while there is nothing to filter.
  const showFilter = $derived(chunks.length > 0 || levelFilter !== 'Tous');
  // A work the scribes never copied: the owl asks her to ask them.
  const neverCopied = $derived(
    work !== null && work.status !== 'ok' && !chunksLoading && !chunksError && chunks.length === 0 && levelFilter === 'Tous',
  );

  // Final review M17: two quick level taps start two requests that can settle out of order; only
  // the latest one may fill the list (same generation token as refreshCamp).
  let chunksRequest = 0;

  async function loadChunks() {
    const request = ++chunksRequest;
    chunksLoading = true;
    chunksError = '';
    try {
      const result = await api.alexandria.chunks(id, levelFilter === 'Tous' ? undefined : levelFilter);
      if (request === chunksRequest) chunks = result;
    } catch (e) {
      if (request === chunksRequest) chunksError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      if (request === chunksRequest) chunksLoading = false;
    }
  }

  function selectLevel(l: string) {
    levelFilter = l;
    loadChunks();
  }

  loadWork();
  loadChunks();

  // A refresh can take a minute, and the player may leave meanwhile (adopt a cached scroll and
  // "Jouer maintenant", or go back): once this panel is gone, the reload at the end of that refresh
  // must not run (it used to GET /api/alexandria/works/undefined/chunks, a 404, found by the
  // fix-round-4 e2e stress run, back when this was a full screen keyed off the route directly).
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
      const result = await api.alexandria.refresh(id);
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

  // --- Adopt a chunk into « Tes parchemins » --------------------------------------------
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
    go(href('play', { profileId: String(profile.id), textId: String(textId) }));
  }

  // « Toutes les œuvres »: steps back one overlay, onto the works (final review M9).
  function toWorks() {
    closePanel(href('alexandria', { profileId: String(profile.id) }));
  }

  function dismissConfirmation() {
    confirmation = null;
  }

  function starsFor(score: number): number {
    return Math.min(5, Math.max(1, Math.round(score / 8)));
  }
</script>

<div class="codex-spread panel-portal-work">
  <section class="codex-page page-left">
    <button
      type="button"
      class="kit-bronze is-quiet portal-back"
      data-testid="portal-back"
      onclick={toWorks}
    >
      <Icon name="arrow-left" size={18} /> Toutes les œuvres
    </button>
    {#if workLoading}
      <p class="muted">Les Muses cherchent les scribes…</p>
    {:else if workError}
      <p class="kit-note" data-tone="eris">{workError}</p>
    {:else if work}
      <!-- Fix round 1 #5: an h3, not an h2 - this sits under the Overlay's own h2 title. -->
      <h3 class="work-title">{work.title}</h3>
      <p class="work-by">{workByline(work)}</p>
      {#if neverCopied}
        <OverlayVoice line={VOICES.scribesEmpty} testId="scribes-empty" />
      {/if}
      <button type="button" class="kit-bronze" data-testid="btn-refresh-work" disabled={refreshing} onclick={refresh}>
        {work.status === 'ok' ? 'Demander une nouvelle copie' : 'Demander aux scribes'}
      </button>
      {#if refreshing}
        <p class="muted" aria-live="polite">Les scribes recopient… (cela peut prendre une minute)</p>
      {/if}
      {#if refreshNote?.kind === 'error'}
        <p class="kit-note" data-tone="eris" data-testid="alexandria-error">{refreshNote.message}</p>
      {:else if refreshNote?.kind === 'olive'}
        <p class="kit-note">{refreshNote.message}</p>
      {/if}
    {/if}
  </section>

  <section class="codex-page page-right">
    {#if work}
      {#if showFilter}
        <LevelMedallions
          legend="Quelle classe{'\u202f?'}"
          name="work-level"
          options={['Tous', ...LEVELS]}
          bind:value={levelFilter}
          onchange={(l) => selectLevel(l)}
          testId="work-levels"
        />
      {/if}
      {#if chunksLoading}
        <p class="muted">Les Muses déroulent les rouleaux…</p>
      {:else if chunksError}
        <p class="kit-note" data-tone="eris">Impossible de lire les rouleaux{'\u202f: '}{chunksError}</p>
      {:else if chunks.length === 0}
        {#if levelFilter !== 'Tous'}
          <p class="muted">Aucun rouleau pour cette classe.</p>
        {:else if work.status === 'ok'}
          <p class="muted">
            Les scribes n'ont trouvé aucun passage assez propre dans ce livre (dialogues, vers, vieux
            français…).
          </p>
        {:else}
          <!-- Playability #7, re-review N11: the view through the portal, so the page isn't bare (the
               owl speaks on the left page, by the button, UI3b playability #19). -->
          <figure class="plate"><img src={ART.scenes.alexandrie} alt="" /></figure>
        {/if}
      {:else}
        <ol class="rolls">
          {#each chunks as chunk (chunk.id)}
            <li class="roll-entry" data-testid="chunk-card">
              <div class="roll-head">
                <span class="seq">Rouleau {chunk.seq}</span>
                <span class="kit-medallion is-small" role="img" aria-label="Classe {chunk.level}">{chunk.level}</span>
                <span class="roll-length">{lengthOf(chunk.word_count)}</span>
                <span class="stars" role="img" aria-label="Richesse en accords{'\u202f: '}{starsFor(chunk.score)} sur 5">
                  {#each Array.from({ length: starsFor(chunk.score) }, (_, i) => i) as i (i)}<Icon name="star" size={16} />{/each}
                </span>
              </div>
              <p class="preview">{chunk.preview}</p>
              {#if confirmation && confirmation.chunkId === chunk.id}
                <div class="kit-note confirm">
                  <p>Le rouleau est sur tes étagères.</p>
                  <div class="confirm-actions">
                    <button type="button" class="kit-bronze" data-testid="btn-adopt-play" onclick={() => playNow(confirmation!.textId)}>
                      Le défendre maintenant
                    </button>
                    <button type="button" class="kit-bronze is-quiet" onclick={dismissConfirmation}>Continuer à fouiller</button>
                  </div>
                </div>
              {:else if chunk.text_id !== null}
                <div class="already">
                  <span class="muted">Déjà sur tes étagères</span>
                  <a class="kit-bronze is-quiet" href={href('play', { profileId: String(profile.id), textId: String(chunk.text_id) })}>
                    Le défendre
                  </a>
                </div>
              {:else}
                <button type="button" class="kit-bronze" data-testid="btn-adopt" disabled={adoptingId === chunk.id} onclick={() => adopt(chunk)}>
                  Poser sur tes étagères
                </button>
                {#if adoptErrorChunkId === chunk.id}<p class="kit-note" data-tone="eris">{adoptError}</p>{/if}
              {/if}
            </li>
          {/each}
        </ol>
      {/if}
    {:else if !workLoading}
      <!-- B3 fix round 1: an unknown work (or one the scribes can't reach) still gets a next step. -->
      <p class="scribes-empty" data-testid="work-missing">
        Les scribes ne trouvent pas ce livre sur les rayons d'Alexandrie.
      </p>
      <button type="button" class="kit-link" onclick={toWorks}>
        <Icon name="arrow-left" size={18} /> Toutes les œuvres
      </button>
    {/if}
  </section>
</div>

<style>
  .page-left {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .work-title {
    margin: 6px 0 0;
    font-family: var(--font-body);
    font-weight: 700;
    font-size: 24px;
    letter-spacing: normal;
    text-transform: none;
    color: var(--ink);
  }
  .work-by {
    margin: 0;
    font-size: 16px;
    color: var(--form-ink-soft);
  }
  .scribes-empty {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-style: italic;
  }
  /* The view through the portal under the owl's plate (the same plate as the works' left page). */
  .plate {
    margin: 0;
    border: 6px solid #e2cfa4;
    box-shadow:
      0 0 0 1px var(--parchment-edge),
      0 4px 10px rgba(92, 64, 24, 0.3);
  }
  .plate img {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }
  .rolls {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .roll-entry {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 0;
    border-bottom: 1px dashed rgba(138, 90, 40, 0.4);
  }
  .roll-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .seq {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  .roll-length {
    font-style: italic;
    color: var(--form-ink-soft);
  }
  .stars {
    margin-left: auto;
    color: var(--reward-ink);
  }
  .preview {
    margin: 0;
    font-family: var(--font-reading);
    font-style: italic;
    font-size: 16px;
    line-height: 1.5;
  }
  .already,
  .confirm-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .confirm p {
    margin: 0 0 8px;
    font-weight: 600;
  }
</style>
