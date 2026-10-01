<script lang="ts">
  // Éris's dossier on the player (spec §2, §3.6), laid on the war tent's map table (UI3 Ruling B4,
  // WarTent.svelte): « Ses points faibles » as one pinned sheet per lieutenant. UI3b playability #3:
  // her file is her sentences and one gauge per sheet (what still stands before the next seal, spec
  // 2026-09-29 lieutenant levels §5); the counts themselves live in one place, the journal (« Lire ton journal »), so the
  // same numbers never show three ways. Degrades gracefully: when the world API can't be reached the
  // per-lieutenant sheets are skipped but the rest of her file still renders.
  import Reveal from '../../juice/Reveal.svelte';
  import LieutenantBadge from '../../LieutenantBadge.svelte';
  import OverlayVoice from '../../scene/OverlayVoice.svelte';
  import { campFor, campStore } from '../../../lib/world/campStore.svelte';
  import { rateText } from '../../../lib/text/french';
  import { LIEUTENANT_ORDER, type LieutenantKey } from '../../../lib/world/types';
  import { bandFor, dossierLine, dragonAside, dossierIntro, sleepingLine, smallTricksLine } from '../../../lib/world/eris';
  import { sealFill, sealProgressLine, sealReady, sealTitle } from '../../../lib/world/seals';
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

  // The war tent's PlaceScene loads /camp and the catalog (final review M15); this hero's snapshot
  // only (I2): the store is shared across heroes.
  const camp = $derived(campFor(profile.id));

  $effect(() => {
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
    const l = camp?.lieutenants.find((x) => x.key === key);
    return l?.name ?? campStore.catalog?.lieutenants.find((x) => x.key === key)?.name ?? bestiaryEntry(key)?.name ?? key;
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
    <p class="kit-note" data-tone="eris">Impossible de lire le dossier{'\u202f: '}{statsError}</p>
  {/if}

  {#if !statsLoading}
    <section>
      <h3 class="kit-section">Ses points faibles</h3>
      {#if !camp && campStore.error && !campStore.loading}
        <p class="kit-note" data-tone="eris">Les ruses d'Éris n'ont pas pu être lues{'\u202f: '}{campStore.error}</p>
      {:else if !camp}
        <p class="muted">Éris étale ses notes sur la table…</p>
      {:else}
        <ul class="papers">
          {#each LIEUTENANT_ORDER as key (key)}
            {@const l = camp.lieutenants.find((x) => x.key === key)}
            <li>
              {#if !l || !l.available}
                <div class="kit-sheet paper is-asleep" data-testid="dossier-row-{key}" data-lieutenant={key}>
                  <span class="paper-head"><LieutenantBadge lieutenantKey={key} size={40} dim /><span class="paper-name">{nameFor(key)}</span></span>
                  <p class="muted">{sleepingLine(key, profile.level)}</p>
                </div>
              {:else}
                {@const band = bandFor(l)}
                <!-- A button holds no heading (review fix round 1): the name is a styled span, the
                     button's name is short, and the sheet's content is its description. -->
                <button
                  type="button"
                  class="kit-sheet paper"
                  data-testid="dossier-row-{key}"
                  data-lieutenant={key}
                  aria-label="{nameFor(key)}{'\u202f: '}voir la ruse et la quête"
                  aria-describedby="dossier-{key}-line dossier-{key}-progress"
                  onclick={() => goLieutenant(key)}
                >
                  <span class="paper-head">
                    <LieutenantBadge lieutenantKey={key} size={40} />
                    <span class="paper-name">{nameFor(key)}</span>
                    {#if l.level > 0}<span class="kit-stamp" data-testid="dossier-seal-{key}">{sealTitle(l.level)}</span>{/if}
                  </span>
                  <span class="kit-note" data-tone="eris" id="dossier-{key}-line" data-testid="dossier-line-{key}">{dossierLine(key, band)}</span>
                  <span class="progress" id="dossier-{key}-progress" data-testid="dossier-progress-{key}">{sealProgressLine(key, l)}</span>
                  {#if l.next}
                    <span class="kit-gauge" data-testid="dossier-window-{key}" aria-hidden="true" data-state={sealReady(l.next) ? 'ok' : 'short'} style:--fill="{sealFill(l.next)}%">
                      <span class="kit-gauge-track"><span class="kit-gauge-fill"></span></span>
                    </span>
                  {/if}
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
      <!-- The journal is an overlay of another place (the cabin): a tagged push, so its seal steps
           back to this file (the cross-place overlay rule, panelNav.ts `go`, final review M13). -->
      <a class="kit-link" data-testid="dossier-journal" href={href('stats', { profileId })} onclick={(e) => { e.preventDefault(); go(href('stats', { profileId }), 'panel'); }}>Lire ton journal</a>
    </section>

    {#if stats}
      <Reveal>
        <section class="kit-sheet taire" data-testid="dossier-taire">
          <h3 class="kit-section">Ce qu'elle préfère taire</h3>
          {#if bestCatchRate !== null}
            <p>Ton meilleur texte{'\u202f: '}{rateText(bestCatchRate)} de mes pièges déjoués. Je n'en dirai pas plus.</p>
          {:else}
            <p>Aucun de mes pièges déjoué pour l'instant. Profitons-en.</p>
          {/if}
          {#if camp}
            <p>{dragonAside(camp.dragon.stage)}</p>
          {/if}
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
    align-items: stretch;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 18px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* Every sheet of a row as tall as the row, so the bottom rods line up. */
  .papers > li {
    display: flex;
  }
  /* A sheet pinned on the table: .kit-sheet's own margin leaves room for its rods. */
  .paper {
    flex: 1;
    justify-content: flex-start;
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
  .paper-name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 18px;
  }
  /* The window gauge sits at the foot of every sheet, level from one sheet to the next. */
  .paper .kit-gauge {
    margin-top: auto;
  }
  .paper p {
    margin: 0;
  }
  .progress {
    font-size: 15px;
    font-style: italic;
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
  .taire p {
    margin: 0 0 6px;
    font-style: italic;
  }
</style>
