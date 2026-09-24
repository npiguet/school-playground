<script lang="ts">
  // The results screen (spec §3.5, §1.6): kind, specific explanations, Éris's line framing the
  // mistakes as her sabotage, catch rate celebrated. Orange for still-wrong words, olive for
  // words she caught and fixed herself - never red.
  import { errorKey, gradeText, mapAnnotation } from '$lib/grading';
  import type { Annotation, SessionResult, StatKey, TokenError } from '$lib/grading/types';
  import { CATEGORY_LABELS, caughtText, erisLine, explain, statKeyOf } from '$lib/explain';
  import type { TextFull } from '$lib/types';

  let {
    reference,
    result,
    finalText,
    helpMessage,
    submitError,
    submitting,
    onReplay,
    onLibrary,
    onRetry,
  }: {
    reference: TextFull;
    result: SessionResult;
    finalText: string;
    helpMessage: string | null;
    submitError: string | null;
    onReplay: () => void;
    onLibrary: () => void;
    /** Not in the task brief's prop list, but needed for the "Réessayer" retry button the brief
     *  describes (Play.svelte step 3): retries the session submission without leaving the screen. */
    onRetry?: () => void;
    /** Not in the task brief's prop list either: disables "Réessayer" while a submission request
     *  is outstanding, so a fast double-tap can't fire it twice. */
    submitting?: boolean;
  } = $props();

  const annotation = $derived(reference.annotation as Annotation);
  // Recomputed locally (pure function of reference + finalText): gives the token layout and the
  // reference<->final alignment this screen needs to place caught/missing markers, independent
  // of what Play.svelte already computed in `result`.
  const grade = $derived(gradeText(reference.body, finalText, annotation));
  const annots = $derived(mapAnnotation(grade.refTokens, annotation));
  const ctx = $derived({ refTokens: grade.refTokens, annots, annotation });

  const draftCount = $derived(result.draftErrors.length);
  const caughtCount = $derived(result.caught.length);
  const introducedCount = $derived(result.introduced.length);
  const pct = $derived(draftCount > 0 ? Math.round((100 * caughtCount) / draftCount) : null);
  const erisText = $derived(erisLine(result.catchRate, draftCount, introducedCount));

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
</script>

