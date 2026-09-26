<script lang="ts">
  // Éris's dossier on the player: « Ses points faibles » (spec §2, §3.6). Her voice (eris.ts)
  // sits *above* the real numbers, never replaces them - every taunt is followed by the actual
  // catch rate so the player can always check her bragging against the facts. Degrades
  // gracefully: the world API (SP3 server Tasks 2-3) may not exist yet, in which case the
  // per-lieutenant rows are skipped but the raw SP1 stats (which always exist) still render.
  import TopBar from '../components/TopBar.svelte';
  import Gauge from '../components/juice/Gauge.svelte';
  import Reveal from '../components/juice/Reveal.svelte';
  import LieutenantBadge from '../components/LieutenantBadge.svelte';
  import { ART } from '../lib/world/art';
  import { campStore, refreshCamp, loadCatalog } from '../lib/world/campStore.svelte';
  import { LIEUTENANT_ORDER, type LieutenantKey } from '../lib/world/types';
  import { agree, bandFor, dossierLine, dossierIntro, sleepingLine, smallTricksLine } from '../lib/world/eris';
  import { entry as bestiaryEntry } from '../lib/world/bestiary';
  import { api, ApiError } from '../lib/api';
  import type { Profile, StatsResponse } from '../lib/types';
  import { href } from '../lib/routes';
  import { go } from '../lib/scene/panelNav';

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

  function goLieutenant(key: LieutenantKey) {
    go(href('lieutenant', { profileId, key }));
  }
</script>

<TopBar {profile} title="Le dossier d'Éris" />

<div class="screen dossier">
  <header class="eris-panel header">
    <img src={ART.erisSmug} alt="Éris" class="eris-portrait float" />
    <p class="bubble">
      {statsLoading ? 'Éris feuillette son dossier…' : dossierIntro(profile.name, stats?.totals.sessions ?? 0)}
    </p>
  </header>

  {#if statsError}
    <p class="orange">Impossible de lire le dossier : {statsError}</p>
  {/if}

  {#if !statsLoading}
    <section>
      <h2>Ses points faibles</h2>
      {#if campStore.error}
        <p class="muted">Le tableau des ruses n'a pas pu être chargé : {campStore.error}</p>
      {:else if !campStore.data}
        <p class="muted">Les Muses préparent le tableau des ruses…</p>
      {:else}
        <ul class="lieutenant-list">
          {#each LIEUTENANT_ORDER as key (key)}
            {@const l = campStore.data.lieutenants.find((x) => x.key === key)}
            <li>
              {#if !l || !l.available}
                <div class="parchment row row-locked">
                  <LieutenantBadge lieutenantKey={key} size={40} dim />
                  <span class="row-name">{nameFor(key)}</span>
                  <span class="muted">{sleepingLine(key)}</span>
                </div>
              {:else}
                {@const band = bandFor(l)}
                <button type="button" class="parchment row" onclick={() => goLieutenant(key)}>
                  <span class="row-head">
                    <LieutenantBadge lieutenantKey={key} size={40} />
                    <span class="row-name">{nameFor(key)}</span>
                    {#if l.neutralised}<span class="chip chip-gold">{agree('Neutralisé', key)}</span>{/if}
                  </span>
                  <p class="eris-line" data-testid="dossier-line-{key}">{dossierLine(key, band)}</p>
                  <p class="numbers muted">
                    Pièges tendus : {l.all_time.traps} · déjoués : {l.all_time.caught} · taux : {pct(l.all_time.rate)}
                  </p>
                  <Gauge
                    value={l.window.days}
                    max={3}
                    label={`${l.window.days}/3 jours · ${l.window.traps}/10 pièges · ${pct(l.window.rate)}`}
                  />
                </button>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="parchment small-tricks" data-testid="dossier-small-tricks">
      <p>{smallTricksLine(smallTricks.traps, smallTricks.caught)}</p>
      {#if topTrapWords.length > 0}
        <h3>Mots qu'elle vise</h3>
        <div class="chips">
          {#each topTrapWords as w (w.word)}
            <span class="chip">{w.word}</span>
          {/each}
        </div>
      {/if}
      <a href={href('stats', { profileId })}>Voir les chiffres bruts</a>
    </section>

    {#if stats}
      <Reveal>
        <section class="parchment taire">
          <h2>Ce qu'elle préfère taire</h2>
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
  .dossier {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
  }
  .eris-portrait {
    max-height: 220px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .eris-portrait.float {
    animation: float 3.4s ease-in-out infinite;
  }
  .bubble {
    margin: 0;
    font-family: var(--font-body);
    font-size: 17px;
  }
  .lieutenant-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 14px 16px;
    border: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  .row-locked {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    filter: grayscale(0.6);
  }
  .row-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .row-name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 17px;
  }
  .chip-gold {
    background: var(--gold-light);
    border-color: var(--gold);
    color: var(--ink);
    font-weight: 600;
  }
  .eris-line {
    margin: 0;
    font-style: italic;
  }
  .numbers {
    margin: 0;
    font-size: 14px;
  }
  .small-tricks {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .small-tricks p {
    margin: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .taire {
    padding: 16px;
  }
  .taire ul {
    margin: 0;
    padding-left: 20px;
  }
</style>
