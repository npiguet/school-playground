<script lang="ts">
  // Renders the player's text as tappable tokens (spec §3.4). The original string is
  // reproduced exactly: tokens become buttons, the gaps between them (spaces, newlines)
  // are plain text inside a `white-space: pre-wrap` container.
  import type { Snippet } from 'svelte';
  import { tokenize } from '$lib/grading/tokenize';
  import type { ArgusPass } from '$lib/grading/types';

  let {
    text,
    passSets,
    activePass,
    dim,
    hintedTokenIndexes,
    range,
    onEditToken,
    editingIndex = null,
    editor,
  }: {
    text: string;
    passSets: Set<ArgusPass>[];
    activePass: ArgusPass | null;
    dim: boolean;
    hintedTokenIndexes: Set<number>;
    range: { start: number; end: number } | null;
    onEditToken: (index: number) => void;
    /** Token currently being edited; `editor` is rendered in its place. */
    editingIndex?: number | null;
    editor?: Snippet<[number]>;
  } = $props();

  const tokens = $derived(tokenize(text));
  const from = $derived(range?.start ?? 0);
  const to = $derived(range?.end ?? text.length);

  // Pieces to render, in order: a gap (plain text) before every visible token, then the
  // trailing gap up to the end of the range.
  const pieces = $derived.by(() => {
    const out: ({ kind: 'gap'; text: string } | { kind: 'tok'; index: number })[] = [];
    let cursor = from;
    tokens.forEach((t, index) => {
      if (t.start < from || t.end > to) return;
      if (t.start > cursor) out.push({ kind: 'gap', text: text.slice(cursor, t.start) });
      out.push({ kind: 'tok', index });
      cursor = t.end;
    });
    if (to > cursor) out.push({ kind: 'gap', text: text.slice(cursor, to) });
    return out;
  });

  function inActivePass(index: number): boolean {
    return activePass !== null && (passSets[index]?.has(activePass) ?? false);
  }
</script>

<!-- Deliberately written without whitespace between blocks: the container is `pre-wrap`,
     so any stray newline in the markup would show up as a line break in the text. -->
<p class="tokens" lang="fr">{#each pieces as piece, i (i)}{#if piece.kind === 'gap'}{piece.text}{:else if piece.index === editingIndex && editor}{@render editor(piece.index)}{:else}<button
      type="button"
      class="tok"
      class:punct={tokens[piece.index].kind === 'punct'}
      class:lit={inActivePass(piece.index)}
      class:dim={dim && activePass !== null && !inActivePass(piece.index)}
      class:hint={hintedTokenIndexes.has(piece.index)}
      aria-label="Modifier « {tokens[piece.index].text} »"
      onclick={() => onEditToken(piece.index)}>{tokens[piece.index].text}</button>{/if}{/each}</p>

<style>
  .tokens {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: var(--font-body);
    font-size: 22px;
    line-height: 1.9;
    color: var(--ink);
  }
  /* Inline (not inline-block) so a word and its trailing comma never split across lines;
     the vertical padding extends the tap target to ~44 px without changing the line box. */
  .tok {
    display: inline;
    appearance: none;
    margin: 0;
    padding: 10px 4px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    font: inherit;
    line-height: inherit;
    color: inherit;
    cursor: pointer;
    transition:
      opacity 0.2s ease,
      background 0.15s ease;
  }
  .tok.punct {
    padding-left: 1px;
    padding-right: 1px;
  }
  .tok:hover {
    background: var(--marble-dark);
  }
  .tok:focus-visible {
    outline: 3px solid var(--aegean);
    outline-offset: -2px;
  }
  .tok.lit {
    background: var(--aegean-light);
    color: var(--aegean);
    font-weight: 600;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .tok.dim {
    opacity: 0.3;
  }
  .tok.hint {
    background: var(--orange-light);
    box-shadow: inset 0 -3px 0 var(--orange);
    opacity: 1;
  }
</style>
