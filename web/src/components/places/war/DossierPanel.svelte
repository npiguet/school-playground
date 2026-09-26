<script lang="ts">
  // Éris's dossier on the player (spec §2, §3.6), laid on the war tent's map table (UI3 Ruling B4,
  // WarTent.svelte): « Ses points faibles » as one pinned sheet per lieutenant. Her voice (eris.ts)
  // sits *above* the real numbers, never replaces them - every taunt is followed by the actual
  // catch rate so the player can always check her bragging against the facts. Degrades
  // gracefully: when the world API can't be reached the per-lieutenant sheets are skipped but the
  // raw stats (which always exist) still render.
  import Gauge from '../../juice/Gauge.svelte';
  import Reveal from '../../juice/Reveal.svelte';
  import LieutenantBadge from '../../LieutenantBadge.svelte';
  import OverlayVoice from '../../scene/OverlayVoice.svelte';
  import { campStore, refreshCamp, loadCatalog } from '../../../lib/world/campStore.svelte';
  import { LIEUTENANT_ORDER, type LieutenantKey } from '../../../lib/world/types';
  import { agree, bandFor, dossierLine, dossierIntro, sleepingLine, smallTricksLine } from '../../../lib/world/eris';
  import { erisSays } from '../../../lib/world/voices';
  import { entry as bestiaryEntry } from '../../../lib/world/bestiary';
  import { api, ApiError } from '../../../lib/api';
  import type { Profile, StatsResponse } from '../../../lib/types';
  import { href } from '../../../lib/routes';
  import { go } from '../../../lib/scene/panelNav';

  let { profile }: { profile: Profile } = $props();

  const profileId = $derived(String(profile.id));

  const SMALL_TRICK_CATEGORIES = ['accent', 'lexical', 'punctuation_case'];

  let stats = $state<StatsResponse | null>(null);
  let statsLoading = $state(true);
  let statsError = $state('');

  $effect(() => {
    void refreshCamp(profile.id);
    void loadCatalog();
    statsLoading = true;
    statsError = '';
    api.profiles
      .stats(profile.id)
      .then((s) => (stats = s))
      .catch((e) => {
        statsError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
      })
      .finally(() => {
        statsLoading = false;
      });
  });

  function nameFor(key: LieutenantKey): string {
    const l = campStore.data?.lieutenants.find((x) => x.key === key);
    return l?.name ?? campStore.catalog?.lieutenants.find((x) => x.key === key)?.name ?? bestiaryEntry(key)?.name ?? key;
  }

  function pct(rate: number | null): string {
    return rate === null ? '—' : `${Math.round(rate * 100)} %`;
  }

  const smallTricks = $derived.by(() => {
    const rows = (stats?.categories ?? []).filter((c) => SMALL_TRICK_CATEGORIES.includes(c.category));
    const traps = rows.reduce((sum, c) => sum + c.errors_in_draft, 0);
    const caught = rows.reduce((sum, c) => sum + c.caught, 0);
    return { traps, caught };
  });

  const topTrapWords = $derived(
    [...(stats?.trap_words ?? [])].sort((a, b) => b.misses - a.misses).slice(0, 8),
  );

  const bestCatchRate = $derived.by(() => {
    const rates = (stats?.recent_sessions ?? [])
      .map((s) => s.catch_rate)
      .filter((r): r is number => r !== null);
    return rates.length > 0 ? Math.max(...rates) : null;
  });

  // The portrait opens over the file: its seal steps back here (UI3 Ruling A1).
  function goLieutenant(key: LieutenantKey) {
    go(href('lieutenant', { profileId, key }), 'panel');
  }
</script>

