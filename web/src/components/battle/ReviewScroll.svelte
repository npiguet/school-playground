<script lang="ts">
  // The « Revoir » scroll (UI4 Ruling C6, spec §3.5, §1.6): the old results screen's text and
  // explanations, unrolled over the victory (`?panel=revoir`, Ruling C1). Every trap on the final
  // text, tap for the correct form and why; then what Éris tried, by category. Orange for
  // still-wrong words, the laurel's green for words she caught and fixed herself - never red. The
  // tally, Éris's line, the help message and the actions live on the victory sheet.
  import { errorKey, gradeText, mapAnnotation } from '$lib/grading';
  import type { Annotation, SessionResult, StatKey, TokenError } from '$lib/grading/types';
  import { CATEGORY_LABELS, caughtText, explain, statKeyOf } from '$lib/explain';
  import type { TextFull } from '$lib/types';
  import Overlay from '../scene/Overlay.svelte';
  import Icon from '../ui/Icon.svelte';
  import { VICTORY } from '../../lib/battle/lines';

  let {
    reference,
    result,
    finalText,
    level,
    onClose,
  }: {
    reference: TextFull;
    result: SessionResult;
    finalText: string;
    /** The player's HarmoS level (SP2 Task 7): threaded into `ExplainContext` so the
     *  participle_avoir chain explanation only shows from 9H (spec §3.4). */
    level: string;
    onClose: () => void;
  } = $props();

  const annotation = $derived(reference.annotation as Annotation);
  // Recomputed locally (pure function of reference + finalText): gives the token layout and the
  // reference<->final alignment this scroll needs to place caught/missing markers, independent
  // of what Play.svelte already computed in `result`.
  const grade = $derived(gradeText(reference.body, finalText, annotation));
  const annots = $derived(mapAnnotation(grade.refTokens, annotation));
  const ctx = $derived({ refTokens: grade.refTokens, annots, annotation, level, body: reference.body });

  // Maps a reference token index to its aligned position in the FINAL text's tokens, so a caught
  // draft error (whose own typedIndex points into the draft, not the final) and a missing-word
  // error's anchor can both be placed in the rendered final text.
  const finalPosByRef = $derived.by(() => {
    const m = new Map<number, number>();
    for (const p of grade.pairs) if (p.refIndex !== null && p.typedIndex !== null) m.set(p.refIndex, p.typedIndex);
    return m;
  });

  const errAtTyped = $derived.by(() => {
    const m = new Map<number, TokenError>();
    for (const e of result.finalErrors) if (e.typedIndex !== null) m.set(e.typedIndex, e);
    return m;
  });

  const caughtAtTyped = $derived.by(() => {
    const m = new Map<number, TokenError>();
    for (const e of result.caught) {
      if (e.refIndex === null) continue;
      const typedIndex = finalPosByRef.get(e.refIndex);
      if (typedIndex !== undefined) m.set(typedIndex, e);
    }
    return m;
  });

  // Missing-word/punctuation errors (still absent from the final text): key -1 means "before the
  // first token", otherwise the typed index of the final token right after which the marker
  // belongs (the final-text position of the error's reference anchor).
  const missingByAnchor = $derived.by(() => {
    const m = new Map<number, TokenError[]>();
    for (const e of result.finalErrors) {
      if (e.typedIndex !== null) continue;
      const anchorTyped = e.anchor === -1 ? -1 : (finalPosByRef.get(e.anchor) ?? -1);
      const list = m.get(anchorTyped) ?? [];
      list.push(e);
      m.set(anchorTyped, list);
    }
    return m;
  });

  type Piece =
    | { kind: 'gap'; text: string }
    | { kind: 'tok'; index: number }
    | { kind: 'missing'; anchor: number; errors: TokenError[] };

  const pieces = $derived.by(() => {
    const out: Piece[] = [];
    const tokens = grade.typedTokens;
    let cursor = 0;
    const leading = missingByAnchor.get(-1);
    if (leading) out.push({ kind: 'missing', anchor: -1, errors: leading });
    tokens.forEach((t, index) => {
      if (t.start > cursor) out.push({ kind: 'gap', text: finalText.slice(cursor, t.start) });
      out.push({ kind: 'tok', index });
      cursor = t.end;
      const after = missingByAnchor.get(index);
      if (after) out.push({ kind: 'missing', anchor: index, errors: after });
    });
    if (finalText.length > cursor) out.push({ kind: 'gap', text: finalText.slice(cursor) });
    return out;
  });

  // "Ce qu'Éris a tenté": every error she planted (the draft's errors, whether caught or missed)
  // plus the ones she slipped in during proofreading, grouped by category.
  const caughtKeys = $derived(new Set(result.caught.map(errorKey)));
  const attempted = $derived([...result.draftErrors, ...result.introduced]);
  const categoryOrder = Object.keys(CATEGORY_LABELS) as StatKey[];
  const grouped = $derived.by(() => {
    const byKey = new Map<StatKey, TokenError[]>();
    for (const e of attempted) {
      const key = statKeyOf(e);
      const list = byKey.get(key) ?? [];
      list.push(e);
      byKey.set(key, list);
    }
    return categoryOrder
      .filter((k) => byKey.has(k))
      .map((k) => ({ key: k, label: CATEGORY_LABELS[k], errors: byKey.get(k)! }));
  });

  // The tapped token/marker (spec §3.5 "correct form revealed on tap"). Tracked by position, not
  // by object identity, since the derived error maps are rebuilt on every render.
  let active = $state<{ type: 'tok'; index: number } | { type: 'missing'; anchor: number; i: number } | null>(null);

  function tapTok(index: number) {
    if (!errAtTyped.has(index) && !caughtAtTyped.has(index)) return;
    active = active?.type === 'tok' && active.index === index ? null : { type: 'tok', index };
  }

  function tapMissing(anchor: number, i: number) {
    active = active?.type === 'missing' && active.anchor === anchor && active.i === i ? null : { type: 'missing', anchor, i };
  }

  const activePanel = $derived.by(() => {
    if (!active) return null;
    if (active.type === 'tok') {
      const err = errAtTyped.get(active.index);
      if (err) return { kind: 'err' as const, err };
      const caught = caughtAtTyped.get(active.index);
      if (caught) return { kind: 'caught' as const, caught };
      return null;
    }
    const e = missingByAnchor.get(active.anchor)?.[active.i];
    return e ? { kind: 'missing' as const, e } : null;
  });

  // The victory renders this scroll from inside the battle stage, which turns `inert` while an
  // overlay is open (the places render theirs next to the stage instead). So the scroll moves to
  // <body>, as RotateScreen does, and takes the focus the overlay could not give itself while it
  // still sat inside the stage.
  function toBody(node: HTMLElement) {
    document.body.appendChild(node);
    const panel = node.querySelector<HTMLElement>('[aria-modal="true"]');
    if (panel && !node.contains(document.activeElement)) panel.focus();
    return { destroy: () => node.remove() };
  }
