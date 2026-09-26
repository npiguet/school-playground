<script lang="ts">
  // The shelves overlay of the library tent (UI3a Task 9, Ruling A3, A16): what was the whole
  // Library screen, minus its own TopBar/FAB (the tent's desk, lens and portal replace the old
  // add menu now - LibraryTent.svelte opens this as `overlay-shelves`).
  // Immersion wave Task 8 (playability #1, #2): each text is a rolled scroll lying in a cubby of the
  // shelf unit, sealed with wax until it has been defended (then the seal is broken and a laurel lies
  // on it), with a paper tag in the camp's words: no grade pills, no word counts. Her own class comes
  // first (« Pour toi »); every other level stays one toggle away (« Autres classes », parity).
  import LevelMedallions from '../../ui/LevelMedallions.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { api, ApiError } from '../../../lib/api';
  import { isProphecy } from '../../../lib/dates';
  import { LEVELS } from '../../../lib/levels';
  import { historyLine, lengthOf, shelfSections, splitTitle, textByline } from '../../../lib/library/shelf';
  import { href } from '../../../lib/routes';
  import { go } from '../../../lib/scene/panelNav';
  import { longDate } from '../../../lib/text/french';
  import { ART, MARK_ICONS } from '../../../lib/world/art';
  import type { Profile, TextSummary } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  let texts = $state<TextSummary[]>([]);
  let loading = $state(true);
  let error = $state('');
  let othersOpen = $state(false);
  let levelFilter = $state<string>('Tous');

  async function load() {
    loading = true;
    error = '';
    try {
      texts = await api.texts.list(profile.id);
    } catch (e) {
      error = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loading = false;
    }
  }

  load();

  function play(t: TextSummary) {
    go(href('play', { profileId: String(profile.id), textId: String(t.id) }));
  }

  // Prophecies (dictées préparées whose due date has not passed yet, spec's "Decisions" #14) get
  // their own top section; each scroll lies on one shelf only (shelfSections).
  const sections = $derived(shelfSections(texts, profile.level, levelFilter));
  const prophecies = $derived(sections.prophecies);
  const ownLevel = $derived(sections.own);
  const others = $derived(sections.others);
</script>

<div class="panel-shelves">
  {#snippet cubby(t: TextSummary)}
    {@const len = lengthOf(t.word_count)}
    {@const defended = (t.history?.times_played ?? 0) > 0}
    {@const byline = textByline(t)}
    {@const parts = splitTitle(t.title)}
    <button type="button" class="kit-cubby" data-testid="text-card" data-length={len} onclick={() => play(t)}>
      <span class="kit-roll" data-length={len} aria-hidden="true">
        <img class="roll-art" src={ART.ui.scrollRolled} alt="" draggable="false" />
        <span class="kit-seal" class:is-broken={defended}>
          <img src={MARK_ICONS.oracleSeal} alt="" />
          {#if defended}<span class="seal-laurel"><Icon name="laurel" size={22} /></span>{/if}
        </span>
      </span>
      <!-- Re-review N2: the book and the chapter on lines of their own (a clamp never cuts the part
           that tells two chapters apart). The length is the roll's thickness and the unbroken seal
           says « never defended »: both are told to assistive tech only; a defence is written. -->
      <span class="kit-tag">
        <span class="kit-tag-title">{parts.book}</span>
        {#if parts.chapter}<span class="kit-tag-chapter">{parts.chapter}</span>{/if}
        {#if byline}<span class="kit-tag-meta">{byline}</span>{/if}
        <span class="sr-only">parchemin {len}</span>
        {#if defended}
          <span class="kit-tag-meta" data-testid="text-history">{historyLine(t.history)}</span>
        {:else}
          <span class="sr-only">{historyLine(t.history)}</span>
        {/if}
        {#if t.source === 'scan'}<span class="kit-stamp">Déchiffré</span>{/if}
        {#if t.source === 'online'}<span class="kit-stamp">Alexandrie</span>{/if}
        {#if t.due_date && isProphecy(t.due_date)}
          <span class="kit-prophecy" data-testid="chip-prophecy">Prophétie · {longDate(t.due_date)}</span>
        {/if}
      </span>
    </button>
  {/snippet}

  {#if loading}
    <p class="muted">Les Muses déroulent les parchemins…</p>
  {:else if error}
    <p class="kit-note" data-tone="eris">Impossible de lire les parchemins : {error}</p>
  {:else}
    {#if prophecies.length > 0}
      <section>
        <h3>Prophéties de l'Oracle</h3>
        <p class="muted">Ce que prépare ta classe : défends-les avant le jour dit.</p>
        <div class="cubbies">
          {#each prophecies as t (t.id)}{@render cubby(t)}{/each}
        </div>
      </section>
    {/if}

    <section>
      <h3>Pour toi</h3>
      {#if ownLevel.length > 0}
        <div class="cubbies">
          {#each ownLevel as t (t.id)}{@render cubby(t)}{/each}
        </div>
      {:else}
        <p class="muted">
          Aucun parchemin pour ta classe pour l'instant. Le pupitre, la lentille et le portail en
          apportent de nouveaux.
        </p>
      {/if}
    </section>

    <section class="others">
      <!-- Re-review N14: a text link with a turning chevron, like the ritual's seal toggle. -->
      <button
        type="button"
        class="kit-link others-toggle"
        aria-expanded={othersOpen}
        aria-controls="other-levels"
        onclick={() => (othersOpen = !othersOpen)}
      >
        <Icon name="chevron" size={14} />
        Autres classes
      </button>
      {#if othersOpen}
        <div id="other-levels">
          <LevelMedallions
            legend="Quelle classe ?"
            name="shelf-level"
            options={['Tous', ...LEVELS]}
            bind:value={levelFilter}
            testId="shelf-levels"
          />
          <h3>{levelFilter === 'Tous' ? 'Autres parchemins' : `Classe ${levelFilter}`}</h3>
          {#if others.length > 0}
            <div class="cubbies">
              {#each others as t (t.id)}{@render cubby(t)}{/each}
            </div>
          {:else if levelFilter === profile.level}
            <p class="muted">Les parchemins de ta classe t'attendent plus haut, sous « Pour toi ».</p>
          {:else}
            <p class="muted">Aucun autre parchemin sur cette étagère.</p>
          {/if}
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .panel-shelves {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .panel-shelves h3 {
    margin: 0 0 10px;
  }
  /* The shelf unit: cubbies in rows on the dark board. */
  .cubbies {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 18px 14px;
    padding: 10px;
    border-radius: 8px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.3));
    box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.35);
  }
  /* Alternate the tags' tilt so a row doesn't look printed. */
  .cubbies > :global(.kit-cubby:nth-child(3n + 2) .kit-tag) {
    --tag-tilt: 1deg;
  }
  .cubbies > :global(.kit-cubby:nth-child(3n) .kit-tag) {
    --tag-tilt: -0.4deg;
  }
  .others {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
  .others > div {
    align-self: stretch;
  }
  /* On the dark wood the link is written in the board's gold, flush with the headings. */
  .others-toggle {
    margin-left: -8px;
    color: var(--gold-light);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .others-toggle :global(.icon-svg) {
    transition: transform 0.15s ease;
  }
  .others-toggle[aria-expanded='true'] :global(.icon-svg) {
    transform: rotate(180deg);
  }
  @media (prefers-reduced-motion: reduce) {
    .others-toggle :global(.icon-svg) {
      transition: none;
    }
  }
</style>
