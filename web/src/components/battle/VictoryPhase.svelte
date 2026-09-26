<script lang="ts">
  // The victory (UI4 Task 6, Rulings C3, C6, C7): the reckoning on the stage, then the victory sheet
  // on the parchment - the outcome's title under the laurels, the tally, the Muses' status, the
  // spoils, Éris's and the dragon's words, the actions - with the dragon's break nudge on top. The
  // « Revoir » scroll (`?panel=revoir`, Ruling C1) it opens is Play's, rendered through the stage's
  // `overlay` snippet, outside the stage that turns inert while it is open.
  import { untrack } from 'svelte';
  import VictorySheet from './VictorySheet.svelte';
  import VictorySpoils from './VictorySpoils.svelte';
  import VictoryChest from './VictoryChest.svelte';
  import LaurelWreath from './LaurelWreath.svelte';
  import DragonNudge from './DragonNudge.svelte';
  import DialogueBox from '../scene/DialogueBox.svelte';
  import { DRAGON_REVIEW_HINT, dragonTally, opponentName, VICTORY, victoryTitle } from '../../lib/battle/lines';
  import type { OpponentId } from '../../lib/battle/battle';
  import { reckoningSteps, reckoningVerdict } from '../../lib/battle/hp';
  import { react, strike } from '../../lib/battle/stage.svelte';
  import { emitBattle } from '../../lib/battle/events';
  import { erisLine } from '../../lib/explain';
  import type { SessionResult } from '../../lib/grading/types';
  import type { PlayState } from '../../lib/playState';
  import { clockReset, playClock } from '../../lib/world/playClock.svelte';
  import { dragonSays } from '../../lib/world/scenes/speakers';
  import type { CampResponse, DragonOut } from '../../lib/world/types';
  import { erisSays } from '../../lib/world/voices';
  import type { DialogueLine } from '../../lib/scene/types';
  import type { PlayMode, Profile } from '../../lib/types';

  let {
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
    names,
    reduced,
    onReplay,
    onCamp,
    onRetry,
    onReview,
  }: {
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
    /** Lieutenant key -> French name, for the spoils' quest and neutralised titles. */
    names: Record<string, string>;
    /** Reduced motion, from the stage's one watcher (M15). */
    reduced: boolean;
    onReplay: () => void;
    onCamp: () => void;
    onRetry: () => void;
    /** Opens « Revoir » (`?panel=revoir` on this URL, Ruling C1). */
    onReview: () => void;
  } = $props();


  // UI4 Ruling C3: the reckoning. The hold drops one strike per trap caught (client-side result, so
  // it never waits for the server), then the opponent is routed, pushed back or still standing.
  // For a boss fight the final pose waits for the server's verdict (progression.boss): a failed
  // submission leaves it pending, never provisional (reckoningVerdict).
  const draft = $derived(result?.draftErrors.length ?? 0);
  const caught = $derived(result?.caught.length ?? 0);
  const verdict = $derived(
    reckoningVerdict({ draft, caught }, { bossFight: encounter === 'eris', progression: playState.progression ?? null }),
  );
  let struck = $state(false);
  // The outcome is announced once per mounted victory (a replay remounts it).
  let announced = false;

  $effect(() => {
    if (!result) return;
    return untrack(() => {
      const steps = reckoningSteps(draft, caught);
      if (reduced) {
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
    const o = verdict;
    if (!struck || !o || announced) return;
    announced = true;
    untrack(() => {
      react('opponent', o === 'rout' ? 'defeat' : o === 'push' ? 'retreat' : 'taunt');
      react('dragon', o === 'standoff' ? 'brace' : 'cheer');
      emitBattle({ kind: 'outcome', outcome: o, caught, missed: Math.max(0, draft - caught) });
    });
  });

  // Before the reckoning ends the title is the opponent's name alone, so nothing jumps.
  const title = $derived(struck && verdict ? victoryTitle(verdict, opponent) : opponentName(opponent));
  const pending = $derived(submitting || (!playState.submitted && !submitError));
  const showSpoils = $derived(!!playState.progression && !revealDone);
  // UI4 Task A: the painted chest replaces the laurel wreath above the tally once the spoils hold a
  // reward; the wreath stays the crown everywhere else (no reward, or the progression hasn't loaded).
  const showChest = $derived((playState.progression?.rewards.length ?? 0) > 0);
  // Once the dialogue has started it stays through a « Réessayer » in flight (fix round 1 #1).
  let dialogueStarted = $state(false);
  const showDialogue = $derived(!showSpoils && (dialogueStarted || !pending));

  // Ruling C7: Éris speaks first (her line, unchanged), then the dragon: the tally, the help-stage
  // message, the « Revoir » hint. Snapshotted when it first shows, so nothing restarts the
  // typewriter mid-line; the help message is the one exception (fix round 1 #1): it arrives with a
  // successful submission, which after a failed one comes later, so the lines are taken again then
  // and the dialogue plays again, help included. Once read, the box closes and the actions stay.
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
  let spokenHelp: string | null = null;
  let talked = $state(false);
  $effect(() => {
    if (!showDialogue || spoken) return;
    untrack(() => {
      spoken = victoryLines;
      spokenHelp = helpMessage;
      dialogueStarted = true;
    });
  });
  $effect(() => {
    const help = helpMessage;
    if (!spoken || help === spokenHelp) return;
    untrack(() => {
      spoken = victoryLines;
      spokenHelp = help;
      talked = false;
    });
  });
</script>

{#if result}
  <VictorySheet
    {title}
    {result}
    {mode}
    {reduced}
    showActions={!pending}
    quietActions={showSpoils || (showDialogue && !!spoken && !talked)}
    {onReview}
    {onReplay}
    {onCamp}
  >
    {#snippet crown()}
      {#if showChest}<VictoryChest {reduced} />{:else}<LaurelWreath {reduced} />{/if}
    {/snippet}
    {#snippet nudge()}
      {#if playClock.needsBreak}
        <DragonNudge dragon={camp?.dragon ?? null} onPause={onCamp} onContinue={() => clockReset()} />
      {/if}
    {/snippet}
    {#snippet status()}
      {#if pending}
        <p class="kit-ribbon counting" data-testid="battle-status" role="status">{VICTORY.counting}</p>
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
          {#key spoken}<DialogueBox dock="fill" lines={spoken} onDone={() => (talked = true)} />{/key}
        </div>
      {/if}
    {/snippet}
  </VictorySheet>
{:else}
  <p class="kit-ribbon counting" data-testid="battle-status" role="status">{VICTORY.counting}</p>
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
