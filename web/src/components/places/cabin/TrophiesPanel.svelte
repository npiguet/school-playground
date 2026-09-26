<script lang="ts">
  // The trophy shelf (UI3 Ruling B6, was the Cabin screen): every reward the game can grant, each
  // in its cubby before it's earned (decision 12, ethics - no gamble, nothing hidden). Owned gear
  // and decor can be put on display or away; relics and tints are keepsakes with no toggle of their
  // own (a tint is applied from the dragon's care, in the nest). Displayed decor hangs on the
  // cabin's walls: the cabin owns the list of rewards (it hangs them) and hands it down; a piece
  // put on display or away goes back up through `onUpdated` (final review M15: one /rewards fetch).
  import Medallion from '../../juice/Medallion.svelte';
  import { ART } from '../../../lib/world/art';
  import { worldApi } from '../../../lib/world/api';
  import { campStore } from '../../../lib/world/campStore.svelte';
  import { eggFilter } from '../../../lib/world/dragon';
  import { MAX_DISPLAYED_DECOR, WALLS_FULL_LINE } from '../../../lib/world/scenes/cabin';
  import { howToWin } from '../../../lib/world/rewards';
  import type { RewardKind, RewardOut, Tint } from '../../../lib/world/types';
  import { ApiError } from '../../../lib/api';
  import type { Profile } from '../../../lib/types';

  // `owned`: null while the cabin's /rewards has not answered; `loadError` when it could not.
  let {
    profile,
    owned,
    loadError = '',
    onUpdated,
  }: { profile: Profile; owned: RewardOut[] | null; loadError?: string; onUpdated: (reward: RewardOut) => void } = $props();

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
  // The walls hold MAX_DISPLAYED_DECOR pieces (UI3b ruling). A fifth « Exposer » stays tappable
  // and says why nothing is hung, instead of being disabled without a word; the server refuses
  // it too (409, the same line).
  let wallsFull = $state(false);
  const displayedDecor = $derived((owned ?? []).filter((r) => r.kind === 'decor' && r.equipped).length);

  async function toggleEquip(id: string) {
    const current = ownedById.get(id);
    if (!current) return;
    equipError = '';
    wallsFull = false;
    if (current.kind === 'decor' && !current.equipped && displayedDecor >= MAX_DISPLAYED_DECOR) {
      wallsFull = true;
      return;
    }
    equippingId = id;
    try {
      const updated = await worldApi.patchReward(profile.id, id, !current.equipped);
      onUpdated(updated);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && current.kind === 'decor') wallsFull = true;
      else equipError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      equippingId = null;
    }
  }

  const isEmpty = $derived(owned !== null && owned.length === 0 && !loadError);
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
      {#if section.kind === 'decor' && wallsFull}
        <p class="kit-note walls-full" role="status" data-testid="cabin-walls-full">{WALLS_FULL_LINE}</p>
      {/if}
      <ul class="cubbies">
        {#each itemsFor(section.kind) as item (item.id)}
          {@const rewardRow = ownedById.get(item.id)}
          {@const isOwned = !!rewardRow}
          <li class="kit-cubby trophy" class:is-empty={!isOwned} data-testid="cabin-reward-{item.id}" data-owned={isOwned ? 'true' : 'false'}>
            {#if section.kind === 'tint'}
              <span class="tint-egg"><img src={ART.dragon.egg} alt="" style={`filter: ${eggFilter(tintKey(item.id), isOwned)}`} /></span>
            {:else}
              <Medallion rewardId={item.id} locked={!isOwned} size={64} />
            {/if}
            <h4 class="trophy-name">{item.name}</h4>
            <p class="trophy-desc">{item.desc}</p>
            {#if !isOwned}
              <p class="trophy-how">{howToWin(item.id, item.source)}</p>
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
     « how to win it » sentence in parchment ink, 14 px (UI3b playability #13: the small gold italic
     was faint on the wood). */
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
    color: var(--parchment-solid);
  }
  /* « Exposer » / « Ranger » sit at the foot of their cubby, level across a row whatever the
     length of the description above. */
  .trophy > .kit-bronze {
    margin-top: auto;
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
