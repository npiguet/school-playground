// runs.ts — the text as words on the parchment (TokenText) and on the « Revoir » scroll: every word is
// an atomic inline box, so the pieces glued together with no gap between them (« bruit. »,
// « maisons, », « jusqu'au », a word and its missing-word marker) form one unbreakable run, and a
// line never opens on a full stop (Task 8 walk). A token glued to its neighbour drops its padding on
// that side: no gap before a full stop or a comma (French typography, the lane V review). Pure; one
// helper for both (final review M15).

export type Gap = { kind: 'gap'; text: string };
export type Run<T> = { kind: 'run'; items: T[] };

/** Groups the items between two gaps into one run each; gaps stay as they are. */
export function glueRuns<T extends { kind: string }>(pieces: (Gap | T)[]): (Gap | Run<T>)[] {
  const out: (Gap | Run<T>)[] = [];
  for (const p of pieces) {
    const last = out.at(-1);
    if (p.kind === 'gap') out.push(p as Gap);
    else if (last?.kind === 'run') (last as Run<T>).items.push(p as T);
    else out.push({ kind: 'run', items: [p as T] });
  }
  return out;
}

/** Which sides of token `index` touch a neighbour with no gap (its padding goes on that side). */
export function snug(tokens: readonly { start: number; end: number }[], index: number): { left: boolean; right: boolean } {
  return {
    left: index > 0 && tokens[index - 1].end === tokens[index].start,
    right: index < tokens.length - 1 && tokens[index + 1].start === tokens[index].end,
  };
}
