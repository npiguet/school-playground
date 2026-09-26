<script lang="ts">
  // A quest, wherever it appears (Oracle's quest of the week, the board's "En cours"/"Terminées"
  // lists) - title, progress gauge, the reward known in advance, recommended texts and, for an
  // active board quest, a no-penalty "Ranger" (shelve) action with an inline confirm (spec ethics:
  // nothing is ever taken away, so shelving needs no scary warning, just a plain confirmation).
  import Gauge from './juice/Gauge.svelte';
  import Medallion from './juice/Medallion.svelte';
  import { worldApi } from '../lib/world/api';
  import { questProgressLabel, questTitle, rewardLabel } from '../lib/world/quests';
  import type { QuestOut, WorldCatalog } from '../lib/world/types';
  import { ApiError } from '../lib/api';
  import { longDate } from '../lib/text/french';
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
  // One name for the quest wall (Ruling W13): a board quest is a quest « du mur ».
  const kindLabel = $derived(quest.kind === 'board' ? 'Mur' : quest.kind === 'oracle' ? 'Oracle' : 'Éris');
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

<!-- A sheet pinned to the wall (or unrolled by the Pythia): kit objects, no legacy card. -->
<div class="kit-sheet quest-card" data-testid="quest-card-{quest.id}">
  <div class="head">
    <!-- An h4: a quest card sits in a section (h3) of the Pythia or tablets overlay. -->
    <h4 class="title">{title}</h4>
    <span class="quest-kind">{kindLabel}</span>
  </div>

  <Gauge value={gaugeValue} max={gaugeMax} label={progressLabel} />

  <div class="reward-line">
    {#if quest.reward.reward_id}
      <Medallion rewardId={quest.reward.reward_id} size={32} />
    {/if}
    <span>Récompense connue{'\u202f: '}{rewardLabel(quest, catalog)}</span>
  </div>

  {#if quest.status === 'done' && quest.completed_at}
    <p class="quest-done">Terminée le {longDate(quest.completed_at.slice(0, 10))}</p>
  {/if}

  {#if quest.texts.length > 0}
    <div class="texts">
      {#each quest.texts as t (t.id)}
        <a
          class="kit-bronze is-quiet text-btn"
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
        <p>Ranger cette quête{'\u202f? '}Elle ne compte plus, sans rien perdre.</p>
        {#if shelveError}<p class="kit-note" data-tone="eris" role="alert">{shelveError}</p>{/if}
        <div class="confirm-actions">
          <button type="button" class="kit-bronze" disabled={shelving} onclick={confirmShelve}>Oui</button>
          <button type="button" class="kit-bronze is-quiet" disabled={shelving} onclick={() => (confirming = false)}>Non</button>
        </div>
      </div>
    {:else}
      <button type="button" class="kit-link shelve" data-testid="quest-shelve-{quest.id}" onclick={() => (confirming = true)}>
        Ranger
      </button>
    {/if}
  {/if}
</div>

<style>
  .quest-card {
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
  .quest-kind {
    flex-shrink: 0;
    padding: 2px 10px;
    border: 1.5px solid var(--bronze);
    border-radius: 4px;
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--bronze-dark);
  }
  .quest-done {
    margin: 0;
    font-style: italic;
    color: var(--form-ink-soft);
  }
  .reward-line {
    margin: 0;
    font-weight: 600;
    /* Playability #8 (UI1 #13): dark bronze on parchment, gold was below 4.5:1. */
    color: var(--reward-ink);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .texts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  /* A text's title: Alegreya, not the button's Cinzel caps (spec §2.7). */
  .text-btn {
    font-family: var(--font-body);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0;
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
