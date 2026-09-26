<script lang="ts">
  // The victory (UI4 Task 2): what Play showed after the proofreading - the break nudge, the
  // progression reveal and the results, or the Muses' waiting line - moved as it was onto the battle
  // stage's parchment. Task 6 turns it into the victory sheet, the reckoning and the « Revoir »
  // scroll; the props it needs for that are wired now so the lane never edits Play.
  import Results from '../Results.svelte';
  import BreakNudge from '../BreakNudge.svelte';
  import ProgressionReveal from '../ProgressionReveal.svelte';
  import { STAGE } from '../../lib/battle/lines';
  import type { OpponentId } from '../../lib/battle/battle';
  import type { SessionResult } from '../../lib/grading/types';
  import type { PlayState } from '../../lib/playState';
  import { clockReset, playClock } from '../../lib/world/playClock.svelte';
  import type { CampResponse } from '../../lib/world/types';
  import type { PlayMode, Profile, TextFull } from '../../lib/types';

  let {
    text,
    result,
    playState,
    profile,
    camp,
    mode,
    opponent,
    encounter,
    helpMessage,
    submitError,
    submitting,
    revealDone = $bindable(),
    reviewOpen,
    names,
    onReplay,
    onCamp,
    onRetry,
    onReview,
    onCloseReview,
  }: {
    text: TextFull;
    /** Null while the Muses count (the grading has not run yet). */
    result: SessionResult | null;
    playState: PlayState;
    profile: Profile;
    camp: CampResponse | null;
    mode: PlayMode;
    /** Task 6: the outcome's title and the dialogue name the opponent. */
    opponent: OpponentId;
    /** Task 6: the boss's outcome lines. */
    encounter: string | null;
    helpMessage: string | null;
    submitError: string | null;
    submitting: boolean;
    /** The progression reveal plays once, then folds away (a replay needs a fresh one). */
    revealDone: boolean;
    /** Task 6: « Revoir » is `?panel=revoir` on this URL (Ruling C1). */
    reviewOpen: boolean;
    /** Lieutenant key -> French name, for the reveal's quest and neutralised titles. */
    names: Record<string, string>;
    onReplay: () => void;
    onCamp: () => void;
    onRetry: () => void;
    onReview: () => void;
    onCloseReview: () => void;
  } = $props();
</script>

<div class="victory">
  {#if result}
    {#if playClock.needsBreak}
      <BreakNudge dragon={camp?.dragon ?? null} onPause={onCamp} onContinue={() => clockReset()} />
    {/if}
    {#if playState.progression && !revealDone}
      <ProgressionReveal
        progression={playState.progression}
        {profile}
        dragon={camp?.dragon ?? null}
        {names}
        onDone={() => (revealDone = true)}
      />
    {/if}
    <Results
      reference={text}
      {result}
      finalText={playState.current}
      {helpMessage}
      {submitError}
      {submitting}
      level={profile.level}
      {mode}
      {onReplay}
      {onCamp}
      {onRetry}
    />
  {:else}
    <p class="kit-ribbon counting" data-testid="battle-status">{STAGE.counting}</p>
  {/if}
</div>

<style>
  /* The parchment has a fixed height (the stage's); the victory scrolls inside it. */
  .victory {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .victory :global(.screen) {
    min-height: 0;
  }
  .counting {
    display: block;
    width: fit-content;
    margin: 24px auto;
    text-align: center;
  }
</style>
