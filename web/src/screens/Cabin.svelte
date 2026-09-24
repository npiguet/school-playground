<script lang="ts">
  // The cabin: every reward the game can grant, shown before it's earned (decision 12, ethics -
  // no gamble, nothing hidden). Owned gear and decor can be put on display or away; relics and
  // tints are keepsakes with no toggle of their own (a tint is applied from `DragonScreen`).
  import TopBar from '../components/TopBar.svelte';
  import Medallion from '../components/juice/Medallion.svelte';
  import { ART } from '../lib/world/art';
  import { worldApi } from '../lib/world/api';
  import { campStore, refreshCamp, loadCatalog } from '../lib/world/campStore.svelte';
  import { TINT_FILTERS } from '../lib/world/dragon';
  import type { RewardKind, RewardOut, Tint } from '../lib/world/types';
  import { ApiError } from '../lib/api';
  import type { Profile } from '../lib/types';

  let { profile }: { profile: Profile } = $props();

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

  const FIXED_GLYPHS: Record<string, string> = {
    sandales_hermes: '👟',
    egide: '🛡️',
    foudre_zeus: '⚡',
    'decor:lanterne': '🏮',
    'decor:tapis': '🧶',
    'decor:bibliotheque': '📚',
    'decor:trophee': '🍎',
    'decor:fresque': '🎨',
  };

  function relicGlyph(id: string): string {
    const l = campStore.catalog?.lieutenants.find((x) => x.relic === id);
    return l?.glyph ?? '❔';
  }

  function glyphFor(id: string, kind: RewardKind): string {
    if (kind === 'relic') return relicGlyph(id);
    return FIXED_GLYPHS[id] ?? '❔';
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
    } catch (e) {
      equipError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      equippingId = null;
    }
  }

  // Fixed decor slots over the scene (percent of the scene box), cycled if more than four pieces
  // of decor are equipped at once.
  const DECOR_SLOTS = [
    { top: '18%', left: '12%' },
    { top: '15%', left: '78%' },
    { top: '55%', left: '8%' },
    { top: '58%', left: '82%' },
  ];

  const equippedDecor = $derived((owned ?? []).filter((r) => r.kind === 'decor' && r.equipped));

  const isEmpty = $derived(owned !== null && owned.length === 0);
</script>

<TopBar {profile} title="Ta cabane" />

<div class="screen cabin">
  <div class="scene" style="background-image:url({ART.scenes.camp})">
    {#each equippedDecor as r, i (r.id)}
      {@const slot = DECOR_SLOTS[i % DECOR_SLOTS.length]}
      <div class="decor-pin" style="top:{slot.top};left:{slot.left}">
        <Medallion glyph={glyphFor(r.id, 'decor')} kind="decor" size={48} />
      </div>
    {/each}
    <h1>Ta cabane</h1>
  </div>

  {#if loadError}<p class="orange">{loadError}</p>{/if}
  {#if equipError}<p class="orange" role="alert">{equipError}</p>{/if}

  {#if isEmpty}
    <p class="muted empty-line">
      Ta cabane attend ses premiers trésors. Chaque récompense est annoncée à l'avance : rien n'est tiré au sort.
    </p>
  {/if}

  {#each SECTIONS as section (section.kind)}
    <section>
      <h2>{section.title}</h2>
      <div class="grid">
        {#each itemsFor(section.kind) as item (item.id)}
          {@const rewardRow = ownedById.get(item.id)}
          {@const isOwned = !!rewardRow}
          <div class="card reward-card" class:locked={!isOwned} data-testid="cabin-reward-{item.id}">
            {#if section.kind === 'tint'}
              <span class="tint-circle" style={`filter: ${isOwned ? TINT_FILTERS[tintKey(item.id)] : 'grayscale(1) opacity(.5)'}`}>
                <img src={ART.dragon.egg} alt="" />
              </span>
            {:else}
              <Medallion glyph={glyphFor(item.id, section.kind)} kind={section.kind} locked={!isOwned} />
            {/if}
            <span class="name">{item.name}</span>
            <p class="desc muted">{item.desc}</p>
            {#if !isOwned}
              <p class="source muted">Comment l'obtenir : {item.source}</p>
            {:else if (section.kind === 'gear' || section.kind === 'decor') && rewardRow}
              <button
                type="button"
                class="btn"
                data-testid="cabin-equip-{item.id}"
                disabled={equippingId === item.id}
                onclick={() => toggleEquip(item.id)}
              >
                {rewardRow.equipped ? 'Ranger' : 'Exposer'}
              </button>
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .cabin {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .scene {
    position: relative;
    height: 26vh;
    min-height: 180px;
    display: flex;
    align-items: flex-end;
    padding: 16px;
  }
  .scene h1 {
    position: relative;
    z-index: 1;
    margin: 0;
  }
  .decor-pin {
    position: absolute;
    z-index: 1;
    transform: translate(-50%, -50%);
  }
  .empty-line {
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }
  .reward-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    cursor: default;
  }
  .reward-card.locked {
    opacity: 0.85;
  }
  .name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 15px;
  }
  .desc {
    margin: 0;
    font-size: 13px;
  }
  .source {
    margin: 0;
    font-size: 12px;
  }
  .tint-circle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 3px solid var(--gold);
    background: var(--marble-dark);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .tint-circle img {
    width: 44px;
    height: 44px;
    object-fit: contain;
  }
</style>
