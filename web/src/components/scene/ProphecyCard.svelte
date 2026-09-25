<script lang="ts">
  // The nearest prophecy card (playability #16: the Pythia's words, no « dictée », no « jour(s) »),
  // shared between Camp.svelte's hub column and Delphi's altar (UI3a Task 12): same parchment,
  // wording and « Réviser » button, each caller only positions it differently in its own scene.
  import { prophecyWhen } from '../../lib/world/scenes/camp';
  import type { CampResponse } from '../../lib/world/types';

  let {
    prophecy,
    onReview,
    testId,
  }: {
    prophecy: CampResponse['prophecies'][number];
    onReview: (textId: number) => void;
    testId: string;
  } = $props();
</script>

<div class="kit-parchment prophecy-card" data-testid={testId}>
  <p class="prophecy-card-text">
    <span class="prophecy-card-when">La Pythie a vu ton épreuve, {prophecyWhen(prophecy.days_left)} :</span>
    <span class="prophecy-card-title">{prophecy.title}</span>
  </p>
  <button type="button" class="kit-bronze" onclick={() => onReview(prophecy.text_id)}>Réviser</button>
</div>

<style>
  .prophecy-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 12px;
  }
  .prophecy-card-text {
    flex: 1;
    min-width: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .prophecy-card-when {
    font-style: italic;
    font-size: 13px;
    line-height: 1.25;
  }
  .prophecy-card-title {
    font-weight: 700;
    font-size: 14px;
    line-height: 1.25;
    /* Clamp instead of scroll (Camp.svelte round 1 review): a 120-char title (the server's own
       max, schemas.py) is still just 2 lines. -webkit-line-clamp only clips the box visually - the
       full text stays in the DOM, so it's still exposed in full to assistive tech. */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
  .prophecy-card .kit-bronze {
    flex-shrink: 0;
    padding: 8px 12px;
    font-size: 15px;
  }
</style>
