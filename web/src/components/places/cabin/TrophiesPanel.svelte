<script lang="ts">
  // The trophy shelf (UI3 Ruling B6, was the Cabin screen): every reward the game can grant, each
  // in its cubby before it's earned (decision 12, ethics - no gamble, nothing hidden). Owned gear
  // and decor can be put on display or away; trophies and tints are keepsakes with no toggle (a
  // trophy stands on its lieutenant's plinth, spec 2026-09-29 lieutenant levels §5; a tint is applied
  // from the dragon's care, in the nest). Displayed decor hangs on the
  // cabin's walls: the cabin owns the list of rewards (it hangs them) and hands it down; a piece
  // put on display or away goes back up through `onUpdated` (final review M15: one /rewards fetch).
  import Medallion from '../../juice/Medallion.svelte';
  import { ART, trophyIcon } from '../../../lib/world/art';
  import { worldApi } from '../../../lib/world/api';
  import { campStore } from '../../../lib/world/campStore.svelte';
  import { eggFilter } from '../../../lib/world/dragon';
  import { lieutenantName, sleepingLine, isAwake } from '../../../lib/world/eris';
  import { firstSealLine, highestTrophies, sealTitle, sealTitleOf, trophyId } from '../../../lib/world/seals';
  import { rulesOf } from '../../../lib/rules';
  import { WALLS_FULL_LINE } from '../../../lib/world/scenes/cabin';
  import { howToWin } from '../../../lib/world/rewards';
  import { houseDecorTitle, houseEmptyLine } from '../../../lib/world/shop';
  import { LIEUTENANT_ORDER, type House, type LieutenantKey, type RewardKind, type RewardOut, type Tint } from '../../../lib/world/types';
  import { ApiError } from '../../../lib/api';
  import type { Profile } from '../../../lib/types';

  // `owned`: null while the cabin's /rewards has not answered; `loadError` when it could not;
  // `house`: the house the hero lives in, whose name the shelf's own words follow; `maxDecor`: the
  // pieces its walls hold, null while /camp has not said which house it is (the server decides then)
  // (spec 2026-09-29 drachmes §3).
  let {
    profile,
    owned,
    house,
    maxDecor,
    loadError = '',
    onUpdated,
  }: {
    profile: Profile;
    owned: RewardOut[] | null;
    house: House;
    maxDecor: number | null;
    loadError?: string;
    onUpdated: (reward: RewardOut) => void;
  } = $props();

  const ownedById = $derived.by(() => {
    const m = new Map<string, RewardOut>();
    for (const r of owned ?? []) m.set(r.id, r);
    return m;
  });

  const sections: { kind: RewardKind; title: string }[] = $derived([
    { kind: 'gear', title: 'Armes et armures divines' },
    { kind: 'decor', title: houseDecorTitle(house) },
    { kind: 'tint', title: 'Teintes' },
  ]);

  const highest = $derived(highestTrophies(owned ?? []));
  const firstSeal = $derived(firstSealLine(rulesOf(campStore.catalog).levels[0]));
  // The close view: one lieutenant's trophies at a time (R15).
  let openKey = $state<LieutenantKey | null>(null);

  // The close view sits under the whole row, far from its plinth: it takes the focus when it opens
  // (scrolling into view), and its plinth takes the focus back when it closes it. Done in the tap,
  // not on the sheet's removal: WebKit does not focus a tapped button (nothing to remember), and
  // the shelf closing must leave the focus to the overlay's own return.
  function takeFocus(node: HTMLElement) {
    node.focus();
  }

  function togglePlinth(key: LieutenantKey, button: HTMLButtonElement) {
    const closing = openKey === key;
    openKey = closing ? null : key;
    if (closing) button.focus();
  }

  function trophyName(key: LieutenantKey, level: number): string {
    return campStore.catalog?.rewards[trophyId(key, level)]?.name ?? sealTitleOf(key, level);
  }

  function itemsFor(kind: RewardKind): { id: string; name: string; desc: string; source: string }[] {
    return Object.values(campStore.catalog?.rewards ?? {}).filter((r) => r.kind === kind);
  }

  function tintKey(id: string): Tint {
    return id.slice('tint:'.length) as Tint;
  }

  let equippingId = $state<string | null>(null);
  let equipError = $state('');
  // The walls of the house hold `maxDecor` pieces (spec 2026-09-29 drachmes §3). One more « Exposer » stays tappable
  // and says why nothing is hung, instead of being disabled without a word; the server refuses
  // it too (409, the same line).
  let wallsFull = $state(false);
  const displayedDecor = $derived((owned ?? []).filter((r) => r.kind === 'decor' && r.equipped).length);

  async function toggleEquip(id: string) {
    const current = ownedById.get(id);
    if (!current) return;
    equipError = '';
    wallsFull = false;
    if (current.kind === 'decor' && !current.equipped && maxDecor !== null && displayedDecor >= maxDecor) {
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
    <!-- The rest (each reward announced ahead, nothing drawn by lot) is the cabin tour's step 1 (UI5 Ruling E13). -->
    <p class="kit-note">{houseEmptyLine(house)}</p>
  {/if}

  <section data-testid="cabin-trophy-shelf">
    <h3 class="kit-section">Trophées</h3>
    <ul class="cubbies">
      {#each LIEUTENANT_ORDER as key (key)}
        {@const top = highest[key] ?? 0}
        <li class="kit-cubby trophy plinth" class:is-empty={top === 0} data-testid="cabin-trophy-{key}" data-level={top}>
          {#if top > 0}
            <button
              type="button"
              class="plinth-open"
              aria-expanded={openKey === key}
              aria-controls={openKey === key ? `trophy-close-${key}` : undefined}
              onclick={(e) => togglePlinth(key, e.currentTarget)}
            >
              <img class="plinth-art" src={trophyIcon(key, top)} alt="" draggable="false" />
              <span class="trophy-name">{trophyName(key, top)}</span>
            </button>
            <p class="trophy-desc">{sealTitle(top)}</p>
          {:else}
            <span class="plinth-empty" aria-hidden="true"></span>
            <h4 class="trophy-name">{lieutenantName(key)}</h4>
            <p class="trophy-how">{isAwake(key, profile.level) ? firstSeal : sleepingLine(key, profile.level)}</p>
          {/if}
        </li>
      {/each}
    </ul>
    {#if openKey && (highest[openKey] ?? 0) > 0}
      {@const key = openKey}
      {@const top = highest[key] ?? 0}
      <!-- Keyed on the lieutenant, so another plinth's sheet takes the focus too (takeFocus). -->
      {#key key}
      <div
        class="kit-sheet trophy-close"
        id="trophy-close-{key}"
        data-testid="cabin-trophy-close-{key}"
        role="region"
        aria-label={trophyName(key, top)}
        tabindex="-1"
        use:takeFocus
      >
        <img class="close-art" src={trophyIcon(key, top, true)} alt={trophyName(key, top)} draggable="false" />
        <div class="close-words">
          <h4>{trophyName(key, top)}</h4>
          <p>{campStore.catalog?.rewards[trophyId(key, top)]?.desc ?? ''}</p>
          {#if top > 1}
            <p class="lower-title">Aussi sur l'étagère</p>
            <ul class="lower">
              {#each Array.from({ length: top - 1 }, (_, i) => top - 1 - i) as level (level)}
                <li><img src={trophyIcon(key, level)} alt="" draggable="false" /><span>{trophyName(key, level)}</span></li>
              {/each}
            </ul>
          {/if}
        </div>
      </div>
      {/key}
    {/if}
  </section>

  {#each sections as section (section.kind)}
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
  /* A lieutenant's plinth: its highest trophy, a button that opens the close view (R15). */
  .plinth-open {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 4px;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .plinth-open:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .plinth-art {
    width: 88px;
    height: 88px;
    object-fit: contain;
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
  }
  .plinth-empty {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 2px dashed var(--parchment-solid);
    opacity: 0.5;
  }
  .trophy-close {
    display: flex;
    gap: 18px;
    align-items: center;
    margin-top: 16px;
    color: var(--ink);
  }
  .close-art {
    width: min(40%, 256px);
    aspect-ratio: 1;
    object-fit: contain;
  }
  .close-words h4,
  .close-words p {
    margin: 0 0 6px;
  }
  .lower-title {
    font-weight: 600;
  }
  .lower {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .lower li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .lower img {
    width: 40px;
    height: 40px;
    object-fit: contain;
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
