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
  import { agree, sleepingLine } from '../../../lib/world/eris';
  import { romanTier, tricksBeforeEris } from '../../../lib/world/quests';
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
  <!-- Playability #10, re-review N13: the wall's reward and the cabin's next treasure, said once, by
       the Pythia (the wall was the only overlay without a voice). -->
  <OverlayVoice line={VOICES.wall}>
    <span data-testid="board-reward">Chaque monstre défié rapporte {boardXp} XP et une page du bestiaire.</span>
    {#if decor}
      <span data-testid="board-decor">Encore {plural(decor.n, 'quête', 'quêtes')}, et ta cabane gagne un trésor : {decor.name}.</span>
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
            <p class="tablet-note">{sleepingLine(key)}</p>
          {:else}
            {#if l.neutralised}<span class="kit-tablet-stamp">{agree('Neutralisé', key)}</span>{/if}
            {#if l.active_quest_id}
              <span class="kit-tablet-ribbon">Quête en cours</span>
            {:else}
              <!-- Re-review N13: the whole tablet is the target (the button's ::after covers the clay);
                   one word pressed into it. -->
              <button
                type="button"
                class="tablet-defy"
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
          {@const left = tricksBeforeEris(campStore.data)}
          <p>Éris se cache. Neutralise encore {plural(left, 'ruse', 'ruses')} pour la faire sortir.</p>
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
  .tablet-defy {
    margin-top: auto;
    min-height: 48px;
    padding: 4px 22px;
    border: 0;
    border-radius: 8px;
    background: radial-gradient(ellipse at 50% 40%, rgba(92, 40, 20, 0.12), rgba(92, 40, 20, 0.32));
    box-shadow:
      inset 0 3px 6px rgba(92, 40, 20, 0.55),
      0 1px 0 rgba(255, 230, 200, 0.5);
    color: var(--ink);
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    text-shadow: 0 1px 0 rgba(255, 230, 200, 0.55);
    cursor: pointer;
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
