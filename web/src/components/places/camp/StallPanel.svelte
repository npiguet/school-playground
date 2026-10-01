<script lang="ts">
  // L'étal d'Hermès (spec 2026-09-29 drachmes §2, R10-R12): Hermès at the head of his stall, the purse,
  // and three shelves: the dragon's accessories by lieutenant, the houses, the decor. Every piece is
  // shown ahead with what it waits for (ethics: nothing hidden, nothing drawn by lot); buying asks one
  // question in the piece's own cubby, then Hermès thanks (the overlay's voice, `onBought`). The server
  // decides every purchase; a refusal says why and refreshes the purse (and what is owned).
  import { tick } from 'svelte';
  import { worldApi } from '../../../lib/world/api';
  import { ApiError } from '../../../lib/api';
  import { ART, MARK_ICONS, rewardIcon } from '../../../lib/world/art';
  import { campFor, campStore, refreshCamp } from '../../../lib/world/campStore.svelte';
  import { lieutenantName } from '../../../lib/world/eris';
  import { accessoryPicture } from '../../../lib/world/accessories';
  import { confirmQuestion, drachmesText, kindOfItem, purseLine, stallShelves, type ItemKind, type StallItem } from '../../../lib/world/shop';
  import { playSfx, unlockAudio } from '../../../lib/juice/sfx';
  import type { RewardOut } from '../../../lib/world/types';
  import type { Profile } from '../../../lib/types';

  let { profile, onBought }: { profile: Profile; onBought: (kind: ItemKind) => void } = $props();

  const camp = $derived(campFor(profile.id));
  // What the hero owns: null until /rewards has answered. A failed load never guesses (an empty list
  // would offer « Acheter » on a piece already owned): the shelves wait, the error says why, and
  // « Réessayer » asks again (the panel also asks again each time it opens).
  let owned = $state<RewardOut[] | null>(null);
  let ownedFailed = $state(false);
  let error = $state('');
  const failure = (e: unknown) => (e instanceof ApiError ? e.detail : 'Une erreur est survenue.');
  async function loadOwned(id: number) {
    try {
      const list = await worldApi.rewards(id);
      if (id !== profile.id) return;
      owned = list;
      ownedFailed = false;
    } catch (e) {
      if (id !== profile.id) return;
      if (owned === null) ownedFailed = true;
      error = failure(e);
    }
  }
  function retryOwned() {
    error = '';
    ownedFailed = false;
    void loadOwned(profile.id);
  }
  $effect(() => {
    const id = profile.id;
    owned = null;
    ownedFailed = false;
    void loadOwned(id);
  });
  const ownedIds = $derived(new Set((owned ?? []).map((r) => r.id)));
  const shelves = $derived(
    camp && campStore.catalog && owned ? stallShelves(campStore.catalog.shop, campStore.catalog.rewards, camp, ownedIds, profile.level) : null,
  );

  let asking = $state<string | null>(null);
  let buying = $state(false);
  let list = $state<HTMLElement | undefined>();

  function picture(it: StallItem): string | null {
    const kind = kindOfItem(it.id);
    if (kind === 'house') return it.id === 'house:villa' ? ART.scenes.villa : ART.scenes.palais;
    if (kind === 'decor') return rewardIcon(it.id);
    return accessoryPicture(it.id.slice('accessory:'.length), camp?.dragon.stage ?? 'adult');
  }

  // The question takes the cubby's focus when it opens (R12: no second dialog, the focus stays in place).
  function takeFocus(node: HTMLElement) {
    node.focus();
  }

  // Back to the piece's own cubby once the question is gone (its « Acheter », or the cubby itself).
  async function focusPiece(id: string) {
    await tick();
    const cubby = list?.querySelector<HTMLElement>(`[data-testid="stall-item-${id}"]`);
    (cubby?.querySelector<HTMLElement>('button') ?? cubby)?.focus();
  }

  function ask(it: StallItem) {
    asking = it.id;
    error = '';
  }

  function cancel(it: StallItem) {
    asking = null;
    void focusPiece(it.id);
  }

  async function buy(it: StallItem) {
    buying = true;
    error = '';
    let refused = false;
    try {
      const res = await worldApi.buy(profile.id, it.id);
      owned = [...(owned ?? []), res.reward];
      unlockAudio();
      playSfx('chime');
      onBought(kindOfItem(it.id));
    } catch (e) {
      refused = true;
      error = failure(e);
    }
    // The purse, here and on the HUD, after any answer (review focus 1); after a refusal, what is
    // owned too: another tablet may have bought since the stall opened. The question (its buttons
    // disabled) stays until both have answered, then the focus goes back to the piece as it now is
    // (its « Acheter » if it can still be bought, else the cubby itself), never to the page.
    try {
      await Promise.all([refreshCamp(profile.id), refused ? loadOwned(profile.id) : null]);
    } finally {
      buying = false;
      asking = null;
      await focusPiece(it.id);
    }
  }
</script>

