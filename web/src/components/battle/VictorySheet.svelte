<script lang="ts">
  // The victory sheet (UI4 Ruling C6): a scroll unrolled over the dimmed battlefield, crowned by the
  // laurel wreath, with the outcome's title and the tally at once (never gated on an animation),
  // then what VictoryPhase slots in (the Muses' status, the spoils, the dialogue), and the three
  // actions pinned at its foot as soon as the Muses have counted. The crown is a prop: a painted
  // chest (Task A, on hold) would replace the CSS/SVG wreath there and nowhere else.
  import type { Snippet } from 'svelte';
  import LaurelWreath from './LaurelWreath.svelte';
  import { VICTORY } from '../../lib/battle/lines';
  import type { SessionResult } from '../../lib/grading/types';
  import type { PlayMode } from '../../lib/types';

  let {
    title,
    result,
    mode,
    reduced,
    showActions,
    crown,
    nudge,
    status,
    spoils,
    dialogue,
    onReview,
    onReplay,
    onCamp,
  }: {
    title: string;
    result: SessionResult;
    mode: PlayMode;
    reduced: boolean;
    /** False only while the Muses count: no flow waits on the spoils or the dialogue. */
    showActions: boolean;
    /** Above the title; the laurel wreath by default. */
    crown?: Snippet;
    /** The dragon's break nudge, at the top of the sheet's scrolling body. */
    nudge?: Snippet;
    status?: Snippet;
    spoils?: Snippet;
    dialogue?: Snippet;
    onReview: () => void;
    onReplay: () => void;
    onCamp: () => void;
  } = $props();

  const draft = $derived(result.draftErrors.length);
  const caught = $derived(result.caught.length);
  const rate = $derived(draft > 0 ? caught / draft : null);
  const introduced = $derived(result.introduced.length);
</script>

<article class="victory kit-scroll" data-testid="victory">
  <div class="sheet-body">
    {@render nudge?.()}
    <header class="crown">
      {#if crown}{@render crown()}{:else}<LaurelWreath {reduced} />{/if}
      <h2 class="victory-title" data-testid="victory-title">{title}</h2>
    </header>
    <div class="tally">
      <p class="tally-line" data-testid="results-catch-rate">{draft === 0 ? VICTORY.perfect : VICTORY.caught(caught, draft, rate, mode)}</p>
      <p class="tally-small" data-testid="results-score">{VICTORY.score(result.score)}</p>
      <p class="tally-small">{VICTORY.words(result.correctWords, result.totalWords)}</p>
      {#if result.tools && result.tools.threadsDrawn > 0}<p class="tally-small" data-testid="results-threads">{VICTORY.threads(result.tools.threadsCorrect, result.tools.threadsDrawn)}</p>{/if}
      {#if introduced > 0}<p class="tally-note">{VICTORY.introduced(introduced)}</p>{/if}
    </div>
    {@render status?.()}
    {@render spoils?.()}
    {@render dialogue?.()}
  </div>
  {#if showActions}
    <footer class="actions" data-testid="victory-actions">
      <button type="button" class="kit-bronze" data-testid="battle-revoir" onclick={onReview}>{VICTORY.review}</button>
      <button type="button" class="kit-bronze is-quiet" onclick={onReplay}>{VICTORY.replay}</button>
      <button type="button" class="kit-bronze is-quiet" data-testid="btn-back-camp" onclick={onCamp}>{VICTORY.camp}</button>
    </footer>
  {/if}
</article>

<style>
  /* The sheet fills the parchment between its rods; its body scrolls, the actions stay at the foot. */
  .victory {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin: 18px 22px 16px;
    border-radius: 4px;
    background: var(--grain), var(--battle-text-bg);
    color: var(--ink);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
  }
  .sheet-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px 22px 16px;
  }
  .crown {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  /* A short screen (1280x720, the break nudge on top): a smaller wreath leaves the spoils room. */
  @media (max-height: 760px) {
    .crown :global(.wreath) {
      width: 112px;
      height: 84px;
    }
  }
  .victory-title {
    position: relative;
    margin: 0;
    font-family: var(--font-display);
    font-size: 30px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--reward-ink);
    text-align: center;
  }
  .tally {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
  }
  .tally p {
    margin: 0;
  }
  .tally-line {
    font-family: var(--font-body);
    font-size: 20px;
    font-weight: 600;
  }
  .tally-small {
    font-family: var(--font-body);
    font-size: 16px;
    color: var(--ink-soft);
  }
  .tally-note {
    margin-top: 6px !important;
    max-width: 34em;
    font-family: var(--font-body);
    font-size: 16px;
    font-style: italic;
    color: var(--orange-ink);
  }
  .actions {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    padding: 12px 16px 14px;
    border-top: 1px solid var(--parchment-edge);
  }
</style>
