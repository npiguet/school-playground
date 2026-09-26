<script lang="ts">
  // Renders the player's text as tappable tokens (spec §3.4). The original string is
  // reproduced exactly: tokens become buttons, the gaps between them (spaces, newlines)
  // are plain text inside a `white-space: pre-wrap` container.
  import type { Snippet } from 'svelte';
  import { tokenize } from '../../lib/grading/tokenize';
  import type { ArgusPass } from '../../lib/grading/types';
  import { PROOF } from '../../lib/battle/lines';
  import { glueRuns, snug, type Gap } from '../../lib/battle/runs';

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
    filVerb = null,
    filSubjects = new Set(),
    filActive = false,
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
    /** Fil d'Ariane (SP2 Task 7): the typed token index of the picked verb, and the typed token
     *  indexes of its subject once revealed — both in the *player's* token space, already
     *  mapped from annotation indexes by ProofPhase.svelte. */
    filVerb?: number | null;
    filSubjects?: Set<number>;
    /** Fix round 1 item 4: while the Fil is active, a tap picks a verb/subject rather than
     *  opening the word editor — the token's aria-label must say so, not "Modifier". */
    filActive?: boolean;
  } = $props();

  const tokens = $derived(tokenize(text));
  const from = $derived(range?.start ?? 0);
  const to = $derived(range?.end ?? text.length);

  // Pieces to render, in order: a gap (plain text) before every visible run of tokens, then the
  // trailing gap up to the end of the range; the glued tokens form unbreakable runs (`glueRuns`).
  const pieces = $derived.by(() => {
    const out: (Gap | { kind: 'tok'; index: number })[] = [];
    let cursor = from;
    tokens.forEach((t, index) => {
      if (t.start < from || t.end > to) return;
      if (t.start > cursor) out.push({ kind: 'gap', text: text.slice(cursor, t.start) });
      out.push({ kind: 'tok', index });
      cursor = t.end;
    });
    if (to > cursor) out.push({ kind: 'gap', text: text.slice(cursor, to) });
    return glueRuns(out);
  });

  function inActivePass(index: number): boolean {
    return activePass !== null && (passSets[index]?.has(activePass) ?? false);
  }
</script>

<!-- Deliberately written without whitespace between blocks: the container is `pre-wrap`,
     so any stray newline in the markup would show up as a line break in the text. -->
<p class="tokens" lang="fr">{#each pieces as piece, i (i)}{#if piece.kind === 'gap'}{piece.text}{:else}<span class="run">{#each piece.items as { index } (index)}{#if index === editingIndex && editor}{@render editor(index)}{:else}<button
      type="button"
      class="tok"
      class:punct={tokens[index].kind === 'punct'}
      class:snug-left={snug(tokens, index).left}
      class:snug-right={snug(tokens, index).right}
      class:lit={inActivePass(index)}
      class:dim={dim && activePass !== null && !inActivePass(index)}
      class:hint={hintedTokenIndexes.has(index)}
      class:fil-verb={filVerb === index}
      class:fil-subject={filSubjects.has(index)}
      data-testid={`tok-${index}`}
      aria-label={filActive ? PROOF.tokenFil(tokens[index].text) : PROOF.tokenEdit(tokens[index].text)}
      onclick={() => onEditToken(index)}>{tokens[index].text}</button>{/if}{/each}</span>{/if}{/each}</p>

<style>
  .tokens {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: var(--font-reading);
    /* UI4 Ruling C12: 22 px at the least, 1.9 line height (the 44 px tap rows). */
    font-size: clamp(22px, 1.9vw, 26px);
    line-height: 1.9;
    color: var(--ink);
  }
  /* Glued tokens stay on one line (a word and its full stop or comma). */
  .run {
    white-space: nowrap;
  }
  /* A word is a button, and a button is always an atomic inline box (whatever its `display`): its
     height is its own line height plus its padding, and that height sets the row. So no vertical
     padding (Task 8 walk: 10 px each way made every row ~2.7 font sizes tall and the gaps between
     words wide): the row is the 1.9 line height, which is itself the ~44 px tap row (Ruling C12). */
  .tok {
    display: inline;
    appearance: none;
    margin: 0;
    padding: 0 2px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    font: inherit;
    line-height: inherit;
    color: inherit;
    cursor: pointer;
    transition:
      color 0.2s ease,
      background 0.15s ease;
    position: relative;
  }
  /* The tap area (final review M7): the row is the 1.9 line height (~42 px at 22 px), so an
     invisible band a little taller than the row makes every word a 44 px target without moving a
     line (a pseudo-element takes the taps of its button, and never takes part in the layout). */
  .tok::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: max(44px, 100%);
    transform: translateY(-50%);
  }
  .tok.punct {
    padding-left: 1px;
    padding-right: 1px;
  }
  .tok.snug-left {
    padding-left: 0;
  }
  .tok.snug-right {
    padding-right: 0;
  }
  .tok:hover {
    background: rgba(201, 171, 116, 0.28);
  }
  .tok:focus-visible {
    outline: 3px solid var(--gold-light);
    outline-offset: -2px;
  }
  /* UI4 playability #12: the spotlight paints the glyphs' band only, so lit words on two rows never
     touch; the button's tap height is unchanged. */
  .tok.lit {
    background: linear-gradient(transparent 18%, var(--aegean-light) 18% 88%, transparent 88%);
    color: var(--aegean-ink);
    font-weight: 600;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  /* Ruling U4-c: the words outside the pass step back in colour, still 4.5:1 (legibility.test). */
  .tok.dim {
    color: var(--battle-dim-ink);
  }
  .tok.hint {
    background: var(--orange-light);
    box-shadow: inset 0 -3px 0 var(--orange);
    color: var(--ink);
  }
  .tok.fil-verb {
    outline: 3px solid var(--aegean);
    border-radius: 6px;
  }
  .tok.fil-subject {
    text-decoration: underline;
    text-decoration-color: var(--gold);
    text-decoration-thickness: 3px;
  }
</style>
