<script lang="ts">
  // The bestiary, a two-page codex on the war tent's lectern (UI3 Ruling B4, immersion Deferred #1):
  // the real myths behind every monster, tool, place and companion (spec §3.6; plan Decision 13).
  // Left page, Éris's side (her lieutenants and herself); right page, the camp's friends. The owl
  // introduces it from the overlay's voice plate (Ruling B10). A monster's entry carries its combat
  // status stamp, from the world API's per-lieutenant state; when that API can't be reached the
  // codex still renders (every monster shown as still to discover rather than crashing).
  import { BESTIARY, type BestiaryEntry } from '../../../lib/world/bestiary';
  import { campFor } from '../../../lib/world/campStore.svelte';
  import { pronounFor } from '../../../lib/world/eris';
  import { codexStamp } from '../../../lib/world/seals';
  import type { LieutenantKey } from '../../../lib/world/types';
  import { href } from '../../../lib/routes';
  import { go } from '../../../lib/scene/panelNav';
  import type { Profile } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  const profileId = $derived(String(profile.id));

  const ERIS_SIDE = BESTIARY.filter((e) => e.kind === 'monster' || e.kind === 'boss');
  // UI3b playability #21: the camp's friends, then its sacred places (Delphi is a place, not a friend).
  const SACRED_PLACES = ['delphes'];
  const CAMP_SIDE = BESTIARY.filter((e) => e.kind !== 'monster' && e.kind !== 'boss' && !SACRED_PLACES.includes(e.key));
  const PLACES_SIDE = BESTIARY.filter((e) => SACRED_PLACES.includes(e.key));

  // The war tent's PlaceScene loads /camp (final review M15); this hero's snapshot only (I2).
  const camp = $derived(campFor(profile.id));

  function lieutenantState(key: string) {
    return camp?.lieutenants.find((l) => l.key === key) ?? null;
  }

  function isUnlocked(e: BestiaryEntry): boolean {
    if (e.kind !== 'monster') return true;
    return lieutenantState(e.key)?.bestiary_unlocked ?? false;
  }

  function statusStamp(e: BestiaryEntry): string | null {
    if (e.kind !== 'monster') return null;
    return codexStamp(lieutenantState(e.key));
  }

  // A page opens over the codex: its seal steps back here (UI3 Ruling A1).
  function open(key: string) {
    go(href('bestiaire-entry', { profileId, key }), 'panel');
  }
</script>

<div class="codex-spread panel-codex">
  <section class="codex-page page-left">
    <h3 class="kit-section">Les ruses d'Éris</h3>
    <ol class="contents">{#each ERIS_SIDE as e (e.key)}{@render item(e)}{/each}</ol>
  </section>
  <section class="codex-page page-right">
    <h3 class="kit-section">Les amis du camp</h3>
    <ol class="contents">{#each CAMP_SIDE as e (e.key)}{@render item(e)}{/each}</ol>
    <h3 class="kit-section places">Les lieux sacrés</h3>
    <ol class="contents">{#each PLACES_SIDE as e (e.key)}{@render item(e)}{/each}</ol>
  </section>
</div>

{#snippet item(e: BestiaryEntry)}
  {@const unlocked = isUnlocked(e)}
  {@const status = statusStamp(e)}
  <li>
    <button type="button" class="entry" data-testid="bestiary-card-{e.key}" onclick={() => open(e.key)}>
      <img src={e.art} alt="" class="thumb" class:locked={!unlocked} loading="lazy" decoding="async" />
      <span class="entry-text">
        <span class="entry-title">{e.name}</span>
        <span class="entry-teaser">{e.teaser}</span>
        {#if status}<span class="kit-stamp">{status}</span>{/if}
        {#if e.kind === 'monster' && !unlocked}
          <span class="entry-locked" data-testid="bestiary-locked">Mythe à débloquer{'\u202f: '}termine une quête contre {pronounFor(e.key as LieutenantKey)}</span>
        {/if}
      </span>
    </button>
  </li>
{/snippet}

<style>
  .codex-page h3 {
    margin: 0 0 8px;
  }
  .codex-page h3.places {
    margin-top: 18px;
  }
  .contents {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .contents li + li {
    border-top: 1px dashed rgba(138, 90, 40, 0.4);
  }
  /* A table-of-contents entry: its picture, name, teaser and where the hero stands with it. */
  .entry {
    display: flex;
    align-items: center;
    gap: 12px;
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
  .thumb {
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    object-fit: contain;
  }
  .thumb.locked {
    filter: grayscale(0.8) brightness(0.9);
  }
  .entry-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .entry-title {
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 18px;
  }
  .entry-teaser {
    font-size: 15px;
  }
  .entry-locked {
    font-size: 15px;
    font-style: italic;
    color: var(--orange-ink);
  }
</style>
