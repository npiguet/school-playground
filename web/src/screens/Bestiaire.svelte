<script lang="ts">
  // The bestiary grid: real myths behind every monster, tool, place and companion (spec §3.6;
  // plan Decision 13). Monster cards also carry a combat status chip, derived from the world
  // API's per-lieutenant state; when that API isn't reachable yet the grid still renders (every
  // entry shown as locked/undiscovered rather than crashing).
  import TopBar from '../components/TopBar.svelte';
  import { ART } from '../lib/world/art';
  import { BESTIARY, type BestiaryEntry } from '../lib/world/bestiary';
  import { campStore, refreshCamp } from '../lib/world/campStore.svelte';
  import { agree, pronounFor } from '../lib/world/eris';
  import type { LieutenantKey } from '../lib/world/types';
  import { href } from '../lib/routes';
  import { go } from '../lib/scene/panelNav';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

  const profileId = $derived(String(profile.id));

  $effect(() => {
    void refreshCamp(profile.id);
  });

  function lieutenantState(key: string) {
    return campStore.data?.lieutenants.find((l) => l.key === key) ?? null;
  }

  function isUnlocked(e: BestiaryEntry): boolean {
    if (e.kind !== 'monster') return true;
    return lieutenantState(e.key)?.bestiary_unlocked ?? false;
  }

  function statusChip(e: BestiaryEntry): { label: string; cls: string } | null {
    if (e.kind !== 'monster') return null;
    const l = lieutenantState(e.key);
    if (!l) return { label: 'À découvrir', cls: 'muted-chip' };
    if (l.neutralised) return { label: agree('Neutralisé', e.key as LieutenantKey), cls: 'chip-gold' };
    if (l.all_time.traps > 0) return { label: 'En cours', cls: 'chip-aegean' };
    return { label: 'À découvrir', cls: 'muted-chip' };
  }

  function open(key: string) {
    go(href('bestiaire-entry', { profileId, key }));
  }
</script>

<TopBar {profile} title="Bestiaire" />

<div class="screen">
  <p class="subtitle muted">Les vrais mythes derrière chaque ruse d'Éris - et la fiction du camp, bien séparée.</p>

  <div class="grid">
    {#each BESTIARY as e (e.key)}
      {@const unlocked = isUnlocked(e)}
      {@const chip = statusChip(e)}
      <button type="button" class="card bestiary-card" data-testid="bestiary-card-{e.key}" onclick={() => open(e.key)}>
        <img
          src={e.art}
          alt=""
          class="thumb"
          class:locked={!unlocked}
          loading="lazy"
          decoding="async"
        />
        <span class="name">{e.name}</span>
        <span class="teaser muted">{e.teaser}</span>
        {#if chip}
          <span class="chip {chip.cls}">{chip.label}</span>
        {/if}
        {#if e.kind === 'monster' && !unlocked}
          <span class="chip muted-chip" data-testid="bestiary-locked"
            >Mythe à débloquer : termine une quête contre {pronounFor(e.key as LieutenantKey)}</span
          >
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .subtitle {
    margin: 0 0 16px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
  @media (orientation: landscape) and (min-width: 700px) {
    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  .bestiary-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .thumb {
    width: 96px;
    height: 96px;
    object-fit: contain;
    align-self: center;
  }
  .thumb.locked {
    filter: grayscale(0.8) brightness(0.9);
  }
  .name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 17px;
  }
  .teaser {
    font-size: 14px;
  }
  .muted-chip {
    color: var(--ink-soft);
  }
  .chip-gold {
    background: var(--gold-light);
    border-color: var(--gold);
    color: var(--ink);
    font-weight: 600;
  }
  .chip-aegean {
    background: var(--aegean-light);
    border-color: var(--aegean);
    color: var(--aegean);
    font-weight: 600;
  }
</style>
