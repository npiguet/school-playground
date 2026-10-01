<script lang="ts">
  // The quest board: quests in progress, a monster to challenge (a board quest), and Éris waiting
  // at the edge of the camp once enough seals are won (spec §3.6, plan Task 7).
  // UI3a Task 12: opened as the votive-tablet wall's overlay over the Delphi scene (Delphi.svelte).
  // Immersion wave (playability #1, #10): six terracotta tablets hang on cords from a peg rail; the
  // wall's reward and the cabin-treasure countdown are said once, never on each tablet.
  import QuestCard from '../../QuestCard.svelte';
  import Medallion from '../../juice/Medallion.svelte';
  import LieutenantBadge from '../../LieutenantBadge.svelte';
  import { worldApi } from '../../../lib/world/api';
  import { campFor, campStore, refreshCamp } from '../../../lib/world/campStore.svelte';
  import { LIEUTENANT_ORDER, type LieutenantKey, type QuestOut } from '../../../lib/world/types';
  import { sleepingLine } from '../../../lib/world/eris';
  import { fightLine, sealTitle } from '../../../lib/world/seals';
  import { romanTier } from '../../../lib/world/quests';
  import { bossRewardId, bossRewardName, bossTier } from '../../../lib/world/rewards';
  import { ApiError } from '../../../lib/api';
  import { href } from '../../../lib/routes';
  import { plural } from '../../../lib/text/french';
  import { go } from '../../../lib/scene/panelNav';
  import OverlayVoice from '../../scene/OverlayVoice.svelte';
  import { VOICES } from '../../../lib/world/voices';
  import type { Profile } from '../../../lib/types';

  let { profile }: { profile: Profile } = $props();

  let allQuests = $state<QuestOut[]>([]);
  let loadingQuests = $state(true);
  let questsError = $state('');
  let creating = $state<string | null>(null);
  let createError = $state('');

  async function loadQuests() {
    loadingQuests = true;
    questsError = '';
    try {
      allQuests = await worldApi.quests(profile.id);
    } catch (e) {
      questsError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      loadingQuests = false;
    }
  }

  // Delphi's PlaceScene loads /camp and the catalog (final review M15): the wall only reloads the
  // camp after it has changed something.
  $effect(() => {
    void loadQuests();
  });

  // This hero's snapshot only (final review I2): the store is shared across heroes.
  const camp = $derived(campFor(profile.id));
  const activeQuests = $derived(camp?.quests.filter((q) => q.status === 'active') ?? []);
  const doneQuests = $derived(allQuests.filter((q) => q.status === 'done').slice(0, 10));

  const names = $derived.by(() => {
    const out: Record<string, string> = { eris: 'Éris' };
    for (const l of campStore.catalog?.lieutenants ?? []) out[l.key] = l.name;
    return out;
  });

  function technique(key: LieutenantKey): string {
    return campStore.catalog?.lieutenants.find((l) => l.key === key)?.technique ?? '';
  }

  function lieutenantState(key: LieutenantKey) {
    return camp?.lieutenants.find((l) => l.key === key) ?? null;
  }

  function nextDecor(): { n: number; name: string } | null {
    if (!campStore.catalog) return null;
    const decor = Object.values(campStore.catalog.rewards).filter((r) => r.kind === 'decor' && r.id !== 'decor:fresque');
    const doneBoard = allQuests.filter((q) => q.kind === 'board' && q.status === 'done').length;
    for (let i = 0; i < decor.length; i++) {
      const threshold = (i + 1) * 2;
      if (doneBoard < threshold) return { n: threshold - doneBoard, name: decor[i].name };
    }
    return null;
  }

  async function challenge(key: LieutenantKey) {
    creating = key;
    createError = '';
    try {
      await worldApi.createQuest(profile.id, key);
      await Promise.all([refreshCamp(profile.id), loadQuests()]);
    } catch (e) {
      createError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      creating = null;
    }
  }

  function onShelve() {
    void Promise.all([refreshCamp(profile.id), loadQuests()]);
  }

  const decor = $derived(nextDecor());

  const boardXp = $derived(campStore.catalog?.quest_bonus.board ?? 60);

</script>

