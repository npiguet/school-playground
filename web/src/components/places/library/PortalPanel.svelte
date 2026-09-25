<script lang="ts">
  // Bibliothèque d'Alexandrie (spec §5 SP2, "Decisions" #9/#12): browse the allowlisted
  // public-domain works so a player can adopt a scored chunk ("rouleau") as a parchemin.
  // UI3a Task 11: opened as an overlay of the library tent (panel 'portail') rather than a full
  // screen - the painted hero banner below is the view through the portal itself.
  // Immersion wave Task 10 (playability #1, #24): an open codex - the view through the portal as a
  // plate on the left page, the works as a table of contents on the right; the owl says what to do
  // (VOICES.portal).
  import { tick } from 'svelte';
  import { api, ApiError } from '../../../lib/api';
  import { href } from '../../../lib/routes';
  import { go } from '../../../lib/scene/panelNav';
  import { workByline } from '../../../lib/library/shelf';
  import { plural } from '../../../lib/text/french';
  import { ART } from '../../../lib/world/art';
  import type { AlexandriaWork, Profile } from '../../../lib/types';

  // `focusWorkId`: fix round 2 finding 4. Closing the work overlay remounts this panel fresh, and
  // Overlay's own `modal.destroy()` return-focus fires ~160ms after that (its local `out:leave`) -
  // a fixed delay that races this panel's own `works` fetch. Rather than guess a delay, LibraryTent
  // passes the work id to return to (only when actually coming back from one) and this panel moves
  // focus onto that card itself, once `works` has actually rendered - deterministic regardless of
  // how long the fetch took. Overlay's own `returnFocus` (targeting the same card) stays as a
  // harmless, purely opportunistic fallback for whichever case is faster.
  let { profile, focusWorkId }: { profile: Profile; focusWorkId?: string } = $props();

  let works = $state<AlexandriaWork[]>([]);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      works = await api.alexandria.works();
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }

  load();

  let focused = false;
  $effect(() => {
    if (focused || !focusWorkId || loading || works.length === 0) return;
    focused = true;
    const id = focusWorkId;
    tick().then(() => {
      document.querySelector<HTMLElement>(`[data-testid="work-card"][data-work-id="${id}"]`)?.focus();
    });
  });

  function statusLabel(w: AlexandriaWork): string {
    if (w.status === 'never') return 'Pas encore recopié';
    if (w.status === 'error') return "Hors d'atteinte";
    return plural(w.chunk_count, 'rouleau', 'rouleaux');
  }

  function openWork(w: AlexandriaWork) {
    go(href('alexandria-work', { profileId: String(profile.id), workId: w.id }), 'panel');
  }
</script>

<div class="codex-spread panel-portal">
  <section class="codex-page page-left">
    <!-- The view through the portal, as a plate in the book (the art path comes from the ART table,
         final review M7, so budgets and renames stay there). -->
    <figure class="plate"><img src={ART.scenes.alexandrie} alt="" /></figure>
    <p class="page-note">Derrière le portail, les scribes d'Alexandrie recopient des livres anciens pour tes étagères.</p>
  </section>
  <section class="codex-page page-right">
    <h3>Les œuvres</h3>
    {#if loading}
      <p class="muted">Les Muses cherchent les scribes…</p>
    {:else if error}
      <p class="kit-note" data-tone="eris">Impossible de joindre la Bibliothèque : {error}</p>
    {:else}
      <ol class="contents">
        {#each works as w (w.id)}
          <li>
            <button
              type="button"
              class="entry"
              data-testid="work-card"
              data-work-id={w.id}
              data-status={w.status}
              onclick={() => openWork(w)}
            >
              <span class="entry-title">{w.title}</span>
              <span class="entry-by">{workByline(w)}</span>
              <span class="entry-meta">
                <span class="kit-medallion is-small" role="img" aria-label="Classe {w.level_hint}">{w.level_hint}</span>
                <span class="entry-status" class:is-away={w.status === 'error'}>{statusLabel(w)}</span>
              </span>
            </button>
          </li>
        {/each}
      </ol>
    {/if}
  </section>
</div>

<style>
  .plate {
    margin: 0 0 14px;
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
  .page-note {
    font-style: italic;
    font-size: 17px;
    margin: 0;
  }
  .page-right h3 {
    margin: 0 0 8px;
  }
  .contents {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .contents li + li {
    border-top: 1px dashed rgba(138, 90, 40, 0.4);
  }
  /* A table-of-contents entry: title, who wrote it, the class medallion and the scribes' status. */
  .entry {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas: 'title meta' 'by meta';
    align-items: center;
    gap: 2px 12px;
    width: 100%;
    min-height: 64px;
    padding: 8px 6px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .entry:hover,
  .entry:focus-visible {
    background: rgba(200, 148, 80, 0.12);
  }
  .entry:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .entry-title {
    grid-area: title;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 19px;
  }
  .entry-by {
    grid-area: by;
    font-size: 14px;
    color: var(--form-ink-soft);
  }
  .entry-meta {
    grid-area: meta;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .entry-status {
    font-size: 14px;
    color: var(--form-ink-soft);
  }
  .entry-status.is-away {
    color: #9a4d12;
    font-weight: 600;
  }
</style>
