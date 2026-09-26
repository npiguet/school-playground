<script lang="ts">
  // The victory (UI4 Task 6, Rulings C3, C6, C7): the reckoning on the stage, then the victory sheet
  // on the parchment - the outcome's title under the laurels, the tally, the Muses' status, the
  // spoils, Éris's and the dragon's words, the actions - with the dragon's break nudge on top and the
  // « Revoir » scroll (`?panel=revoir`, Ruling C1) over it all.
  import { untrack } from 'svelte';
  import VictorySheet from './VictorySheet.svelte';
  import VictorySpoils from './VictorySpoils.svelte';
  import ReviewScroll from './ReviewScroll.svelte';
  import DragonNudge from './DragonNudge.svelte';
  import DialogueBox from '../scene/DialogueBox.svelte';
  import { DRAGON_REVIEW_HINT, dragonTally, opponentName, STAGE, VICTORY, victoryTitle } from '../../lib/battle/lines';
  import type { OpponentId } from '../../lib/battle/battle';
  import { outcomeOf, reckoningSteps } from '../../lib/battle/hp';
  import { react, strike } from '../../lib/battle/stage.svelte';
  import { emitBattle } from '../../lib/battle/events';
  import { erisLine } from '../../lib/explain';
  import type { SessionResult } from '../../lib/grading/types';
  import type { PlayState } from '../../lib/playState';
  import { reducedMotion, watchReducedMotion } from '../../lib/juice/motion';
  import { clockReset, playClock } from '../../lib/world/playClock.svelte';
  import { dragonSays } from '../../lib/world/scenes/speakers';
  import type { CampResponse, DragonOut } from '../../lib/world/types';
  import { erisSays } from '../../lib/world/voices';
  import type { DialogueLine } from '../../lib/scene/types';
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
    /** The outcome's title names the opponent. */
    opponent: OpponentId;
    /** `eris` is the boss fight: its final pose waits for the server's verdict. */
    encounter: string | null;
    helpMessage: string | null;
    submitError: string | null;
    submitting: boolean;
    /** The spoils play once, then fold away (a replay needs a fresh one). */
    revealDone: boolean;
    /** « Revoir » is `?panel=revoir` on this URL (Ruling C1). */
    reviewOpen: boolean;
    /** Lieutenant key -> French name, for the spoils' quest and neutralised titles. */
    names: Record<string, string>;
    onReplay: () => void;
    onCamp: () => void;
    onRetry: () => void;
    onReview: () => void;
    onCloseReview: () => void;
  } = $props();

  let reduced = $state(reducedMotion());
  $effect(() => watchReducedMotion((r) => (reduced = r)));

  // UI4 Ruling C3: the reckoning. The hold drops one strike per trap caught (client-side result, so
  // it never waits for the server), then the opponent is routed, pushed back or still standing.
  // For a boss fight the final pose waits for the server's verdict (progression.boss).
  const draft = $derived(result?.draftErrors.length ?? 0);
  const caught = $derived(result?.caught.length ?? 0);
  const bossFight = $derived(encounter === 'eris');
  const verdictReady = $derived(!bossFight || !!playState.progression || !!submitError);
  const outcome = $derived(outcomeOf({ draft, caught }, playState.progression?.boss ?? null));
  let struck = $state(false);

  $effect(() => {
    if (!result) return;
    return untrack(() => {
      const steps = reckoningSteps(draft, caught);
      if (reducedMotion()) {
        // Reduced motion: the final state, without the strike-by-strike animation.
        if (steps.length) strike(steps.at(-1)!);
        struck = true;
        return;
      }
      const timers = steps.map((v, i) => setTimeout(() => strike(v), 500 + i * 380));
      timers.push(setTimeout(() => (struck = true), 500 + steps.length * 380 + 150));
      return () => timers.forEach(clearTimeout);
    });
  });

  $effect(() => {
    if (!struck || !verdictReady) return;
    const o = outcome;
    untrack(() => {
      react('opponent', o === 'rout' ? 'defeat' : o === 'push' ? 'retreat' : 'taunt');
      react('dragon', o === 'standoff' ? 'brace' : 'cheer');
      emitBattle({ kind: 'outcome', outcome: o, caught, missed: Math.max(0, draft - caught) });
    });
  });

  // Before the reckoning ends the title is the opponent's name alone, so nothing jumps.
  const title = $derived(struck && verdictReady ? victoryTitle(outcome, opponent) : opponentName(opponent));
  const pending = $derived(submitting || (!playState.submitted && !submitError));
  const showSpoils = $derived(!!playState.progression && !revealDone);
  const showDialogue = $derived(!pending && !showSpoils);

  // Ruling C7: Éris speaks first (her line, unchanged), then the dragon: the tally, the help-stage
  // message, the « Revoir » hint. Built once per victory (snapshotted when it first shows), so a
  // late help message never restarts the typewriter; once read, the box closes and the actions stay.
  const speaker = $derived(camp?.dragon ?? ({ name: null, stage: 'egg', tint: 'bronze' } as DragonOut));
  const victoryLines = $derived.by(() => {
    if (!result) return [];
    const introduced = result.introduced.length;
    const lines = [erisSays(erisLine(result.catchRate, draft, introduced, mode)), dragonSays(speaker, dragonTally({ draft, caught, mode }))];
    if (helpMessage) lines.push(dragonSays(speaker, helpMessage));
    if (draft + introduced > 0) lines.push(dragonSays(speaker, DRAGON_REVIEW_HINT));
    return lines;
  });
  let spoken = $state<DialogueLine[] | null>(null);
  let talked = $state(false);
  $effect(() => {
    if (showDialogue && !spoken) spoken = untrack(() => victoryLines);
  });
