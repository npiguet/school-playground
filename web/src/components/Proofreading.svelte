<script lang="ts">
  // The proofreading screen (spec §3.4) — the main game. The player's text is the only text
  // on screen; the reference is used silently for spotlight mapping, hints and the stage-3
  // count. Help stages: 1 spotlight passes, 2 named passes, 3 error count, 4 nothing.
  import { flushSync, untrack } from 'svelte';
  import TokenText from './TokenText.svelte';
  import WordEditor from './WordEditor.svelte';
  import { activePasses, ARGUS_LABELS, HINTS_PER_STAGE, typedPassSets } from '$lib/argus';
  import { mapAnnotation, reverseAnnotationMap } from '$lib/grading/annotationMap';
  import { errorKey, gradeText } from '$lib/grading/grade';
  import type { Annotation, ArgusPass, GradeResult, TokenError } from '$lib/grading/types';
  import { filExit, filStart, filTap, type FilState, type TypedTextLookup } from '$lib/fil';
  import { savePlayState, type PlayState } from '$lib/playState';
  import { replaceSpan, sentenceSpans } from '$lib/textEdit';
  import type { TextFull } from '$lib/types';

  let {
    reference,
    state: play = $bindable(), // renamed locally: a `state` binding would shadow the $state rune
    helpStage,
    argusOrder,
    trapWords,
    level,
    onDone,
  }: {
    reference: TextFull;
    state: PlayState;
    helpStage: 1 | 2 | 3 | 4;
    argusOrder: ArgusPass[];
    trapWords: string[];
    level: string;
    onDone: () => void;
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
  }

  function exitFil() {
    fil = filExit(fil);
  }

  /** A tap on typed token `typedIndex` while the Fil is active: mapped to the annotation token
   *  its aligned reference token carries (undefined for an unaligned/extra typed word), then
   *  handed to the state machine. Never edits `play.current`. */
  function tapFil(typedIndex: number) {
    const refIndex = refByTyped.get(typedIndex);
    const annotIndex = refIndex !== undefined ? annots[refIndex]?.i : undefined;
    fil = filTap(fil, annotIndex, annotation, typedTextOf);
    play.fil = { drawn: fil.drawn, correct: fil.correct };
  }

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
  let confirmDone = $state(false);

  $effect(() => {
    savePlayState(play);
  });

  // Keep the column sized to the visual viewport so the inline editor stays above the
  // on-screen keyboard (same trick as the dictation screen).
  $effect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--vvh', `${vv?.height ?? window.innerHeight}px`);
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
      root.style.removeProperty('--vvh');
    };
  });

  const subtitle = $derived.by(() => {
    switch (helpStage) {
      case 1:
        return "Les Yeux d'Argus éclairent une catégorie à la fois.";
      case 2:
        return "Relis une catégorie à la fois, comme Argus te l'a appris.";
      case 3: {
        const n = play.initialErrors ?? 0;
        if (n === 0) return "Éris n'a rien trouvé à saboter cette fois. Relis une dernière fois, puis valide.";
        return n === 1 ? '1 piège est caché dans ce texte.' : `${n} pièges sont cachés dans ce texte.`;
      }
      default:
        return 'À toi de jouer. Valide quand tu es sûre.';
    }
  });

  // --- Argus passes -------------------------------------------------------------------

  const isLastPass = $derived(play.passIndex >= passes.length - 1);

  function goToPass(i: number) {
    play.passIndex = Math.max(0, Math.min(passes.length - 1, i));
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
      chouetteMessage = 'La chouette ne voit plus aucun piège.';
      return;
    }
    play.revealedKeys = [...play.revealedKeys, errorKey(next)];
    play.hintsUsed += 1;
    chouetteMessage =
      next.sub === 'missing' || (next.typedIndex === null && next.expected !== null)
        ? "Il manque un mot près d'ici."
        : 'La chouette a repéré un piège ici.';
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
    // Fix round 1 item 4: once a thread is drawn (`done`), tapping any token — including the
    // highlighted verb — exits the Fil and opens the normal word editor for that token, instead
    // of silently starting a new thread from that tap. The Fil only ever drives the state
    // machine while actively picking a verb/subject.
    if (fil.step === 'done') {
      fil = filExit(fil);
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
  }

  // --- Done -----------------------------------------------------------------------------

  function finish() {
    if (helpStage <= 2 && !isLastPass) {
      confirmDone = true;
      return;
    }
    onDone();
  }
</script>

