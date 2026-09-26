<script lang="ts">
  // One page of the bestiary codex (UI3 Ruling B4): the left page holds « Le mythe » (real facts,
  // sourced), the right page « Au camp » (the game's fiction), kept clearly apart so the child never
  // confuses the two (plan Decision 13). Monster pages stay teaser-only until the world API says
  // the full myth is unlocked; tool/place/boss/companion pages are always open.
  import { entry } from '../../../lib/world/bestiary';
  import { campStore, refreshCamp } from '../../../lib/world/campStore.svelte';
  import { pronounFor } from '../../../lib/world/eris';
  import type { LieutenantKey } from '../../../lib/world/types';
  import { href } from '../../../lib/routes';
  import { go } from '../../../lib/scene/panelNav';
  import type { Profile } from '../../../lib/types';

  let { profile, entryKey }: { profile: Profile; entryKey: string } = $props();

  const profileId = $derived(String(profile.id));
  const item = $derived(entry(entryKey));

  $effect(() => {
    if (item?.kind === 'monster') void refreshCamp(profile.id);
  });

  const unlocked = $derived.by(() => {
    if (!item) return false;
    if (item.kind !== 'monster') return true;
    return campStore.data?.lieutenants.find((l) => l.key === item.key)?.bestiary_unlocked ?? false;
  });

  // The portrait opens over the page: its seal steps back here (UI3 Ruling A1).
  function openLieutenant() {
    go(href('lieutenant', { profileId, key: entryKey }), 'panel');
  }
</script>

{#if !item}
  <div class="codex-spread panel-codex-page">
    <section class="codex-page page-left"><p class="muted">Ce monstre n'existe pas… encore.</p></section>
    <section class="codex-page page-right"></section>
  </div>
{:else}
  <div class="codex-spread panel-codex-page">
    <section class="codex-page page-left">
      <figure class="plate" class:is-scene={item.kind === 'place'}><img src={item.art} alt="" /></figure>
      <h3 class="kit-section">Le mythe</h3>
      {#if unlocked}
        <ul>{#each item.facts as fact (fact)}<li>{fact}</li>{/each}</ul>
      {:else}
        <p>{item.teaser}</p>
        <p class="kit-note" data-tone="eris">Mythe à débloquer : termine une quête contre {pronounFor(item.key as LieutenantKey)}.</p>
      {/if}
      <h3 class="kit-section">Sources</h3>
      <p class="muted sources">{item.sources}</p>
    </section>
    <section class="codex-page page-right">
      <span class="kit-stamp">Fiction du jeu</span>
      <h3 class="kit-section">Au camp</h3>
      <p>{item.inGame}</p>
      {#if item.kind === 'monster'}
        <button type="button" class="kit-bronze" data-testid="codex-page-lieutenant" onclick={openLieutenant}>Voir la ruse et la quête</button>
      {/if}
    </section>
  </div>
{/if}

<style>
  /* A framed picture on the left page, like the portal's plates (PortalPanel.svelte). */
  .plate {
    margin: 0 0 14px;
    border: 6px solid #e2cfa4;
    box-shadow:
      0 0 0 1px var(--parchment-edge),
      0 4px 10px rgba(92, 64, 24, 0.3);
    background: rgba(255, 250, 238, 0.6);
  }
  .plate img {
    display: block;
    margin: 0 auto;
    max-width: 100%;
    max-height: 220px;
    object-fit: contain;
  }
  .plate.is-scene img {
    width: 100%;
    object-fit: cover;
  }
  .codex-page h3 {
    margin: 14px 0 8px;
  }
  .codex-page ul {
    margin: 0;
    padding-left: 20px;
  }
  .codex-page p {
    margin: 0 0 8px;
  }
  .sources {
    font-size: 15px;
  }
  .page-right .kit-stamp {
    display: inline-block;
  }
</style>