</script>

<div class="revoir-portal" use:toBody>
<Overlay variant="scroll" size="wide" title={VICTORY.reviewTitle} testId="overlay-revoir" {onClose} returnFocus={'[data-testid="battle-revoir"]'}>
  <h3 class="kit-section">{VICTORY.reviewText}</h3>
  <div class="review-text">
    <p class="tokens" lang="fr">{#each pieces as piece, i (i)}{#if piece.kind === 'gap'}{piece.text}{:else if piece.kind === 'missing'}{#each piece.errors as e, j (j)}<button
            type="button"
            class="marker"
            class:active={active?.type === 'missing' && active.anchor === piece.anchor && active.i === j}
            aria-label={VICTORY.missingWord}
            onclick={() => tapMissing(piece.anchor, j)}><Icon name="gap" size={18} /></button
          >{/each}{:else}<button
          type="button"
          class="tok"
          class:punct={grade.typedTokens[piece.index].kind === 'punct'}
          class:err={errAtTyped.has(piece.index)}
          class:caught={caughtAtTyped.has(piece.index)}
          class:active={active?.type === 'tok' && active.index === piece.index}
          onclick={() => tapTok(piece.index)}>{grade.typedTokens[piece.index].text}</button
        >{/if}{/each}</p>
  </div>

  {#if activePanel}
    <div class="kit-note popover" data-tone={activePanel.kind === 'caught' ? undefined : 'eris'} role="note" data-testid="revoir-popover">
      {#if activePanel.kind === 'err'}
        {#if activePanel.err.expected !== null}
          <p class="popover-expected">{VICTORY.expected(activePanel.err.expected)}</p>
        {/if}
        <p>{explain(activePanel.err, ctx).text}</p>
      {:else if activePanel.kind === 'caught'}
        <p class="caught-text">{caughtText(activePanel.caught)}</p>
      {:else}
        <p>{VICTORY.forgotten(activePanel.e.expected ?? '')}</p>
      {/if}
    </div>
  {/if}

  {#if grouped.length > 0}
    <h3 class="kit-section">{VICTORY.reviewTried}</h3>
    {#each grouped as group (group.key)}
      <section class="category">
        <h4>{group.label}</h4>
        <ul>
          {#each group.errors as e, i (i)}
            <li>
              <span class="expl">{explain(e, ctx).text}</span>
              {#if caughtKeys.has(errorKey(e))}<span class="kit-stamp foiled">{VICTORY.foiled} <Icon name="check" size={14} /></span>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</Overlay>
</div>

<style>
  .revoir-portal {
    display: contents;
  }
  /* The text as she left it (Ruling C12's legibility): Literata on the nearly opaque text zone. */
  .review-text {
    padding: 8px 16px;
    border-radius: 6px;
    background: var(--battle-text-bg);
    box-shadow: inset 0 0 0 1px var(--parchment-edge);
  }
  .tokens {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: var(--font-reading);
    font-size: clamp(22px, 1.9vw, 26px);
    line-height: 1.9;
    color: var(--ink);
  }
  /* Each word is an inline target: its padding carries the hit area to ~44 px (global constraints,
     accessibility), the line box stays the text's own. */
  .tok {
    display: inline;
    appearance: none;
    margin: 0;
    padding: 10px 2px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    font: inherit;
    line-height: inherit;
    color: inherit;
    cursor: default;
  }
  .tok.punct {
    padding-left: 1px;
    padding-right: 1px;
  }
  .tok.err,
  .tok.caught {
    cursor: pointer;
  }
  .tok.err {
    text-decoration: underline;
    text-decoration-color: var(--orange);
    text-decoration-thickness: 3px;
    text-underline-offset: 4px;
  }
  .tok.caught {
    text-decoration: underline dotted;
    text-decoration-color: var(--laurel);
    text-decoration-thickness: 3px;
    text-underline-offset: 4px;
  }
  .tok.active {
    background: rgba(201, 171, 116, 0.4);
  }
  .tok:focus-visible,
  .marker:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: 2px;
  }
  .marker {
    display: inline;
    appearance: none;
    margin: 0 2px;
    padding: 10px 4px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--orange-ink);
    cursor: pointer;
    line-height: 1;
  }
  .marker.active {
    background: var(--orange-light);
  }
  .popover {
    margin-top: 12px;
  }
  .popover p {
    margin: 0;
    font-size: 18px;
  }
  .popover-expected {
    font-weight: 700;
    margin-bottom: 4px !important;
  }
  .caught-text {
    color: var(--laurel);
    font-weight: 600;
  }
  .category h4 {
    margin: 10px 0 6px;
  }
  .category ul {
    margin: 0 0 4px;
    padding-left: 20px;
  }
  .category li {
    margin-bottom: 6px;
    font-size: 17px;
  }
  /* « déjoué » stamped in the laurel's green beside the line (an ink stamp, not a hanging tag: a
     tag's cord would cross the line above). */
  .foiled {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 0 0 0 8px;
    vertical-align: 2px;
    color: var(--laurel);
  }
</style>
