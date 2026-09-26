<script lang="ts">
  // The proofreading on the battle parchment (spec §3.4, §5; UI4 Task 5) — the main game. The
  // player's text is the only text on screen; the reference is used silently for spotlight
  // mapping, hints and the stage-3 count. Help stages: 1 spotlight passes, 2 named passes, 3 error
  // count, 4 nothing. Legibility first (Ruling C12): the text zone is nearly opaque, Literata at
  // 22 px or more. While the keyboard is open (Ruling C4) the header, the Argus strip, the tools
  // and the footer fold into one bar of 48 px icon buttons, so the text keeps its lines. The stage
  // reacts to the tools only, never to an edit (Ruling C3).
  import { flushSync, untrack } from 'svelte';
  import TokenText from './TokenText.svelte';
  import WordEditor from './WordEditor.svelte';
  import Icon from '../ui/Icon.svelte';
  import { TOOL_ICONS } from '$lib/world/art';
  import { PROOF } from '$lib/battle/lines';
  import { react } from '$lib/battle/stage.svelte';
  import { emitBattle } from '$lib/battle/events';
  import { activePasses, ARGUS_LABELS, HINTS_PER_STAGE, typedPassSets } from '$lib/argus';
  import { mapAnnotation, reverseAnnotationMap } from '$lib/grading/annotationMap';
  import { errorKey, gradeText } from '$lib/grading/grade';
  import type { Annotation, ArgusPass, GradeResult, TokenError } from '$lib/grading/types';
  import { filDoneAction, filExit, filStart, filTap, type FilState, type TypedTextLookup } from '$lib/fil';
  import { savePlayState, type PlayState } from '$lib/playState';
  import { replaceSpan, sentenceSpans } from '$lib/textEdit';
  import type { PlayMode, TextFull } from '$lib/types';
  import type { BattleLayout } from '$lib/battle/layout';

  let {
    reference,
    state: play = $bindable(), // renamed locally: a `state` binding would shadow the $state rune
    helpStage,
    argusOrder,
    trapWords,
    level,
    mode = 'dictation',
    layout,
    onDone,
    onQuit,
  }: {
    reference: TextFull;
    state: PlayState;
    helpStage: 1 | 2 | 3 | 4;
    argusOrder: ArgusPass[];
    trapWords: string[];
    level: string;
    /** SP2 Task 9: 'grimoire' swaps the header title and prefixes the stage sentence with Éris's
     *  framing line; the stage-3 count itself is unchanged (always `gradeText`'s own count, never
     *  the plant count - see `freezeInitialErrors` below). */
    mode?: PlayMode;
    /** The stage's layout (UI4 Ruling C4): `compact` folds the controls into one bar. */
    layout: BattleLayout;
    onDone: () => void;
    /** « Quitter » (UI4 Ruling C15): the play state is saved already; Play shows the resume ribbon. */
    onQuit: () => void;
  } = $props();

  const annotation = $derived(reference.annotation as Annotation);
  const passes = $derived(activePasses(argusOrder, trapWords));

  const grade = $derived(gradeText(reference.body, play.current, annotation));
  const passSets = $derived(typedPassSets(grade, annotation, trapWords, level));
  const activePass = $derived(helpStage <= 2 ? passes[play.passIndex] : null);
  // P1-6 (spec §3.4): stage 2 is "named passes without spotlight" — the chips and hint above
  // still name the current pass (`activePass`), but the text itself must not light up. Only
  // stage 1 spotlights; `null` here means TokenText's `.lit`/`.dim` never apply.
  const spotlightPass = $derived(helpStage === 1 ? activePass : null);
  const hintsLeft = $derived(HINTS_PER_STAGE[helpStage] - play.hintsUsed);
  const spans = $derived(sentenceSpans(play.current));

  // --- Fil d'Ariane (spec §3.4: "tap a verb, then its subject") -----------------------
  // `fil` is the pure state machine (`$lib/fil.ts`); everything here just maps between the
  // player's typed-token space (what TokenText renders) and the annotation's token space
  // (what `filTap` reasons about), via the reference token each typed token is aligned to.
  let fil = $state<FilState>(filExit(filStart(play.fil)));

  const annots = $derived(mapAnnotation(grade.refTokens, annotation));
  // annotation token id -> reference token index (for a reference token spaCy actually
  // annotated; unmapped tokens are simply absent). Shared with explain.ts's P1-1 fix rather than
  // hand-rolled here (fix round 1 minor).
  const refByAnnot = $derived(reverseAnnotationMap(annots));
  // reference token index -> typed (player's) token index, via the current alignment.
  const typedByRef = $derived(
    new Map(
      grade.pairs
        .filter((p): p is { refIndex: number; typedIndex: number } => p.refIndex !== null && p.typedIndex !== null)
        .map((p) => [p.refIndex, p.typedIndex] as const),
    ),
  );
  // The inverse of typedByRef: typed token index -> reference token index.
  const refByTyped = $derived(new Map([...typedByRef].map(([r, t]) => [t, r] as const)));

  function annotToTyped(annotIndex: number | null): number | null {
    if (annotIndex === null) return null;
    const refIndex = refByAnnot.get(annotIndex);
    if (refIndex === undefined) return null;
    return typedByRef.get(refIndex) ?? null;
  }

  // Fix round 1 (critical): the Fil's messages must quote the PLAYER's typed words, never the
  // reference spelling — reading `reference.body`/`annotation.tokens[...].text` would hand out
  // the correct answer at every help stage. This resolves an annotation token id to the text of
  // whatever the player actually typed for it right now (or `undefined` if unaligned/deleted).
  const typedTextOf: TypedTextLookup = (annotIndex) => {
    const t = annotToTyped(annotIndex);
    return t === null ? undefined : grade.typedTokens[t]?.text;
  };

  const filVerb = $derived(annotToTyped(fil.highlightVerb));
  const filSubjects = $derived.by(() => {
    const out = new Set<number>();
    for (const a of fil.highlightSubject) {
      const t = annotToTyped(a);
      if (t !== null) out.add(t);
    }
    return out;
  });

  function toggleFil() {
    fil = fil.step === 'idle' ? filStart({ drawn: fil.drawn, correct: fil.correct }) : filExit(fil);
    emitBattle({ kind: 'tool', tool: 'fil' });
  }

  function exitFil() {
    fil = filExit(fil);
  }

  /** A tap on typed token `typedIndex` while the Fil is active: mapped to the annotation token
   *  its aligned reference token carries (undefined for an unaligned/extra typed word), then
   *  handed to the state machine. Never edits `play.current`. */
  function annotIndexOfTyped(typedIndex: number): number | undefined {
    const refIndex = refByTyped.get(typedIndex);
    return refIndex !== undefined ? annots[refIndex]?.i : undefined;
  }

  function tapFil(typedIndex: number) {
    fil = filTap(fil, annotIndexOfTyped(typedIndex), annotation, typedTextOf);
    play.fil = { drawn: fil.drawn, correct: fil.correct };
  }

  // The threaded verb's typed spelling, for the done-state hint (never the reference's).
  const filVerbText = $derived(fil.highlightVerb === null ? '' : typedTextOf(fil.highlightVerb) ?? '');

  // The stage-3 count is frozen at the start of proofreading (plan decision #6): a live
  // count would grade every edit.
  function freezeInitialErrors() {
    if (play.initialErrors === undefined) play.initialErrors = grade.errors.length;
  }
  freezeInitialErrors();

  let editing = $state<number | null>(null);
  let wholeText = $state(false);
  // Bouclier reads last to first, so a fresh mount (including a remount with `play.bouclier`
  // already on after a reload / Safari backgrounding) starts at the last sentence.
  let sentenceIndex = $state(untrack(() => spans.length - 1));
  let chouetteMessage = $state('');
  // The two confirms never show together: opening one closes the other.
  let confirmDone = $state(false);
  let confirmQuit = $state(false);
  const compact = $derived(layout === 'compact');

  $effect(() => {
    savePlayState(play);
  });

  // Keep the edited word in view when the on-screen keyboard resizes the visual viewport. The
  // battle stage sizes the parchment to it (its `watchViewport` owns `--vvh`, UI4 Ruling C4).
  $effect(() => {
    const vv = window.visualViewport;
    const update = () => {
      if (editing !== null) document.activeElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
    };
    untrack(update);
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  });

  const stageSentence = $derived.by(() => {
    switch (helpStage) {
      case 1:
        return PROOF.stage1;
      case 2:
        return PROOF.stage2;
      case 3:
        return PROOF.count(play.initialErrors ?? 0);
      default:
        return PROOF.stage4;
    }
  });
  // SP2 Task 9: the grimoire flow frames every stage sentence with Éris's own line first.
  const subtitle = $derived(mode === 'grimoire' ? `${PROOF.grimoirePrefix} ${stageSentence}` : stageSentence);

  // --- Argus passes -------------------------------------------------------------------

  const isLastPass = $derived(play.passIndex >= passes.length - 1);

  function goToPass(i: number) {
    const next = Math.max(0, Math.min(passes.length - 1, i));
    // A new pass is a step forward for the heroes: the dragon cheers (Ruling C3, neutral).
    if (next > play.passIndex) {
      react('dragon', 'cheer');
      emitBattle({ kind: 'tool', tool: 'argus' });
    }
    play.passIndex = next;
  }

  // --- Bouclier de Persée (one sentence at a time, last to first) ----------------------

  const range = $derived(play.bouclier && spans.length > 0 ? spans[clampSentence(sentenceIndex)] : null);

  function clampSentence(i: number): number {
    return Math.max(0, Math.min(spans.length - 1, i));
  }

  function toggleBouclier() {
    play.bouclier = !play.bouclier;
    if (play.bouclier) sentenceIndex = spans.length - 1;
    editing = null;
    emitBattle({ kind: 'tool', tool: 'bouclier' });
  }

  function moveSentence(delta: number) {
    sentenceIndex = clampSentence(clampSentence(sentenceIndex) + delta);
    editing = null;
  }

  // --- Chouette d'Athéna (hints) --------------------------------------------------------

  /** The typed token to highlight for an error: its own token, or, for a missing word, the
   *  typed token following the anchor (the nearest aligned reference token before the gap). */
  function hintTypedIndex(e: TokenError, g: GradeResult): number | null {
    if (e.typedIndex !== null) return e.typedIndex;
    if (g.typedTokens.length === 0) return null;
    let anchorTyped = -1;
    for (const p of g.pairs) {
      if (p.refIndex === null || p.refIndex > e.anchor) break;
      if (p.typedIndex !== null) anchorTyped = p.typedIndex;
    }
    return Math.min(anchorTyped + 1, g.typedTokens.length - 1);
  }

  const hintedTokenIndexes = $derived.by(() => {
    const revealed = new Set(play.revealedKeys);
    const out = new Set<number>();
    for (const e of grade.errors) {
      if (!revealed.has(errorKey(e))) continue;
      const i = hintTypedIndex(e, grade);
      if (i !== null) out.add(i);
    }
    return out;
  });

  function useChouette() {
    if (hintsLeft <= 0) return;
    const revealed = new Set(play.revealedKeys);
    const next = grade.errors.find((e) => !revealed.has(errorKey(e)));
    if (!next) {
      chouetteMessage = PROOF.owlNone;
      return;
    }
    play.revealedKeys = [...play.revealedKeys, errorKey(next)];
    play.hintsUsed += 1;
    chouetteMessage = next.sub === 'missing' || (next.typedIndex === null && next.expected !== null) ? PROOF.owlMissing : PROOF.owlHere;
    // The owl's hint already shows the spot: the opponent flinches at being seen (Ruling C3).
    react('opponent', 'flinch');
    emitBattle({ kind: 'tool', tool: 'chouette' });
    // In Bouclier mode, jump to the sentence that holds the hinted token.
    const i = hintTypedIndex(next, grade);
    if (play.bouclier && i !== null) {
      const start = grade.typedTokens[i].start;
      const k = spans.findIndex((s) => start >= s.start && start < s.end);
      if (k >= 0) sentenceIndex = k;
    }
  }

  // --- Editing ------------------------------------------------------------------------

  function editToken(index: number) {
    // SP2 playability P1-7: once a thread is drawn (`done`) the Fil stays armed until she taps
    // « Quitter le fil ». A tap on another verb starts a new thread; the threaded verb itself or
    // a non-verb opens the normal word editor for that token while the Fil goes back to picking
    // — it is never silently switched off (the review saw the editor open where she expected a
    // second thread).
    if (fil.step === 'done') {
      if (filDoneAction(fil, annotIndexOfTyped(index), annotation) === 'thread') {
        tapFil(index);
        return;
      }
      fil = filTap(fil, undefined, annotation, typedTextOf); // re-armed, back to pick-verb
      flushSync(() => {
        editing = index;
      });
      return;
    }
    // The Fil never edits text otherwise (spec §3.4): a tap while picking drives the state
    // machine instead of opening the word editor.
    if (fil.step !== 'idle') {
      tapFil(index);
      return;
    }
    // flushSync so the editor mounts (and focuses) inside the tap's user gesture: iOS only
    // opens the keyboard for a focus() that happens synchronously in a gesture handler.
    flushSync(() => {
      editing = index;
    });
  }

  function commitEdit(index: number, value: string) {
    const token = grade.typedTokens[index];
    editing = null;
    if (!token) return;
    const next = replaceSpan(play.current, token.start, token.end, value.trim());
    if (next !== play.current) {
      play.current = next;
      chouetteMessage = '';
    }
  }

  function cancelEdit() {
    editing = null;
  }

  function toggleWholeText() {
    wholeText = !wholeText;
    editing = null;
    emitBattle({ kind: 'tool', tool: 'whole' });
  }

  // --- Done, and the way out (Ruling C15) ------------------------------------------------

  function finish() {
    if (helpStage <= 2 && !isLastPass) {
      confirmQuit = false;
      confirmDone = true;
      return;
    }
    onDone();
  }

  function askQuit() {
    confirmDone = false;
    confirmQuit = true;
  }