<div class="screen results">
  <h1>Relecture terminée</h1>

  <div class="card eris">
    <p class="eris-label">Éris, agacée :</p>
    <p class="eris-line">{erisText}</p>
  </div>

  <div class="hero">
    <p class="hero-line" data-testid="results-catch-rate">
      {#if draftCount === 0}
        Texte parfait dès la dictée !
      {:else}
        Pièges déjoués : {caughtCount} sur {draftCount} ({pct} %)
      {/if}
    </p>
    <p class="hero-line" data-testid="results-score">Score : {result.score}</p>
    <p class="hero-line">Mots justes : {result.correctWords} / {result.totalWords}</p>
    {#if introducedCount > 0}
      <p class="hero-line muted">
        Éris a profité de la relecture pour glisser {introducedCount} nouveau(x) piège(s). Ça arrive
        : regarde-les ci-dessous.
      </p>
    {/if}
  </div>

  {#if helpMessage}
    <div class="banner-olive">{helpMessage}</div>
  {/if}

  {#if submitError}
    <div class="banner-error">
      <p>Les Muses n'ont pas pu noter cette partie ({submitError}).</p>
      <button type="button" class="btn" disabled={submitting} onclick={onRetry}>
        {submitting ? 'Envoi en cours…' : 'Réessayer'}
      </button>
    </div>
  {/if}

  <div class="text">
    <p class="tokens" lang="fr">{#each pieces as piece, i (i)}{#if piece.kind === 'gap'}{piece.text}{:else if piece.kind === 'missing'}{#each piece.errors as e, j (j)}<button
            type="button"
            class="marker"
            class:marker-active={active?.type === 'missing' && active.anchor === piece.anchor && active.i === j}
            aria-label="Mot oublié"
            onclick={() => tapMissing(piece.anchor, j)}>▢</button
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
    <div class="popover-panel" role="note">
      {#if activePanel.kind === 'err'}
        {#if activePanel.err.expected !== null}
          <p class="popover-expected">Attendu : « {activePanel.err.expected} »</p>
        {/if}
        <p class="popover-text">{explain(activePanel.err, ctx).text}</p>
      {:else if activePanel.kind === 'caught'}
        <p class="popover-text caught-text">{caughtText(activePanel.caught)}</p>
      {:else}
        <p class="popover-text">Mot oublié : « {activePanel.e.expected} »</p>
      {/if}
    </div>
  {/if}

  {#if grouped.length > 0}
    <h2>Ce qu'Éris a tenté</h2>
    {#each grouped as group (group.key)}
      <section class="category">
        <h3>{group.label}</h3>
        <ul>
          {#each group.errors as e, i (i)}
            <li>
              <span class="expl">{explain(e, ctx).text}</span>
              {#if caughtKeys.has(errorKey(e))}<span class="tag-caught">déjoué ✓</span>{/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}

  <div class="actions">
    <button type="button" class="btn btn-primary" onclick={onReplay}>Rejouer ce texte</button>
    <button type="button" class="btn" data-testid="btn-back-library" onclick={onLibrary}>Retour aux Parchemins</button>
  </div>
</div>

<style>
  .results {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .eris {
    border: 1px solid var(--orange);
    cursor: default;
  }
  .eris-label {
    margin: 0 0 4px;
    font-style: italic;
    color: var(--orange);
    font-weight: 600;
  }
  .eris-line {
    margin: 0;
  }
  .hero {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .hero-line {
    margin: 0;
    font-size: 18px;
  }
  .banner-olive {
    background: #eaeedc;
    border: 1px solid var(--olive);
    border-radius: var(--radius);
    padding: 12px 16px;
    color: var(--ink);
  }
  .banner-error {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--orange-light);
    border: 1px solid var(--orange);
    border-radius: var(--radius);
    padding: 12px 16px;
  }
  .banner-error p {
    margin: 0;
  }
  .banner-error .btn:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .text {
    background: #fff;
    border: 1px solid var(--marble-dark);
    border-radius: var(--radius);
    padding: 12px 16px;
  }
  .tokens {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: var(--font-body);
    font-size: 20px;
    line-height: 1.9;
    color: var(--ink);
  }
  .tok {
    display: inline;
    appearance: none;
    margin: 0;
    padding: 6px 2px;
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
    text-underline-offset: 3px;
  }
  .tok.caught {
    text-decoration: underline dotted;
    text-decoration-color: var(--olive);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }
  .tok.active {
    background: var(--marble-dark);
  }
  .marker {
    display: inline;
    appearance: none;
    margin: 0 2px;
    padding: 2px 4px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--orange);
    font-size: 16px;
    cursor: pointer;
    line-height: 1;
  }
  .marker-active {
    background: var(--orange-light);
  }
  .popover-panel {
    background: var(--marble);
    border: 2px solid var(--aegean);
    border-radius: var(--radius);
    padding: 12px 16px;
  }
  .popover-panel p {
    margin: 0;
  }
  .popover-expected {
    font-weight: 600;
    margin-bottom: 4px;
  }
  .caught-text {
    color: var(--olive);
    font-weight: 600;
  }
  h2 {
    margin-top: 8px;
  }
  .category h3 {
    font-size: 18px;
    margin: 0 0 6px;
  }
  .category ul {
    margin: 0 0 4px;
    padding-left: 20px;
  }
  .category li {
    margin-bottom: 6px;
  }
  .expl {
    color: var(--ink);
  }
  .tag-caught {
    margin-left: 8px;
    color: var(--olive);
    font-weight: 600;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    padding: 8px 0 env(safe-area-inset-bottom);
  }
</style>