{#snippet editor(index: number)}
  <WordEditor
    value={grade.typedTokens[index]?.text ?? ''}
    onCommit={(v) => commitEdit(index, v)}
    onCancel={cancelEdit}
  />
{/snippet}

<section class="proof" aria-label="Relecture">
  <header class="head">
    <h2>Relecture</h2>
    <p class="subtitle muted">{subtitle}</p>
  </header>

  {#if helpStage <= 2 && activePass}
    <div class="passes" role="group" aria-label="Passes d'Argus">
      <div class="chips">
        {#each passes as pass, i (pass)}
          <button
            type="button"
            class="chip"
            class:chip-active={i === play.passIndex}
            class:chip-done={i < play.passIndex}
            aria-pressed={i === play.passIndex}
            onclick={() => goToPass(i)}
          >
            {i < play.passIndex ? '✓ ' : ''}{ARGUS_LABELS[pass].title}
          </button>
        {/each}
        {#if !isLastPass}
          <button type="button" class="btn next-pass" data-testid="btn-next-pass" onclick={() => goToPass(play.passIndex + 1)}>
            Passe suivante →
          </button>
        {/if}
      </div>
      <p class="pass-hint">{ARGUS_LABELS[activePass].hint}</p>
    </div>
  {/if}

  <div class="tools">
    <button
      type="button"
      class="chip tool"
      class:chip-active={play.bouclier}
      aria-pressed={play.bouclier}
      onclick={toggleBouclier}
    >
      🛡️ Bouclier de Persée
    </button>
    {#if helpStage < 4 && hintsLeft > 0}
      <button type="button" class="chip tool" onclick={useChouette}>🦉 Chouette d'Athéna ({hintsLeft})</button>
    {/if}
    <button
      type="button"
      class="chip tool"
      class:chip-active={fil.step !== 'idle'}
      aria-pressed={fil.step !== 'idle'}
      data-testid="btn-fil"
      onclick={toggleFil}
    >
      🧵 Fil d'Ariane
    </button>
    <button
      type="button"
      class="chip tool"
      class:chip-active={wholeText}
      aria-pressed={wholeText}
      onclick={toggleWholeText}
    >
      ✏️ Modifier tout le texte
    </button>
  </div>

  {#if fil.step !== 'idle'}
    <div class="fil-panel" role="status">
      <p class="fil-message" data-testid="fil-message">{fil.message}</p>
      <button type="button" class="btn" data-testid="btn-fil-exit" onclick={exitFil}>Quitter le fil</button>
    </div>
  {/if}

  {#if play.bouclier && spans.length > 0 && !wholeText}
    <div class="sentence-nav">
      <button
        type="button"
        class="btn"
        disabled={clampSentence(sentenceIndex) === 0}
        onclick={() => moveSentence(-1)}
      >
        ← Phrase précédente
      </button>
      <span class="sentence-pos">
        Phrase {spans.length - clampSentence(sentenceIndex)} sur {spans.length} — en partant de la fin
      </span>
      <button
        type="button"
        class="btn"
        disabled={clampSentence(sentenceIndex) >= spans.length - 1}
        onclick={() => moveSentence(1)}
      >
        Phrase suivante →
      </button>
    </div>
  {/if}

  {#if chouetteMessage}
    <p class="chouette orange" role="status">{chouetteMessage}</p>
  {/if}

  <div class="text">
    {#if wholeText}
      <textarea
        lang="fr"
        {...{ autocorrect: 'off' }}
        autocapitalize="off"
        autocomplete="off"
        spellcheck="false"
        aria-label="Tout le texte"
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

  <footer class="foot">
    {#if confirmDone}
      <p class="confirm">Il reste des passes à faire. Valider quand même ?</p>
      <div class="confirm-actions">
        <button type="button" class="btn btn-primary" onclick={onDone}>Oui, valider</button>
        <button type="button" class="btn" onclick={() => (confirmDone = false)}>Continuer la relecture</button>
      </div>
    {:else}
      <button type="button" class="btn btn-primary done" data-testid="btn-done-proofreading" onclick={finish}>J'ai terminé ma relecture</button>
    {/if}
  </footer>
</section>

<style>
  .proof {
    display: flex;
    flex-direction: column;
    height: var(--vvh, 100dvh);
    max-width: 1100px;
    margin: 0 auto;
    padding: 8px 16px;
    padding-left: calc(16px + env(safe-area-inset-left));
    padding-right: calc(16px + env(safe-area-inset-right));
    gap: 8px;
  }
  .head h2 {
    font-size: 24px;
    margin: 0;
  }
  .subtitle {
    margin: 0;
    font-size: 16px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .chip {
    min-height: 44px;
  }
  .chip-done {
    opacity: 0.7;
  }
  .next-pass {
    min-height: 44px;
    padding: 6px 16px;
    font-size: 16px;
  }
  .pass-hint {
    margin: 6px 0 0;
    font-size: 16px;
    color: var(--aegean);
    font-weight: 600;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tool {
    color: var(--ink);
  }
  .sentence-nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .sentence-nav .btn {
    min-height: 44px;
    padding: 6px 14px;
    font-size: 16px;
  }
  .sentence-nav .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .sentence-pos {
    font-size: 15px;
    color: var(--ink-soft);
    text-align: center;
    flex: 1;
  }
  .chouette {
    margin: 0;
    font-weight: 600;
  }
  .fil-panel {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: var(--aegean-light);
    border: 1px solid var(--aegean);
    border-radius: var(--radius);
    padding: 10px 14px;
  }
  .fil-message {
    margin: 0;
    font-weight: 600;
    color: var(--aegean);
  }
  .text {
    flex: 1;
    min-height: 0;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
    background: #fff;
    border: 1px solid var(--marble-dark);
    border-radius: var(--radius);
    padding: 12px 16px;
  }
  .text textarea {
    display: block;
    width: 100%;
    height: 100%;
    resize: none;
    font-size: 22px;
    line-height: 1.6;
    font-family: var(--font-body);
    padding: 16px;
  }
  .foot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .done {
    width: 100%;
    max-width: 480px;
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
