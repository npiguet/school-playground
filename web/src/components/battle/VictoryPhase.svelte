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
  import { bossFallbackOutcome, outcomeOf, reckoningSteps, reckoningVerdict } from '../../lib/battle/hp';
  import { react, strike } from '../../lib/battle/stage.svelte';
  import { emitBattle } from '../../lib/battle/events';
  import { spokenExplanation, type ExplainContext } from '../../lib/explain';
  import { erisVictoryLine, explainIntro, stillStanding } from '../../lib/dialogue/battle';
  import { EGG } from '../../lib/dialogue/speakers';
  import { frenchSpacing } from '../../lib/text/french';
  import { copyVerdict, per100, rulesOf } from '../../lib/rules';
  import { campStore } from '../../lib/world/campStore.svelte';
  import type { SessionResult } from '../../lib/grading/types';
  import type { PlayState } from '../../lib/playState';
  import { clockReset, playClock } from '../../lib/world/playClock.svelte';
  import { dragonSays } from '../../lib/world/scenes/speakers';
  import type { CampResponse } from '../../lib/world/types';
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
    submitError,
    submitting,
    revealDone = $bindable(),
    names,
    explainCtx,
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
    submitError: string | null;
    submitting: boolean;
    /** The spoils play once, then fold away (a replay needs a fresh one). */
    revealDone: boolean;
    /** Lieutenant key -> French name, for the spoils' quest and seal cards. */
    names: Record<string, string>;
    /** What the dragon's explanations of the traps still standing read (null: no text, none). */
    explainCtx: ExplainContext | null;
    /** Reduced motion, from the stage's one watcher (M15). */
    reduced: boolean;
    onReplay: () => void;
    onCamp: () => void;
    onRetry: () => void;
    /** Opens « Revoir » (`?panel=revoir` on this URL, Ruling C1). */
    onReview: () => void;
  } = $props();


  // UI4 Ruling C3 and spec 2026-09-29 ("the copy is what counts"): the reckoning. The outcome is the
  // copy's verdict for a lieutenant (belle: routed, correcte: pushed back, à reprendre: still
  // standing), the server's win or loss for Éris (progression.boss: a failed submission leaves it
  // pending, never provisional, reckoningVerdict). The hold drops one strike per trap caught, down
  // to where that outcome leaves it (reckoningSteps).
  const draft = $derived(result?.draftErrors.length ?? 0);
  const caught = $derived(result?.caught.length ?? 0);
  const copyOf = $derived.by(() => {
    if (!result) return null;
    const left = result.finalErrors.length;
    return { left, verdict: copyVerdict(per100(left, result.totalWords), rulesOf(campStore.catalog)) };
  });
  // Spec 2026-09-29 §2: the copy line, from the mistakes left in the handed-in text.
  const copy = $derived(result && copyOf ? VICTORY.copy(copyOf.left, result.totalWords, copyOf.verdict) : '');
  const verdict = $derived(
    copyOf ? reckoningVerdict(copyOf.verdict, { bossFight: encounter === 'eris', progression: playState.progression ?? null }) : null,
  );
  let struck = $state(false);
  // The outcome is announced once per mounted victory (a replay remounts it).
  let announced = false;
  // The strikes play once, when the outcome is known (a boss fight's waits for the server).
  let reckoned = false;
  // Cleared when the victory unmounts only (a later change of the verdict must not cut them short).
  let timers: ReturnType<typeof setTimeout>[] = [];
  $effect(() => () => timers.forEach(clearTimeout));

  $effect(() => {
    const o = verdict;
    if (!result || !o || reckoned) return;
    reckoned = true;
    untrack(() => {
      const steps = reckoningSteps(draft, caught, o);
      if (reduced) {
        // Reduced motion: the final state, without the strike-by-strike animation.
        if (steps.length) strike(steps.at(-1)!);
        struck = true;
        return;
      }
      timers = steps.map((v, i) => setTimeout(() => strike(v), 500 + i * 380));
      timers.push(setTimeout(() => (struck = true), 500 + steps.length * 380 + 150));
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

  // Ruling C7, UI5 Ruling E14: Éris answers the reckoning from her lines, then the dragon: the tally, up
  // to two traps still standing (the word, then its explanation), the « Revoir » hint. Built when the
  // dialogue starts (a pick is remembered), never in a $derived. Once read, the box closes and the
  // actions stay. "Caught" and "missed" are said here, at the reckoning, never live (Ruling C3).
  const speaker = $derived(camp?.dragon ?? EGG);
  // Éris's answer, the tally and the explanations, picked once.
  let picked: DialogueLine[] | null = null;
  function victoryLines(): DialogueLine[] {
    if (!result) return [];
    const introduced = result.introduced.length;
    if (!picked) {
      // Spoken once the outcome is known (the dialogue waits for the progression, so a boss's too);
      // a boss fight whose submission failed has none yet and falls back to the fight rule (a boss
      // never has a lieutenant's « push »).
      const outcome =
        verdict ??
        (encounter === 'eris'
          ? bossFallbackOutcome(per100(copyOf?.left ?? 0, result.totalWords), rulesOf(campStore.catalog).fight_max_per_100)
          : outcomeOf(copyOf?.verdict ?? 'reprendre', null));
      picked = [
        erisVictoryLine({ outcome, draft, caught, introduced, mode }),
        dragonSays(speaker, dragonTally({ draft, caught, mode, outcome })),
      ];
      if (explainCtx) {
        for (const e of stillStanding(result.finalErrors, 2)) {
          // Spaced like its intro (a « guillemet » never ends a line alone). UI5 playability #4: the
          // dragon says it in whole sentences; « Revoir »'s cards keep the formula.
          picked.push(explainIntro(e.expected ?? e.typed ?? '', speaker), dragonSays(speaker, frenchSpacing(spokenExplanation(e, explainCtx))));
        }
      }
    }
    const lines = [...picked];
    if (draft + introduced > 0) lines.push(dragonSays(speaker, DRAGON_REVIEW_HINT));
    return lines;
  }
  let spoken = $state<DialogueLine[] | null>(null);
  let talked = $state(false);
  $effect(() => {
    if (!showDialogue || spoken) return;
    untrack(() => {
      spoken = victoryLines();
      dialogueStarted = true;
    });
  });
</script>

{#if result}
  <VictorySheet
    {title}
    {result}
    {copy}
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