<div class="panel-tablets board">
  <!-- Playability #10, re-review N13: the wall's reward and the cabin's next treasure, said once, by
       the Pythia (the wall was the only overlay without a voice). -->
  <OverlayVoice line={VOICES.wall}>
    <span data-testid="board-reward">Chaque monstre défié rapporte {boardXp} XP et une page du bestiaire.</span>
    {#if decor}
      <span data-testid="board-decor">Encore {plural(decor.n, 'quête', 'quêtes')}, et ta cabane gagne un trésor{'\u202f: '}{decor.name}.</span>
    {/if}
  </OverlayVoice>

  <!-- Re-review N13: « En cours » only when a quest is in progress - no empty state above the wall. -->
  {#if activeQuests.length > 0 && campStore.catalog}
    <section data-testid="board-active">
      <h3 class="kit-section">En cours</h3>
      <div class="pinned">
        {#each activeQuests as q (q.id)}
          <QuestCard quest={q} {names} catalog={campStore.catalog} profileId={profile.id} {onShelve} />
        {/each}
      </div>
    </section>
  {/if}

  <section aria-labelledby="wall-title">
    <h3 id="wall-title" class="sr-only">Défier un monstre</h3>
    {#if createError}<p class="kit-note" data-tone="eris" role="alert">{createError}</p>{/if}
    <ul class="wall">
      {#each LIEUTENANT_ORDER as key (key)}
        {@const l = lieutenantState(key)}
        {@const asleep = !l || !l.available}
        <!-- The peg carries its stretch of rail outside the clay, so a sleeping tablet's grey
             filter never dims the rail (review fix round 1). -->
        <li class="peg" data-testid="board-challenge-{key}">
          <span class="rail" aria-hidden="true"></span>
          <div class="kit-tablet" class:is-asleep={asleep}>
          <span class="pressed"><LieutenantBadge lieutenantKey={key} size={64} /></span>
          <h4 class="tablet-name">{names[key] ?? key}</h4>
          <p class="tablet-technique">{technique(key)}</p>
          {#if asleep}
            <p class="tablet-note">{sleepingLine(key, profile.level)}</p>
          {:else}
            {#if l.level > 0}<span class="kit-tablet-stamp">{sealTitle(l.level)}</span>{/if}
            {#if l.active_quest_id}
              <span class="kit-tablet-ribbon">Quête en cours</span>
            {:else}
              <!-- Re-review N13: the whole tablet is the target (the button's ::after covers the clay);
                   one word pressed into it. -->
              <button
                type="button"
                class="kit-bronze tablet-defy"
                aria-label="Défier {names[key] ?? key}"
                disabled={creating === key}
                onclick={() => challenge(key)}>Défier</button
              >
            {/if}
          {/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>

  {#if camp}
    <section>
      <h3 class="kit-section">Éris</h3>
      <div class="kit-sheet boss-sheet" data-testid="board-boss">
        {#if camp.boss.tier_available !== null || camp.boss.active_quest_id !== null}
          {@const tier = bossTier(camp)}
          {@const rewardId = bossRewardId(tier, campStore.catalog)}
          <div class="boss-reward-line">
            {#if rewardId}<Medallion {rewardId} size={40} />{/if}
            <span data-testid="board-boss-reward">
              Combat {romanTier(tier ?? 1)} — récompense{'\u202f: '}{bossRewardName(tier, campStore.catalog)}
            </span>
          </div>
          <button type="button" class="kit-bronze" onclick={() => go(href('boss', { profileId: String(profile.id) }))}>
            Se rendre au bord du camp
          </button>
        {:else if camp.boss.next}
          <p>{fightLine(camp.boss.next)}</p>
        {:else}
          <p>Éris est vaincue à chaque combat. Elle boude.</p>
        {/if}
      </div>
    </section>
  {/if}

  <section>
    <details class="done">
      <summary class="kit-bronze is-quiet">Quêtes terminées</summary>
      {#if doneQuests.length === 0}
        <p class="muted">Aucune quête terminée pour l'instant.</p>
      {:else if campStore.catalog}
        <div class="pinned">
          {#each doneQuests as q (q.id)}
            <QuestCard quest={q} {names} catalog={campStore.catalog} profileId={profile.id} />
          {/each}
        </div>
      {/if}
    </details>
  </section>

  {#if questsError}<p class="kit-note" data-tone="eris">{questsError}</p>{/if}
  {#if loadingQuests && allQuests.length === 0}<p class="muted">Les Muses relisent le mur…</p>{/if}
</div>

<style>
  .board {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .board h3 {
    margin: 0 0 10px;
  }
  /* « Défier » pressed into the clay: a recessed word, not a bronze slab. Its ::after spans the
     whole tablet (the tablet is the positioned box), so a tap anywhere on the clay challenges. */
  /* UI3b playability #23: the game's bronze button (.kit-bronze), the clay stays the tablet's; the
     recessed tan word looked disabled. No transform on press and no filter on hover: either would
     make the button the containing block of its ::after, the tablet's hit area, and shrink it. */
  .tablet-defy {
    margin-top: auto;
    padding: 6px 24px;
    font-size: 17px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .tablet-defy:active,
  .tablet-defy:hover {
    transform: none;
    filter: none;
  }
  .tablet-defy::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 46% 46% 10px 10px / 18% 18% 10px 10px;
  }
  .tablet-defy:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .tablet-defy:focus-visible {
    outline: none;
  }
  .tablet-defy:focus-visible::after {
    outline: 3px solid var(--gold-light);
    outline-offset: 3px;
  }
  .pinned {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  /* The wall: a bronze peg rail over each row, six tablets hung from it by their cords. */
  .wall {
    list-style: none;
    margin: 0;
    padding: 6px 0 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px 22px;
  }
  /* Each peg carries its stretch of the rail, half the gap wide on either side, so a row's
     stretches meet into one rail whatever the number of rows; the tablet's cord (::after, 34 px
     above the clay) ties over it. */
  .peg {
    position: relative;
    display: flex;
    flex-direction: column;
  }
  .peg > .kit-tablet {
    flex: 1;
  }
  .rail {
    position: absolute;
    z-index: 0;
    top: -3px;
    left: -11px;
    right: -11px;
    height: 6px;
    background: linear-gradient(180deg, #c89450, #7a5230 60%, #4e321b);
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.45);
  }
  /* On clay, not on the wood: the tablet's own ink. The table's gold headings rule
     (Overlay.svelte, 0-4-1) is outranked here (0-6-0). */
  .wall .kit-tablet .tablet-name {
    margin: 0;
    font-family: var(--font-display);
    font-size: 17px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink);
    text-shadow: none;
  }
  .tablet-technique,
  .tablet-note {
    margin: 0;
    font-size: 15px;
    line-height: 1.35;
  }
  .tablet-note {
    font-style: italic;
  }
  .boss-sheet {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .boss-sheet p {
    margin: 0;
  }
  .boss-reward-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    color: var(--reward-ink);
  }
  .done summary {
    list-style: none;
  }
  .done summary::-webkit-details-marker {
    display: none;
  }
  .done[open] summary {
    margin-bottom: 14px;
  }
  @media (max-width: 900px) {
    .wall {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