</script>

{#snippet editor(index: number)}
  <WordEditor
    value={grade.typedTokens[index]?.text ?? ''}
    onCommit={(v) => commitEdit(index, v)}
    onCancel={cancelEdit}
  />
{/snippet}

<!-- The four tools. Full layout: a painted emblem and its name. Compact: the emblem alone in a 48 px
     button, its name read out (sr-only, not aria-label, so « Tout le texte » labels one field only). -->
{#snippet tools()}
  <div class="tools" data-testid="proof-tools">
    <button type="button" class="kit-bronze is-quiet tool" class:on={play.bouclier} data-testid="btn-bouclier" aria-pressed={play.bouclier} onclick={toggleBouclier}>
      <img class="tool-icon" src={TOOL_ICONS.persee} alt="" /><span class:sr-only={compact}>{PROOF.bouclier}</span>
    </button>
    {#if helpStage < 4 && hintsLeft > 0}
      <button type="button" class="kit-bronze is-quiet tool" data-testid="btn-chouette" onclick={useChouette}>
        <img class="tool-icon" src={TOOL_ICONS.athena} alt="" /><span class:sr-only={compact}>{PROOF.chouette(hintsLeft)}</span>
        {#if compact}<span class="count" aria-hidden="true">{hintsLeft}</span>{/if}
      </button>
    {/if}
    <button type="button" class="kit-bronze is-quiet tool" class:on={fil.step !== 'idle'} data-testid="btn-fil" aria-pressed={fil.step !== 'idle'} onclick={toggleFil}>
      <img class="tool-icon" src={TOOL_ICONS.ariane} alt="" /><span class:sr-only={compact}>{PROOF.fil}</span>
    </button>
    <button type="button" class="kit-bronze is-quiet tool" class:on={wholeText} data-testid="btn-whole" aria-pressed={wholeText} onclick={toggleWholeText}>
      <Icon name="pencil" size={26} /><span class:sr-only={compact}>{PROOF.whole}</span>
    </button>
  </div>
{/snippet}

{#snippet foot()}
  <footer class="foot" data-testid="proof-foot">
    {#if confirmDone}
      <p class="confirm">{PROOF.confirmAsk}</p>
      <div class="confirm-actions">
        <button type="button" class="kit-bronze" onclick={onDone}>{PROOF.confirmYes}</button>
        <button type="button" class="kit-bronze is-quiet" onclick={() => (confirmDone = false)}>{PROOF.confirmNo}</button>
      </div>
    {:else}
      <button type="button" class="kit-bronze cta" data-testid="btn-done-proofreading" onclick={finish}>{PROOF.done}</button>
    {/if}
  </footer>
{/snippet}

<section class="proof" class:compact aria-label={PROOF.title}>
  {#if compact}
    <div class="bar">
      <button type="button" class="kit-bronze is-quiet icon-only" data-testid="btn-quit-proof" aria-label={PROOF.quit} onclick={askQuit}>
        <Icon name="arrow-left" size={22} />
      </button>
      <h2 class="sr-only">{mode === 'grimoire' ? PROOF.grimoireTitle : PROOF.title}</h2>
      {#if helpStage <= 2 && activePass}
        <span class="bar-pass">{ARGUS_LABELS[activePass].title}</span>
        {#if !isLastPass}
          <button type="button" class="kit-bronze is-quiet icon-only" data-testid="btn-next-pass" aria-label={PROOF.nextPass} onclick={() => goToPass(play.passIndex + 1)}>
            <Icon name="arrow-right" size={22} />
          </button>
        {/if}
      {/if}
      {@render tools()}
      {@render foot()}
    </div>
  {:else}
    <header class="head">
      <button type="button" class="kit-bronze is-quiet" data-testid="btn-quit-proof" onclick={askQuit}>
        <Icon name="arrow-left" size={18} />{PROOF.quit}
      </button>
      <div class="titles">
        <h2 class="phase-title">{mode === 'grimoire' ? PROOF.grimoireTitle : PROOF.title}</h2>
        <p class="subtitle">{subtitle}</p>
      </div>
    </header>

    {#if helpStage <= 2 && activePass}
      <div class="argus" role="group" aria-label={PROOF.passes}>
        <div class="argus-row">
          <img class="argus-mark" src={TOOL_ICONS.argus} alt="" />
          {#each passes as pass, i (pass)}
            <button
              type="button"
              class="kit-bronze is-quiet pass"
              class:active={i === play.passIndex}
              class:done={i < play.passIndex}
              data-testid="argus-pass-{pass}"
              aria-pressed={i === play.passIndex}
              onclick={() => goToPass(i)}
            >
              {#if i < play.passIndex}<Icon name="check" size={16} />{/if}{ARGUS_LABELS[pass].title}
            </button>
          {/each}
          {#if !isLastPass}
            <button type="button" class="kit-bronze next-pass" data-testid="btn-next-pass" onclick={() => goToPass(play.passIndex + 1)}>
              {PROOF.nextPass}<Icon name="arrow-right" size={18} />
            </button>
          {/if}
        </div>
        <p class="pass-hint">{ARGUS_LABELS[activePass].hint}</p>
      </div>
    {/if}

    {@render tools()}
  {/if}

  {#if confirmQuit}
    <div class="kit-note confirm-quit" role="status">
      <p>{PROOF.quitAsk}</p>
      <div class="confirm-actions">
        <button type="button" class="kit-bronze" data-testid="btn-quit-proof-confirm" onclick={onQuit}>{PROOF.quitYes}</button>
        <button type="button" class="kit-bronze is-quiet" onclick={() => (confirmQuit = false)}>{PROOF.confirmNo}</button>
      </div>
    </div>
  {/if}

  {#if fil.step !== 'idle'}
    <div class="kit-note fil-panel" data-tone="aegean" role="status">
      <div class="fil-text">
        <p class="fil-message" data-testid="fil-message">{fil.message}</p>
        {#if fil.step === 'done'}
          <p class="fil-next" data-testid="fil-next">{PROOF.filNext(filVerbText)}</p>
        {/if}
      </div>
      <button type="button" class="kit-bronze is-quiet" data-testid="btn-fil-exit" onclick={exitFil}>{PROOF.filExit}</button>
    </div>
  {/if}

  {#if play.bouclier && spans.length > 0 && !wholeText}
    <div class="sentence-nav">
      <button type="button" class="kit-bronze is-quiet" disabled={clampSentence(sentenceIndex) === 0} onclick={() => moveSentence(-1)}>
        <Icon name="arrow-left" size={18} />{PROOF.prevSentence}
      </button>
      <span class="sentence-pos">{PROOF.sentencePos(spans.length - clampSentence(sentenceIndex), spans.length)}</span>
      <button type="button" class="kit-bronze is-quiet" disabled={clampSentence(sentenceIndex) >= spans.length - 1} onclick={() => moveSentence(1)}>
        {PROOF.nextSentence}<Icon name="arrow-right" size={18} />
      </button>
    </div>
  {/if}

  {#if chouetteMessage}
    <p class="kit-note chouette" data-testid="chouette-note" role="status">
      <img class="tool-icon" src={TOOL_ICONS.athena} alt="" />{chouetteMessage}
    </p>
  {/if}

  <div class="text-zone" data-testid="proof-text">
    {#if wholeText}
      <textarea
        lang="fr"
        {...{ autocorrect: 'off' }}
        autocapitalize="off"
        autocomplete="off"
        spellcheck="false"
        aria-label={PROOF.wholeLabel}
        bind:value={play.current}
      ></textarea>
    {:else}
      <TokenText
        text={play.current}
        {passSets}
        activePass={spotlightPass}
        dim={spotlightPass !== null}
        {hintedTokenIndexes}
        {range}
        onEditToken={editToken}
        editingIndex={editing}
        {editor}
        {filVerb}
        {filSubjects}
        filActive={fil.step !== 'idle'}
      />
    {/if}
  </div>

  {#if !compact}{@render foot()}{/if}
</section>

<style>
  .proof {
    --read-size: clamp(22px, 1.9vw, 26px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
    min-height: 0;
    padding: 12px 18px;
    /* Should the notes push past the parchment, the column scrolls rather than squeeze the text
       below its four lines. */
    overflow-y: auto;
    color: var(--ink);
    font-family: var(--font-body);
  }
  /* Compact: the chrome is one bar of 48 px controls, the notes thinner, so a note and four lines
     of text fit above the keyboard without scrolling the bar away. */
  .proof.compact {
    gap: 6px;
    padding: 8px 12px 8px;
  }
  .compact .kit-note {
    padding: 4px 12px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .titles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .phase-title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 24px;
    line-height: 1.15;
    color: var(--ink);
  }
  .subtitle {
    margin: 0;
    font-size: 16px;
    color: var(--ink-soft);
  }
  .bar {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .bar-pass {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 15px;
    color: var(--aegean-ink);
    white-space: nowrap;
  }
  .icon-only {
    padding: 0;
    width: 48px;
  }
  .argus-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .argus-mark {
    width: 34px;
    height: 34px;
    object-fit: contain;
  }
  .pass {
    padding: 8px 14px;
    font-size: 15px;
  }
  .pass.active {
    border-color: var(--gold);
    box-shadow:
      0 0 0 3px var(--gold-light),
      inset 0 1px 0 rgba(255, 240, 200, 0.6);
  }
  .pass.done {
    opacity: 0.75;
  }
  .next-pass {
    padding: 8px 16px;
  }
  .pass-hint {
    margin: 6px 0 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--aegean-ink);
  }
  .tools {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .bar .tools {
    flex-wrap: nowrap;
  }
  .tool {
    position: relative;
    gap: 6px;
    padding: 6px 10px 6px 8px;
    font-family: var(--font-body);
    font-size: 16px;
    letter-spacing: 0;
    color: var(--ink);
  }
  .bar .tool {
    width: 48px;
    padding: 0;
  }
  .tool.on {
    border-color: var(--gold);
    background: linear-gradient(180deg, #fff6d8, #f1dc9a);
    box-shadow: 0 0 0 3px rgba(212, 166, 58, 0.35);
  }
  .tool-icon {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }
  .count {
    position: absolute;
    right: 2px;
    bottom: 1px;
    font-size: 13px;
    font-weight: 700;
    color: var(--bronze-dark);
  }
  .confirm-quit,
  .fil-panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 12px;
  }
  .confirm-quit p {
    margin: 0;
    font-weight: 600;
  }
  .fil-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  .fil-message {
    margin: 0;
    font-weight: 600;
    color: var(--aegean-ink);
  }
  .fil-next {
    margin: 0;
    font-size: 16px;
    color: var(--ink-soft);
  }
  .sentence-nav {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .sentence-pos {
    flex: 1;
    font-size: 16px;
    color: var(--ink-soft);
    text-align: center;
  }
  .chouette {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-weight: 600;
  }
  /* Ruling C12: the text zone. Nearly opaque, never animated over, four lines at the least. */
  .text-zone {
    flex: 1;
    min-height: calc(4 * 1.9 * var(--read-size) + 34px);
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    background: var(--battle-text-bg);
    border: 1px solid var(--parchment-edge);
    border-radius: 10px;
    padding: 16px 22px;
    box-shadow: inset 0 1px 3px rgba(92, 64, 24, 0.18);
  }
  .text-zone :global(.tokens) {
    max-width: 34em;
    margin-inline: auto;
  }
  .compact .text-zone {
    padding: 12px 16px;
  }
  .compact .text-zone :global(.tokens) {
    max-width: none;
  }
  .text-zone textarea {
    display: block;
    width: 100%;
    max-width: 34em;
    height: 100%;
    margin: 0 auto;
    padding: 0;
    resize: none;
    border: 0;
    background: transparent;
    color: var(--ink);
    font: 400 var(--read-size) / 1.9 var(--font-reading);
  }
  .compact .text-zone textarea {
    max-width: none;
  }
  .text-zone textarea:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .foot {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .bar .foot {
    margin-left: auto;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  /* « J'ai terminé ma relecture »: the gold call to action. */
  .cta {
    width: 100%;
    max-width: 480px;
    border-color: #8a6a12;
    background: linear-gradient(180deg, var(--gold-light) 0%, var(--gold) 55%, #9a7a1a 100%);
    color: var(--ink);
    text-shadow: none;
  }
  .bar .cta {
    width: auto;
    white-space: nowrap;
  }
  .confirm {
    margin: 0;
    font-weight: 600;
    text-align: center;
  }
  .confirm-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
</style>
