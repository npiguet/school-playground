<script lang="ts">
  // The trophy shelf (UI3 Ruling B6, was the Cabin screen): every reward the game can grant, each
  // in its cubby before it's earned (decision 12, ethics - no gamble, nothing hidden). Owned gear
  // and decor can be put on display or away; trophies and tints are keepsakes with no toggle (a
  // trophy stands on its lieutenant's plinth, spec 2026-09-29 lieutenant levels §5; a tint is applied
  // from the dragon's care, in the nest). Gear and decor on display stand at their own place in the
  // room (spec 2026-10-02 house treasures, no limit): the room owns the list of rewards and hands it
  // down; a piece put on display or away goes back up through `onUpdated` (final review M15: one
  // /rewards fetch).
  import Medallion from '../../juice/Medallion.svelte';
  import { ART, trophyIcon } from '../../../lib/world/art';
  import { worldApi } from '../../../lib/world/api';
  import { campFor, campStore } from '../../../lib/world/campStore.svelte';
  import { LOCKED_EGG_FILTER } from '../../../lib/world/dragon';
  import { tintedDragon } from '../../../lib/living/stillTint';
  import { lieutenantName, sleepingLine, isAwake } from '../../../lib/world/eris';
  import { MAX_SEAL, highestTrophies, sealHowLine, sealNeedLine, sealTitle, sealTitleOf, trophyId } from '../../../lib/world/seals';
  import { rulesOf } from '../../../lib/rules';
  import { howToEarn, nextFightTier } from '../../../lib/world/rewards';
  import { houseDecorTitle, houseEmptyLine } from '../../../lib/world/shop';
  import { LIEUTENANT_ORDER, type House, type LieutenantKey, type RewardKind, type RewardOut, type Tint } from '../../../lib/world/types';
  import { ApiError } from '../../../lib/api';
  import type { Profile } from '../../../lib/types';

  // `owned`: null while the room's /rewards has not answered; `loadError` when it could not;
  // `house`: the house the hero lives in, whose name the shelf's own words follow (spec 2026-09-29
  // drachmes §3).
  let {
    profile,
    owned,
    house,
    loadError = '',
    onUpdated,
  }: {
    profile: Profile;
    owned: RewardOut[] | null;
    house: House;
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
  const firstNeed = $derived(sealNeedLine(rulesOf(campStore.catalog).levels[0]));
  // Spec 2026-09-29 explanations §4 (R13): the gear of the next fight to win says so.
  const nextTier = $derived(nextFightTier(campFor(profile.id)));
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

  async function toggleEquip(id: string) {
    const current = ownedById.get(id);
    if (!current) return;
    equipError = '';
    equippingId = id;
    try {
      onUpdated(await worldApi.patchReward(profile.id, id, !current.equipped));
    } catch (e) {
      equipError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
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
        {@const awake = isAwake(key, profile.level)}
        <li class="kit-cubby trophy plinth" class:is-empty={top === 0} data-testid="cabin-trophy-{key}" data-level={top}>
          {#if awake || top > 0}
            <!-- Spec 2026-09-29 explanations §4 (R13): every plinth opens its close view, the empty one too:
                 the trophies still to win are shown there, never hidden. -->
            <button
              type="button"
              class="plinth-open"
              data-testid="cabin-trophy-open-{key}"
              aria-expanded={openKey === key}
              aria-controls={openKey === key ? `trophy-close-${key}` : undefined}
              onclick={(e) => togglePlinth(key, e.currentTarget)}
            >
              {#if top > 0}
                <img class="plinth-art" src={trophyIcon(key, top)} alt="" draggable="false" />
                <span class="trophy-name">{trophyName(key, top)}</span>
              {:else}
                <span class="plinth-empty" aria-hidden="true"></span>
                <span class="trophy-name">{lieutenantName(key)}</span>
              {/if}
            </button>
            {#if top > 0}
              <p class="trophy-desc">{sealTitle(top)}</p>
            {:else}
              <p class="trophy-how">{sealHowLine(key, 1)}</p>
              <p class="trophy-need">{firstNeed}</p>
            {/if}
          {:else}
            <span class="plinth-empty" aria-hidden="true"></span>
            <h4 class="trophy-name">{lieutenantName(key)}</h4>
            <p class="trophy-how">{sleepingLine(key, profile.level)}</p>
          {/if}
        </li>
      {/each}
    </ul>
    {#if openKey}
      {@const key = openKey}
      {@const top = highest[key] ?? 0}
      {@const heading = top > 0 ? trophyName(key, top) : lieutenantName(key)}
      <!-- Keyed on the lieutenant, so another plinth's sheet takes the focus too (takeFocus). -->
      {#key key}
      <div
        class="kit-sheet trophy-close"
        id="trophy-close-{key}"
        data-testid="cabin-trophy-close-{key}"
        role="region"
        aria-label={heading}
        tabindex="-1"
        use:takeFocus
      >
        {#if top > 0}
          <img class="close-art" src={trophyIcon(key, top, true)} alt={heading} draggable="false" />
        {/if}
        <div class="close-words">
          <h4>{heading}</h4>
          {#if top > 0}
            <p>{campStore.catalog?.rewards[trophyId(key, top)]?.desc ?? ''}</p>
          {/if}
          {#if top > 1}
            <p class="lower-title">Aussi sur l'étagère</p>
            <ul class="lower">
              {#each Array.from({ length: top - 1 }, (_, i) => top - 1 - i) as level (level)}
                <li><img src={trophyIcon(key, level)} alt="" draggable="false" /><span>{trophyName(key, level)}</span></li>
              {/each}
            </ul>
          {/if}
          {#if top < MAX_SEAL}
            <p class="lower-title">Encore à gagner</p>
            <ul class="lower to-win">
              {#each Array.from({ length: MAX_SEAL - top }, (_, i) => top + 1 + i) as level (level)}
                <li data-testid="cabin-trophy-towin-{key}-{level}">
                  <img class="silhouette" src={trophyIcon(key, level)} alt="" draggable="false" />
                  <span class="to-win-words"><span class="to-win-name">{trophyName(key, level)}</span><span class="to-win-how">{sealHowLine(key, level)}</span></span>
                </li>
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
      <ul class="cubbies">
        {#each itemsFor(section.kind) as item (item.id)}
          {@const rewardRow = ownedById.get(item.id)}
          {@const isOwned = !!rewardRow}
          <li class="kit-cubby trophy" class:is-empty={!isOwned} data-testid="cabin-reward-{item.id}" data-owned={isOwned ? 'true' : 'false'}>
            {#if section.kind === 'tint'}
              <span class="tint-egg"
                ><img
                  use:tintedDragon={{ src: ART.dragon.egg, tint: isOwned ? tintKey(item.id) : 'bronze' }}
                  alt=""
                  style:filter={isOwned ? null : LOCKED_EGG_FILTER}
                /></span
              >
            {:else}
              <Medallion rewardId={item.id} locked={!isOwned} size={64} />
            {/if}
            <h4 class="trophy-name">{item.name}</h4>
            <p class="trophy-desc">{item.desc}</p>
            {#if !isOwned}
              <p class="trophy-how">{howToEarn(item.id, item.source, { nextTier, catalog: campStore.catalog })}</p>
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
  /* One entry per line: the long how-to lines wrapped into a zig-zag of uneven pairs (Task 5 review). */
  .to-win {
    flex-direction: column;
    flex-wrap: nowrap;
  }
  /* R13: a trophy still to win is its painted icon as a dark silhouette, never hidden. */
  .to-win .silhouette {
    width: 40px;
    height: 40px;
    object-fit: contain;
    filter: brightness(0) opacity(0.45);
  }
  .to-win-words {
    display: flex;
    flex-direction: column;
  }
  .to-win-how {
    font-size: 14px;
    color: var(--ink-soft);
  }
  /* What the first seal asks, under its how-to line: on the dark wood, so in the parchment ink too. */
  .trophy-need {
    margin: 0;
    font-size: 14px;
    color: var(--parchment-solid);
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