<div class="panel-dossier">
  <OverlayVoice line={erisSays(statsLoading ? 'Éris feuillette son dossier…' : dossierIntro(profile.name, stats?.totals.sessions ?? 0))} />

  {#if statsError}
    <p class="kit-note" data-tone="eris">Impossible de lire le dossier : {statsError}</p>
  {/if}

  {#if !statsLoading}
    <section>
      <h3 class="kit-section">Ses points faibles</h3>
      {#if campStore.error}
        <p class="kit-note" data-tone="eris">Les ruses d'Éris n'ont pas pu être lues : {campStore.error}</p>
      {:else if !campStore.data}
        <p class="muted">Éris étale ses notes sur la table…</p>
      {:else}
        <ul class="papers">
          {#each LIEUTENANT_ORDER as key (key)}
            {@const l = campStore.data.lieutenants.find((x) => x.key === key)}
            <li>
              {#if !l || !l.available}
                <div class="kit-sheet paper is-asleep" data-testid="dossier-row-{key}" data-lieutenant={key}>
                  <span class="paper-head"><LieutenantBadge lieutenantKey={key} size={40} dim /><h4>{nameFor(key)}</h4></span>
                  <p class="muted">{sleepingLine(key)}</p>
                </div>
              {:else}
                {@const band = bandFor(l)}
                <button type="button" class="kit-sheet paper" data-testid="dossier-row-{key}" data-lieutenant={key} onclick={() => goLieutenant(key)}>
                  <span class="paper-head">
                    <LieutenantBadge lieutenantKey={key} size={40} />
                    <h4>{nameFor(key)}</h4>
                    {#if l.neutralised}<span class="kit-stamp">{agree('Neutralisé', key)}</span>{/if}
                  </span>
                  <span class="kit-note" data-tone="eris" data-testid="dossier-line-{key}">{dossierLine(key, band)}</span>
                  <span class="numbers">Pièges tendus : {l.all_time.traps} · déjoués : {l.all_time.caught} · {pct(l.all_time.rate)}</span>
                  <Gauge value={l.window.days} max={3} label={`${l.window.days}/3 jours · ${l.window.traps}/10 pièges · ${pct(l.window.rate)}`} />
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="kit-sheet small-tricks" data-testid="dossier-small-tricks">
      <h3 class="kit-section">Ses petites ruses</h3>
      <p>{smallTricksLine(smallTricks.traps, smallTricks.caught)}</p>
      {#if topTrapWords.length > 0}
        <h4>Mots qu'elle vise</h4>
        <ul class="target-words">
          {#each topTrapWords as w (w.word)}<li>{w.word}</li>{/each}
        </ul>
      {/if}
      <!-- The journal is another place (the cabin): a plain link, not an overlay on this table. -->
      <a class="kit-link" href={href('stats', { profileId })}>Lire ton journal</a>
    </section>

    {#if stats}
      <Reveal>
        <section class="kit-sheet taire">
          <h3 class="kit-section">Ce qu'elle préfère taire</h3>
          <ul>
            <li>Ton meilleur taux de réussite : {bestCatchRate === null ? '—' : pct(bestCatchRate)}</li>
            <li>Dés-accords déjoués en tout : {stats.totals.caught}</li>
            {#if campStore.data}
              <li>Ton rang actuel : {campStore.data.xp.title}</li>
            {/if}
          </ul>
        </section>
      </Reveal>
    {/if}
  {/if}
</div>

<style>
  .panel-dossier {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .papers {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 18px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* A sheet pinned on the table: .kit-sheet's own margin leaves room for its rods. */
  .paper {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: calc(100% - 20px);
    margin: 14px 10px;
    text-align: left;
    font: inherit;
    /* The parchment's ink, not the table's light lettering (a button would inherit it). */
    color: var(--ink);
    border: 0;
    cursor: pointer;
  }
  .paper.is-asleep {
    filter: saturate(0.45) brightness(0.92);
    cursor: default;
  }
  .paper:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 4px;
  }
  .paper-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .paper-head h4 {
    margin: 0;
  }
  .paper p {
    margin: 0;
  }
  .numbers {
    font-size: 15px;
  }
  .small-tricks {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .small-tricks p,
  .small-tricks h4 {
    margin: 0;
  }
  .target-words {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .target-words li {
    font-family: var(--font-reading);
    font-style: italic;
    color: var(--orange-ink);
  }
  .taire ul {
    margin: 0;
    padding-left: 20px;
  }
</style>
