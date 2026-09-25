<script lang="ts">
  // The quest board: quests in progress, a monster to challenge (a board quest), and Éris waiting
  // at the edge of the camp once enough lieutenants are neutralised (spec §3.6, plan Task 7).
  // UI3a Task 12: opened as the votive-tablet wall's overlay over the Delphi scene (Delphi.svelte).
  // Immersion wave (playability #1, #10): six terracotta tablets hang on cords from a peg rail; the
  // wall's reward and the cabin-treasure countdown are said once, never on each tablet.
  import QuestCard from '../../QuestCard.svelte';
  import Medallion from '../../juice/Medallion.svelte';
  import LieutenantBadge from '../../LieutenantBadge.svelte';
  import { worldApi } from '../../../lib/world/api';
  import { campStore, refreshCamp, loadCatalog } from '../../../lib/world/campStore.svelte';
  import { LIEUTENANT_ORDER, type LieutenantKey, type QuestOut } from '../../../lib/world/types';
  import { agree } from '../../../lib/world/eris';
  import { romanTier } from '../../../lib/world/quests';
  import { ApiError } from '../../../lib/api';
  import { href } from '../../../lib/routes';
  import { plural } from '../../../lib/text/french';
  import { go } from '../../../lib/scene/panelNav';
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

  $effect(() => {
    void refreshCamp(profile.id);
    void loadCatalog();
    void loadQuests();
  });

  const activeQuests = $derived(campStore.data?.quests.filter((q) => q.status === 'active') ?? []);
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
    return campStore.data?.lieutenants.find((l) => l.key === key) ?? null;
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

  function bossRewardName(tier: number | null): string {
    if (tier === null) return 'une récompense';
    const rewardId = campStore.catalog?.boss_rewards[String(tier)];
    return (rewardId ? campStore.catalog?.rewards[rewardId]?.name : undefined) ?? 'une récompense';
  }

  function bossRewardId(tier: number | null): string | null {
    if (tier === null) return null;
    return campStore.catalog?.boss_rewards[String(tier)] ?? null;
  }
</script>

<div class="panel-tablets board">
  <!-- Playability #10: what a quest of the wall brings, said once for the whole wall. -->
  <p class="wall-reward" data-testid="board-reward">Chaque quête du mur rapporte {boardXp} XP et une page du bestiaire.</p>

  <section>
    <h3 class="kit-section">En cours</h3>
    {#if activeQuests.length === 0}
      <p class="muted">Aucune quête en cours. Défie un monstre sur le mur, ou va voir la Pythie.</p>
    {:else if campStore.catalog}
      <div class="pinned">
        {#each activeQuests as q (q.id)}
          <QuestCard quest={q} {names} catalog={campStore.catalog} profileId={profile.id} {onShelve} />
        {/each}
      </div>
    {/if}
    {#if decor}
      <p class="decor-line" data-testid="board-decor">Encore {plural(decor.n, 'quête', 'quêtes')} avant le prochain trésor de ta cabane : {decor.name}.</p>
    {/if}
  </section>

  <section>
    <h3 class="kit-section">Défier un monstre</h3>
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
            <p class="tablet-note">Dort encore à ce niveau.</p>
          {:else}
            {#if l.neutralised}<span class="kit-tablet-stamp">{agree('Neutralisé', key)}</span>{/if}
            {#if l.active_quest_id}
              <span class="kit-tablet-ribbon">Quête en cours</span>
            {:else}
              <button type="button" class="kit-bronze" disabled={creating === key} onclick={() => challenge(key)}>Lancer une quête</button>
            {/if}
          {/if}
          </div>
        </li>
      {/each}
    </ul>
  </section>

  {#if campStore.data}
    <section>
      <h3 class="kit-section">Éris</h3>
      <div class="kit-sheet eris-panel" data-testid="board-boss">
        {#if campStore.data.boss.tier_available !== null || campStore.data.boss.active_quest_id !== null}
          {@const rewardId = bossRewardId(campStore.data.boss.tier_available)}
          <div class="boss-reward-line">
            {#if rewardId}<Medallion {rewardId} size={40} />{/if}
            <span>
              Combat {romanTier(campStore.data.boss.tier_available ?? 1)} — récompense : {bossRewardName(
                campStore.data.boss.tier_available,
              )}
            </span>
          </div>
          <button type="button" class="kit-bronze" onclick={() => go(href('boss', { profileId: String(profile.id) }))}>
            Se rendre au bord du camp
          </button>
        {:else if campStore.data.boss.tiers_won.length >= 3}
          <p>Éris est vaincue trois fois. Elle boude.</p>
        {:else}
          {@const available = campStore.data.dragon.available}
          {@const neutralised = campStore.data.dragon.neutralised}
          {@const won = campStore.data.boss.tiers_won.length}
          {@const need = Math.ceil((available * (won + 1)) / 3)}
          <p>Éris se cache. Neutralise encore {plural(Math.max(0, need - neutralised), 'ruse', 'ruses')} pour la faire sortir.</p>
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
  /* Gold on the wood: the one reward line of the wall. */
  .wall-reward {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    color: var(--gold-light);
  }
  .decor-line {
    margin: 12px 0 0;
    font-style: italic;
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
  .eris-panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .eris-panel p {
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
