<script lang="ts">
  // The quest board: quests in progress, a monster to challenge (a board quest), and Éris waiting
  // at the edge of the camp once enough lieutenants are neutralised (spec §3.6, plan Task 7).
  // UI3a Task 12: opened as the votive-tablet wall's overlay over the Delphi scene (Delphi.svelte).
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
  <section>
    <h3 class="kit-section">En cours</h3>
    {#if activeQuests.length === 0}
      <p class="muted">Aucune quête en cours. Défie un monstre ci-dessous ou consulte l'Oracle.</p>
    {:else if campStore.catalog}
      <div class="quest-list">
        {#each activeQuests as q (q.id)}
          <QuestCard quest={q} {names} catalog={campStore.catalog} profileId={profile.id} {onShelve} />
        {/each}
      </div>
    {/if}
  </section>

  <section>
    <h3 class="kit-section">Défier un monstre</h3>
    {#if createError}<p class="orange" role="alert">{createError}</p>{/if}
    <div class="grid">
      {#each LIEUTENANT_ORDER as key (key)}
        {@const l = lieutenantState(key)}
        {@const decor = nextDecor()}
        <div class="card challenge-card" data-testid="board-challenge-{key}">
          <LieutenantBadge lieutenantKey={key} size={48} />
          <span class="name">{names[key] ?? key}</span>
          <p class="technique muted">{technique(key)}</p>
          {#if !l || !l.available}
            <p class="muted">Dort encore à ce niveau.</p>
          {:else}
            {#if l.neutralised}<span class="chip chip-gold">{agree('Neutralisé', key)}</span>{/if}
            {#if l.active_quest_id}<span class="chip chip-aegean">Quête en cours</span>{/if}
            <p class="reward-line">Récompense : {boardXp} XP · page du bestiaire</p>
            {#if decor}<p class="muted decor-line">Encore {plural(decor.n, 'quête', 'quêtes')} avant le prochain trésor de ta cabane : {decor.name}.</p>{/if}
            <button
              type="button"
              class="btn btn-primary"
              disabled={!!l.active_quest_id || creating === key}
              onclick={() => challenge(key)}
            >
              Lancer une quête
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  {#if campStore.data}
    <section>
      <h3 class="kit-section">Éris</h3>
      <div class="parchment eris-panel" data-testid="board-boss">
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
          <button
            type="button"
            class="btn btn-primary"
            onclick={() => go(href('boss', { profileId: String(profile.id) }))}
          >
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
    <details>
      <summary><h3 class="inline-summary kit-section">Terminées</h3></summary>
      {#if doneQuests.length === 0}
        <p class="muted">Aucune quête terminée pour l'instant.</p>
      {:else if campStore.catalog}
        <div class="quest-list">
          {#each doneQuests as q (q.id)}
            <QuestCard quest={q} {names} catalog={campStore.catalog} profileId={profile.id} />
          {/each}
        </div>
      {/if}
    </details>
  </section>

  {#if questsError}<p class="orange">{questsError}</p>{/if}
  {#if loadingQuests && allQuests.length === 0}<p class="muted">Les Muses relisent le tableau…</p>{/if}
</div>

<style>
  .board {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .quest-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
  .challenge-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    cursor: default;
  }
  .name {
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 17px;
  }
  .technique {
    margin: 0;
    font-size: 14px;
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
  .reward-line {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--gold);
  }
  .decor-line {
    margin: 0;
    font-size: 13px;
  }
  .eris-panel {
    padding: 16px;
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
  }
  .inline-summary {
    display: inline;
  }
  summary {
    cursor: pointer;
  }
</style>