</script>

{#if playClock.needsBreak && result}
  <DragonNudge dragon={camp?.dragon ?? null} onPause={onCamp} onContinue={() => clockReset()} />
{/if}
{#if result}
  <VictorySheet {title} {result} {mode} {reduced} showActions={!pending} {onReview} {onReplay} {onCamp}>
    {#snippet status()}
      {#if pending}
        <p class="kit-ribbon counting" data-testid="battle-status">{VICTORY.counting}</p>
      {/if}
      {#if submitError}
        <div class="kit-note submit-error" data-tone="eris" role="alert">
          <p>{VICTORY.submitError(submitError)}</p>
          <button type="button" class="kit-bronze" disabled={submitting} onclick={onRetry}>
            {submitting ? VICTORY.sending : VICTORY.retry}
          </button>
        </div>
      {/if}
    {/snippet}
    {#snippet spoils()}
      {#if showSpoils && playState.progression}
        <VictorySpoils
          progression={playState.progression}
          {profile}
          dragon={camp?.dragon ?? null}
          {names}
          onDone={() => (revealDone = true)}
        />
      {/if}
    {/snippet}
    {#snippet dialogue()}
      {#if showDialogue && spoken && !talked}
        <div class="victory-dialogue" data-testid="victory-dialogue">
          <DialogueBox dock="fill" lines={spoken} onDone={() => (talked = true)} />
        </div>
      {/if}
    {/snippet}
  </VictorySheet>
  {#if reviewOpen}
    <ReviewScroll reference={text} {result} finalText={playState.current} level={profile.level} onClose={onCloseReview} />
  {/if}
{:else}
  <p class="kit-ribbon counting" data-testid="battle-status">{STAGE.counting}</p>
{/if}

<style>
  .counting {
    display: block;
    width: fit-content;
    margin: 12px auto;
    text-align: center;
  }
  .submit-error {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .submit-error p {
    margin: 0;
    flex: 1 1 16em;
  }
  /* The stage fades its words while an overlay is open (expectOverlayClearsScene): the dialogue too. */
  .victory-dialogue {
    transition: opacity 0.2s ease;
  }
  :global(.battle-stage.has-overlay) .victory-dialogue {
    opacity: 0;
  }
</style>
