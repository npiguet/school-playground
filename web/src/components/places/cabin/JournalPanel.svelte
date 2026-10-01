<script lang="ts">
  // The hero's journal (UI3 Ruling B6, was the Stats screen; spec §3.6): a two-page codex on the
  // cabin desk, the one place for the all-time counts (UI3b playability #3). Left page: the aids
  // taken last (spec 2026-09-29 §3) and what one left at the camp is worth, then Éris's tricks one
  // by one, each told by the monster that plays it with laurels for what was foiled (playability #1, #2: no gradebook, no
  // numbered steps); right page: the trap words (laurel leaves for their box), the texts last
  // defended, one line per text (playability #14), and the totals, loaded from the server. The
  // dragon speaks from the overlay's voice plate (CabinRoom.svelte, playability #7).
  import LieutenantBadge from '../../LieutenantBadge.svelte';
  import { api, ApiError } from '../../../lib/api';
  import { aidBonusLine, aidsJournalLine, defenceGroups, journalRuses } from '../../../lib/world/journal';
  import { normalizeAids } from '../../../lib/aids';
  import { rulesOf } from '../../../lib/rules';
  import { campStore, loadCatalog } from '../../../lib/world/campStore.svelte';
  import { plural } from '../../../lib/text/french';
  import type { Profile, StatsResponse } from '../../../lib/types';

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
  // The aid bonus is the rules file's (served with the world catalog); a no-op once loaded.
  void loadCatalog();

  const ruses = $derived(journalRuses(stats?.categories ?? []));
  const defences = $derived(defenceGroups(stats?.recent_sessions ?? []));
  const LEAVES = [1, 2, 3, 4, 5];
</script>

<div class="codex-spread panel-journal">
  <section class="codex-page page-left">
    {#if loading}
      <p class="muted">Les Muses ouvrent ton journal…</p>
    {:else if error}
      <p class="kit-note" data-tone="eris">Impossible d'ouvrir ton journal{'\u202f: '}{error}</p>
    {:else if stats}
      <h3 class="kit-section">Tes aides</h3>
      <div class="aids" data-testid="journal-aids">
        <p class="aids-line">{aidsJournalLine(stats.profile.settings.aids == null ? null : normalizeAids(stats.profile.settings.aids))}</p>
        <p class="aids-rule">{aidBonusLine(rulesOf(campStore.catalog).aid_bonus)}</p>
      </div>
      <h3 class="kit-section">Les ruses d'Éris, une à une</h3>
      {#if ruses.length === 0}
        <p class="muted">Éris n'a encore rien noté. Défends un texte{'\u202f!'}</p>
      {:else}
        <ul class="ruses">
          {#each ruses as r (r.key)}
            <li data-testid="journal-ruse-{r.key}">
              <LieutenantBadge lieutenantKey={r.key} size={40} />
              <span class="ruse-text">
                <span class="ruse-line"><span class="ruse-title">{r.title}</span> — {r.line}</span>
                <span class="ruse-rule">{r.rules}</span>
                <span class="leaves" role="img" aria-label="{plural(r.leaves, 'feuille', 'feuilles')} de laurier sur 5">
                  {#each LEAVES as n (n)}<span class="leaf" class:filled={n <= r.leaves}></span>{/each}
                </span>
              </span>
            </li>
          {/each}
        </ul>
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
                {#each LEAVES as n (n)}<span class="leaf" class:filled={n <= w.box}></span>{/each}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
      <h3 class="kit-section">Tes dernières défenses</h3>
      {#if defences.length === 0}
        <p class="muted">Aucun texte défendu pour l'instant.</p>
      {:else}
        <ul class="defences">
          {#each defences as d (d.key)}
            <li data-testid="journal-defence">
              <span class="defence-title">{d.title}</span>
              <span class="defence-meta">{d.line}</span>
              {#if d.grimoire}<span class="kit-stamp">Grimoire</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      <h3 class="kit-section">Depuis le début</h3>
      <p data-testid="journal-totals">{plural(stats.totals.sessions, 'texte défendu', 'textes défendus')} · {plural(stats.totals.caught, 'piège déjoué', 'pièges déjoués')}</p>
    {/if}
  </section>
</div>

<style>
  .page-left > :first-child,
  .page-right > :first-child {
    margin-top: 0;
  }
  .aids {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .aids p {
    margin: 0;
  }
  .aids-line {
    font-size: 18px;
  }
  .aids-rule {
    font-style: italic;
    color: var(--form-ink-soft);
  }
  /* One monster per entry: its medallion, then its name and what was foiled, the rule it bends in
     small italic, and its laurels (playability #1). */
  .ruses {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .ruses li {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .ruse-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .ruse-title {
    font-family: var(--font-body);
    font-weight: 700;
  }
  .ruse-rule {
    font-size: 15px;
    font-style: italic;
    color: var(--form-ink-soft);
  }
  .ruse-text .leaves {
    margin-top: 2px;
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
  /* One text per entry: its title, then how often and when it was last defended underneath (and the
     grimoire's stamp), so every entry reads the same whatever the title's length. */
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
