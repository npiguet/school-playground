<script lang="ts">
  // A quest, wherever it appears (Oracle's quest of the week, the board's "En cours"/"Terminées"
  // lists) - title, progress gauge, the reward known in advance, recommended texts and, for an
  // active board quest, a no-penalty "Ranger" (shelve) action with an inline confirm (spec ethics:
  // nothing is ever taken away, so shelving needs no scary warning, just a plain confirmation).
  import Gauge from './juice/Gauge.svelte';
  import Medallion from './juice/Medallion.svelte';
  import { worldApi } from '../lib/world/api';
  import { rewardKindOf } from '../lib/world/art';
  import { questProgressLabel, questTitle, rewardLabel } from '../lib/world/quests';
  import type { QuestOut, WorldCatalog } from '../lib/world/types';
  import { ApiError } from '../lib/api';
  import { formatSwissDate } from '../lib/dates';
  import { href } from '../lib/routes';

  let {
    quest,
    names,
    catalog,
    profileId,
    onShelve,
  }: {
    quest: QuestOut;
    names: Record<string, string>;
    catalog: WorldCatalog;
    profileId: number;
    onShelve?: () => void;
  } = $props();

  const title = $derived(questTitle(quest, names));
  const progressLabel = $derived(questProgressLabel(quest));
  const gaugeValue = $derived(quest.kind === 'boss' ? (quest.status === 'done' ? 1 : 0) : quest.progress.sessions);
  const gaugeMax = $derived(quest.kind === 'boss' ? 1 : (quest.goal.sessions ?? 3));
  const kindLabel = $derived(quest.kind === 'board' ? 'Tableau' : quest.kind === 'oracle' ? 'Oracle' : 'Éris');
  const kindClass = $derived(quest.kind === 'board' ? '' : quest.kind === 'oracle' ? 'chip-gold' : 'chip-violet');
  const shelvable = $derived(quest.kind === 'board' && quest.status === 'active');

  let confirming = $state(false);
  let shelving = $state(false);
  let shelveError = $state('');

  async function confirmShelve() {
    shelving = true;
    shelveError = '';
    try {
      await worldApi.shelveQuest(profileId, quest.id);
      confirming = false;
      onShelve?.();
    } catch (e) {
      shelveError = e instanceof ApiError ? e.detail : 'Une erreur est survenue.';
    } finally {
      shelving = false;
    }
  }
</script>

<div class="parchment quest-card" data-testid="quest-card-{quest.id}">
  <div class="head">
    <h3 class="title">{title}</h3>
    <span class="chip {kindClass}">{kindLabel}</span>
  </div>

  <Gauge value={gaugeValue} max={gaugeMax} label={progressLabel} />

  <p class="reward-line">
    {#if quest.reward.reward_id}
      <Medallion rewardId={quest.reward.reward_id} kind={rewardKindOf(quest.reward.reward_id)} size={32} />
    {/if}
    <span>Récompense connue : {rewardLabel(quest, catalog)}</span>
  </p>

  {#if quest.status === 'done' && quest.completed_at}
    <span class="chip chip-gold">Terminée le {formatSwissDate(quest.completed_at.slice(0, 10))}</span>
  {/if}

  {#if quest.texts.length > 0}
    <div class="texts">
      {#each quest.texts as t (t.id)}
        <a
          class="btn text-btn"
          data-testid="quest-play-{quest.id}-{t.id}"
          href={href('play', { profileId: String(profileId), textId: String(t.id) }, { quest: String(quest.id), encounter: quest.target })}
        >
          {t.title} · {t.level}
        </a>
      {/each}
    </div>
  {/if}

  {#if shelvable}
    {#if confirming}
      <div class="confirm">
        <p>Ranger cette quête ? Elle ne compte plus, sans rien perdre.</p>
        {#if shelveError}<p class="orange" role="alert">{shelveError}</p>{/if}
        <div class="confirm-actions">
          <button type="button" class="btn btn-primary" disabled={shelving} onclick={confirmShelve}>Oui</button>
          <button type="button" class="btn" disabled={shelving} onclick={() => (confirming = false)}>Non</button>
        </div>
      </div>
    {:else}
      <button type="button" class="btn btn-ghost shelve" data-testid="quest-shelve-{quest.id}" onclick={() => (confirming = true)}>
        Ranger
      </button>
    {/if}
  {/if}
</div>

<style>
  .quest-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .title {
    margin: 0;
  }
  .chip-violet {
    background: var(--violet-dark);
    border-color: var(--violet);
    color: var(--marble);
    font-weight: 600;
  }
  .chip-gold {
    background: var(--gold-light);
    border-color: var(--gold);
    color: var(--ink);
    font-weight: 600;
  }
  .reward-line {
    margin: 0;
    font-weight: 600;
    color: var(--gold);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .texts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .text-btn {
    text-decoration: none;
    font-size: 15px;
  }
  .confirm {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .confirm p {
    margin: 0;
  }
  .confirm-actions {
    display: flex;
    gap: 8px;
  }
  .shelve {
    align-self: flex-start;
  }
</style>
