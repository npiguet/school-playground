<script lang="ts">
  // The hero's journal (UI3 Ruling B6, was the Stats screen; spec §3.6): a two-page codex on the
  // cabin desk. Left page: the Muses' help stage (four medallions and what they do) and Éris's
  // tricks one by one; right page: the trap words (laurel leaves for their box), the last defences
  // and the totals, loaded from the server.
  import { api, ApiError } from '../../../lib/api';
  import { CATEGORY_LABELS } from '../../../lib/explain';
  import { HELP_STAGES, defenceMeta, helpStageLine, rateText } from '../../../lib/world/journal';
  import { plural } from '../../../lib/text/french';
  import type { StatKey } from '../../../lib/grading/types';
  import type { CategoryRow, Profile, StatsResponse } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  let stats = $state<StatsResponse | null>(null);
  let loading = $state(true);
  let error = $state('');

  async function load() {
    loading = true;
    error = '';
    try {
      stats = await api.profiles.stats(profile.id);
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }

  load();

  function categoryLabel(category: string): string {
    return CATEGORY_LABELS[category as StatKey] ?? category;
  }

  const categories = $derived((stats?.categories ?? []).filter((c: CategoryRow) => c.errors_in_draft > 0));
</script>

<div class="codex-spread panel-journal">
  <section class="codex-page page-left">
    {#if loading}
      <p class="muted">Les Muses ouvrent ton journal…</p>
    {:else if error}
      <p class="kit-note" data-tone="eris">Impossible d'ouvrir ton journal : {error}</p>
    {:else if stats}
      <h3 class="kit-section">L'aide des Muses</h3>
      <div class="help" data-testid="journal-help">
        <ol class="help-stages">
          {#each HELP_STAGES as s (s)}
            <li class="kit-medallion is-small" aria-current={s === stats.profile.help_stage ? 'step' : undefined}>{s}</li>
          {/each}
        </ol>
        <p class="help-line">{helpStageLine(stats.profile.help_stage)}</p>
      </div>
      <h3 class="kit-section">Ses ruses, une à une</h3>
      {#if categories.length === 0}
        <p class="muted">Éris n'a encore rien noté. Défends un texte !</p>
      {:else}
        <table class="tricks">
          <thead><tr><th>Ruse</th><th>Pièges</th><th>Déjoués</th><th>Réussite</th></tr></thead>
          <tbody>
            {#each categories as c (c.category)}
              <tr><td>{categoryLabel(c.category)}</td><td>{c.errors_in_draft}</td><td>{c.caught}</td><td>{rateText(c.catch_rate)}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {/if}
  </section>
  <section class="codex-page page-right">
    {#if stats}
      <h3 class="kit-section">Mots-pièges</h3>
      {#if stats.trap_words.length === 0}
        <p class="muted">Aucun mot-piège pour l'instant.</p>
      {:else}
        <ul class="trap-words">
          {#each stats.trap_words as w (w.word)}
            <li>
              <span class="trap-word">{w.word}</span>
              <span class="leaves" role="img" aria-label="{plural(w.box, 'feuille', 'feuilles')} de laurier sur 5">
                {#each [1, 2, 3, 4, 5] as n (n)}<span class="leaf" class:filled={n <= w.box}></span>{/each}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
      <h3 class="kit-section">Tes dernières défenses</h3>
      {#if stats.recent_sessions.length === 0}
        <p class="muted">Aucun texte défendu pour l'instant.</p>
      {:else}
        <ul class="defences">
          {#each stats.recent_sessions as s (s.id)}
            <li>
              <span class="defence-title">{s.title}</span>
              <span class="defence-meta">{defenceMeta(s)}</span>
              {#if s.mode === 'grimoire'}<span class="kit-stamp">Grimoire</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      <h3 class="kit-section">Depuis le début</h3>
      <p data-testid="journal-totals">{plural(stats.totals.sessions, 'texte défendu', 'textes défendus')} · {plural(stats.totals.score, 'point', 'points')} · {plural(stats.totals.caught, 'piège déjoué', 'pièges déjoués')}</p>
    {/if}
  </section>
</div>

<style>
  .page-left > :first-child,
  .page-right > :first-child {
    margin-top: 0;
  }
  .help {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .help-stages {
    display: flex;
    gap: 10px;
    list-style: none;
    margin: 0 0 6px;
    padding: 0;
  }
  .help-stages [aria-current='step'] {
    border-color: var(--gold-light);
    box-shadow:
      0 0 0 3px var(--gold-light),
      0 0 12px rgba(255, 220, 140, 0.8);
  }
  .help-line {
    margin: 0;
    font-style: italic;
  }
  /* Ink on the codex page: no cells, a hairline under each row. */
  .tricks {
    width: 100%;
    border-collapse: collapse;
  }
  .tricks th,
  .tricks td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--parchment-edge);
  }
  .tricks th {
    font-weight: 600;
    font-size: 14px;
    color: var(--form-ink-soft);
  }
  .trap-words {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .trap-words li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .trap-word {
    font-family: var(--font-body);
    font-weight: 600;
  }
  /* The camp's weekly-ribbon leaf, in the page's ink: filled leaves are gold. */
  .leaves {
    display: inline-flex;
    gap: 3px;
  }
  .leaf {
    width: 10px;
    height: 16px;
    box-sizing: border-box;
    border-radius: 100% 0;
    border: 1.5px solid var(--bronze-dark);
    background: transparent;
    transform: rotate(-30deg);
  }
  .leaf.filled {
    border-color: var(--bronze-dark);
    background: linear-gradient(135deg, var(--gold-light), var(--gold));
  }
  .defences {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  /* One defence per entry: its title, then its date, points and rate underneath (and the grimoire's
     stamp), so every entry reads the same whatever the title's length. */
  .defences li {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
  }
  .defence-title {
    font-family: var(--font-body);
    font-weight: 600;
  }
  .defence-meta {
    font-size: 14px;
    color: var(--form-ink-soft);
  }
</style>