{#snippet piece(it: StallItem)}
  {@const src = picture(it)}
  <li class="kit-cubby stall-item" class:is-empty={it.state === 'locked'} tabindex="-1" data-testid="stall-item-{it.id}" data-state={it.state}>
    {#if src}
      <img class="stall-pic" class:house={kindOfItem(it.id) === 'house'} class:silhouette={it.state === 'locked'} {src} alt="" draggable="false" />
    {:else}
      <span class="stall-pic empty" aria-hidden="true"></span>
    {/if}
    <h4 class="stall-name">{it.name}</h4>
    <p class="stall-price"><img class="coin" src={MARK_ICONS.drachme} alt="" draggable="false" />{drachmesText(it.price)}</p>
    {#if asking === it.id}
      <div class="stall-ask" role="group" aria-labelledby="ask-{it.id}" tabindex="-1" use:takeFocus>
        <p id="ask-{it.id}">{confirmQuestion(it)}</p>
        <button type="button" class="kit-bronze" data-testid="stall-confirm" disabled={buying} onclick={() => buy(it)}>Acheter</button>
        <button type="button" class="kit-bronze is-quiet" data-testid="stall-cancel" disabled={buying} onclick={() => cancel(it)}>Non, merci</button>
      </div>
    {:else if it.state === 'on_sale'}
      <button type="button" class="kit-bronze" data-testid="stall-buy-{it.id}" onclick={() => ask(it)}>Acheter</button>
    {:else}
      <p class="stall-note" data-testid="stall-note-{it.id}">{it.note}</p>
    {/if}
  </li>
{/snippet}

<div class="panel-stall" bind:this={list}>
  <div class="stall-head">
    <img class="hermes" src={ART.characters.hermes} alt="Hermès" draggable="false" />
    {#if camp}<p class="purse" data-testid="stall-purse"><img class="coin" src={MARK_ICONS.drachme} alt="" draggable="false" />{purseLine(camp.drachmes)}</p>{/if}
  </div>
  {#if error}<p class="kit-note" data-tone="eris" role="alert" data-testid="stall-error">{error}</p>{/if}
  {#if ownedFailed}
    <button type="button" class="kit-bronze is-quiet stall-retry" data-testid="stall-retry" onclick={retryOwned}>Réessayer</button>
  {:else if !shelves}
    <p class="kit-note">Hermès déballe ses marchandises…</p>
  {:else}
    <section data-testid="stall-accessories">
      <h3 class="kit-section">Parures du dragon</h3>
      {#each shelves.accessories as group (group.lieutenant)}
        <h4 class="stall-group" data-testid="stall-group-{group.lieutenant}">{lieutenantName(group.lieutenant)}</h4>
        <ul class="cubbies">
          {#each group.items as it (it.id)}{@render piece(it)}{/each}
        </ul>
      {/each}
    </section>
    <section data-testid="stall-houses">
      <h3 class="kit-section">La maison</h3>
      <ul class="cubbies">
        {#each shelves.houses as it (it.id)}{@render piece(it)}{/each}
      </ul>
    </section>
    <section data-testid="stall-decor">
      <h3 class="kit-section">Décor</h3>
      <ul class="cubbies">
        {#each shelves.decor as it (it.id)}{@render piece(it)}{/each}
      </ul>
    </section>
  {/if}
</div>

<style>
  .panel-stall {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .stall-head {
    display: flex;
    align-items: flex-end;
    gap: 18px;
  }
  .hermes {
    height: 180px;
    width: auto;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45));
  }
  .purse,
  .stall-price {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-weight: 700;
  }
  .purse {
    font-size: 20px;
  }
  .coin {
    width: 26px;
    height: 26px;
    object-fit: contain;
  }
  .stall-group {
    margin: 14px 0 8px;
    font-variant: small-caps;
  }
  .cubbies {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  /* A cubby of the dark wood, as on the trophy shelf (TrophiesPanel): its words in the board's
     light inks, what a piece waits for in parchment ink, 14 px. */
  .stall-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }
  .stall-pic {
    width: 96px;
    height: 96px;
    object-fit: contain;
  }
  .stall-pic.house {
    width: 160px;
    height: 90px;
    object-fit: cover;
    border-radius: 4px;
  }
  /* A piece not yet on sale: its dark silhouette (Medallion's), a house's painted room darkened alike. */
  .stall-pic.silhouette {
    filter: brightness(0) opacity(0.55);
  }
  /* A piece whose picture is not painted yet: an empty niche, the trophy shelf's empty plinth. */
  .stall-pic.empty {
    box-sizing: border-box;
    width: 72px;
    height: 72px;
    margin: 12px;
    border-radius: 50%;
    border: 2px dashed var(--parchment-solid);
    opacity: 0.5;
  }
  .stall-name,
  .stall-note,
  .stall-ask p {
    margin: 0;
  }
  .stall-note {
    font-style: italic;
    font-size: 14px;
    color: var(--parchment-solid);
  }
  /* « Acheter » and the note sit at the foot of their cubby, level across a row. */
  .stall-item > .kit-bronze,
  .stall-note,
  .stall-ask {
    margin-top: auto;
  }
  .stall-ask {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  .stall-retry {
    align-self: flex-start;
  }
  .stall-ask:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
</style>
