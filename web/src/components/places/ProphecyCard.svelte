<script lang="ts">
  // The nearest prophecy card (playability #16: the Pythia's words, no « dictée », no « jour(s) »),
  // on Delphi's altar (UI3a Task 12). Since the UI3b hub remap (Ruling B3) the prophecy lives only
  // there; the hub's oracle plaque announces it in its caption.
  // Playability #17: the altar's card is read from the sofa (Alegreya 15/17 px).
  import { prophecyWhen } from '../../lib/world/prophecy';
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
    <!-- A narrow no-break space (&#8239;) before « : » - the colon never wraps onto a line of its own. -->
    <span class="prophecy-card-when">La Pythie a vu ton épreuve, {prophecyWhen(prophecy.days_left)}&#8239;:</span>
    <span class="prophecy-card-title">{prophecy.title}</span>
  </p>
  <button type="button" class="kit-bronze" onclick={() => onReview(prophecy.text_id)}>Te préparer</button>
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
    font-size: 15px;
    line-height: 1.3;
  }
  .prophecy-card-title {
    font-weight: 600;
    font-size: 17px;
    line-height: 1.25;
    /* Clamp instead of scroll (UI1 round 1 review): a 120-char title (the server's own
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
    padding: 8px 14px;
    font-size: 15px;
  }
</style>
