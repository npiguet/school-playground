<script lang="ts">
  // A single bestiary page: « Le mythe » (real facts, sourced) kept clearly apart from « Au camp »
  // (the game's fiction) so the child never confuses the two (plan Decision 13). Monster pages
  // stay teaser-only until the world API says the full myth is unlocked; tool/place/boss/companion
  // pages are always open.
  import TopBar from '../components/TopBar.svelte';
  import { entry } from '../lib/world/bestiary';
  import { campStore, refreshCamp } from '../lib/world/campStore.svelte';
  import { pronounFor } from '../lib/world/eris';
  import type { LieutenantKey } from '../lib/world/types';
  import { href } from '../lib/routes';
  import { navigate } from '../lib/router.svelte';
  import type { Profile } from '../lib/types';

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

  function openLieutenant() {
    navigate(href('lieutenant', { profileId, key: entryKey }));
  }
</script>

<TopBar {profile} title={item?.name ?? 'Bestiaire'} />

<div class="screen entry">
  {#if !item}
    <p class="muted">Ce monstre n'existe pas… encore.</p>
  {:else}
    <img src={item.art} alt="" class="art" class:scene-art={item.kind === 'place'} />

    <section>
      <h2>Le mythe</h2>
      {#if unlocked}
        <ul>
          {#each item.facts as fact (fact)}
            <li>{fact}</li>
          {/each}
        </ul>
      {:else}
        <p>{item.teaser}</p>
        <p class="orange">Mythe à débloquer : termine une quête contre {pronounFor(item.key as LieutenantKey)}.</p>
      {/if}
    </section>

    <section>
      <h2>Sources</h2>
      <p class="muted small">{item.sources}</p>
    </section>

    <section class="parchment fiction">
      <span class="chip fiction-chip">Fiction du jeu</span>
      <h2>Au camp</h2>
      <p>{item.inGame}</p>
    </section>

    {#if item.kind === 'monster'}
      <button type="button" class="btn btn-primary" onclick={openLieutenant}>Voir la ruse et la quête</button>
    {/if}
  {/if}
</div>

<style>
  .entry {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .art {
    max-height: 260px;
    object-fit: contain;
    align-self: center;
  }
  .art.scene-art {
    width: 100%;
    max-height: 220px;
    object-fit: cover;
    border-radius: var(--radius);
  }
  .small {
    font-size: 14px;
  }
  .fiction {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .fiction-chip {
    align-self: flex-start;
    background: var(--olive-light);
    border-color: var(--olive);
    color: var(--olive);
    font-weight: 600;
    font-size: 13px;
  }
</style>
