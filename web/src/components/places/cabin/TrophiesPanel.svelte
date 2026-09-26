<script lang="ts">
  // The trophy shelf (UI3 Ruling B6, was the Cabin screen): every reward the game can grant, each
  // in its cubby before it's earned (decision 12, ethics - no gamble, nothing hidden). Owned gear
  // and decor can be put on display or away; relics and tints are keepsakes with no toggle of their
  // own (a tint is applied from the dragon's care, in the nest). Displayed decor hangs on the
  // cabin's walls: `onChange` tells the cabin to re-hang them.
  import Medallion from '../../juice/Medallion.svelte';
  import { ART } from '../../../lib/world/art';
  import { worldApi } from '../../../lib/world/api';
  import { campStore, refreshCamp, loadCatalog } from '../../../lib/world/campStore.svelte';
  import { TINT_FILTERS } from '../../../lib/world/dragon';
  import type { RewardKind, RewardOut, Tint } from '../../../lib/world/types';
  import { ApiError } from '../../../lib/api';
  import type { Profile } from '../../../lib/types';

  let { profile, onChange }: { profile: Profile; onChange?: () => void } = $props();

  let owned = $state<RewardOut[] | null>(null);
  let loadError = $state('');

  async function loadOwned() {
    loadError = '';
    try {
      owned = await worldApi.rewards(profile.id);
    } catch (e) {
      loadError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    }
  }

  $effect(() => {
    void refreshCamp(profile.id);
    void loadCatalog();
    void loadOwned();
  });

  const ownedById = $derived.by(() => {
    const m = new Map<string, RewardOut>();
    for (const r of owned ?? []) m.set(r.id, r);
    return m;
  });

  const SECTIONS: { kind: RewardKind; title: string }[] = [
    { kind: 'relic', title: 'Reliques' },
    { kind: 'gear', title: 'Armes et armures divines' },
    { kind: 'decor', title: 'Objets de la cabane' },
    { kind: 'tint', title: 'Teintes' },
  ];

  function itemsFor(kind: RewardKind): { id: string; name: string; desc: string; source: string }[] {
    return Object.values(campStore.catalog?.rewards ?? {}).filter((r) => r.kind === kind);
  }

  function tintKey(id: string): Tint {
    return id.slice('tint:'.length) as Tint;
  }

  let equippingId = $state<string | null>(null);
  let equipError = $state('');

  async function toggleEquip(id: string) {
    const current = ownedById.get(id);
    if (!current) return;
    equippingId = id;
    equipError = '';
    try {
      const updated = await worldApi.patchReward(profile.id, id, !current.equipped);
      owned = (owned ?? []).map((r) => (r.id === id ? updated : r));
      onChange?.();
    } catch (e) {
      equipError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      equippingId = null;
    }
  }

  const isEmpty = $derived(owned !== null && owned.length === 0);
</script>

<div class="panel-trophies">
  {#if loadError}<p class="kit-note" data-tone="eris">{loadError}</p>{/if}
  {#if equipError}<p class="kit-note" data-tone="eris" role="alert">{equipError}</p>{/if}

  {#if isEmpty}
    <p class="kit-note">Ta cabane attend ses premiers trésors. Chaque récompense est annoncée à l'avance : rien n'est tiré au sort.</p>
  {/if}

  {#each SECTIONS as section (section.kind)}
    <section>
      <h3 class="kit-section">{section.title}</h3>
      <ul class="cubbies">
        {#each itemsFor(section.kind) as item (item.id)}
          {@const rewardRow = ownedById.get(item.id)}
          {@const isOwned = !!rewardRow}
          <li class="kit-cubby trophy" class:is-empty={!isOwned} data-testid="cabin-reward-{item.id}" data-owned={isOwned ? 'true' : 'false'}>
            {#if section.kind === 'tint'}
              <span class="tint-egg" style={`filter: ${isOwned ? TINT_FILTERS[tintKey(item.id)] : 'grayscale(1) opacity(.5)'}`}><img src={ART.dragon.egg} alt="" /></span>
            {:else}
              <Medallion rewardId={item.id} locked={!isOwned} size={64} />
            {/if}
            <h4 class="trophy-name">{item.name}</h4>
            <p class="trophy-desc">{item.desc}</p>
            {#if !isOwned}
              <p class="trophy-how">Comment l'obtenir : {item.source}</p>
            {:else if (section.kind === 'gear' || section.kind === 'decor') && rewardRow}
              <button type="button" class="kit-bronze is-quiet" data-testid="cabin-equip-{item.id}" disabled={equippingId === item.id} onclick={() => toggleEquip(item.id)}>
                {rewardRow.equipped ? 'Ranger' : 'Exposer'}
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .panel-trophies {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .cubbies {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* A cubby of the dark wood: its words in the board's light inks (the table overlay's), the
     « how to win it » line in its gold, as the library shelves write theirs. */
  .trophy {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    padding: 14px 10px;
    cursor: default;
  }
  .trophy.is-empty {
    opacity: 0.9;
  }
  .trophy-name {
    margin: 0;
  }
  .trophy-desc {
    margin: 0;
    font-size: 14px;
  }
  .trophy-how {
    margin: 0;
    font-size: 14px;
    font-style: italic;
    color: var(--gold-light);
  }
  .tint-egg {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 3px solid var(--gold);
    background: var(--marble-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .tint-egg img {
    width: 50px;
    height: 50px;
    object-fit: contain;
  }
</style>
