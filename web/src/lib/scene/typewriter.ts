// DialogueBox typing (scenes UI spec §4 "typewriter, tap to advance/skip"). Pure: the component
// owns the clock and just asks how much of the line is visible and what a tap does.
export const TYPE_CPS = 45;

export function typedLength(text: string, elapsedMs: number, cps = TYPE_CPS): number {
  if (elapsedMs <= 0) return 0;
  return Math.min(text.length, Math.floor((elapsedMs * cps) / 1000));
}

export interface TypeState {
  index: number;
  shown: number;
}

/** One tap: complete the current line if still typing, else go to the next line, else done. */
export function advance(s: TypeState, lines: { text: string }[]): TypeState & { done: boolean } {
  const cur = lines[s.index];
  if (!cur) return { ...s, done: true };
  if (s.shown < cur.text.length) return { index: s.index, shown: cur.text.length, done: false };
  if (s.index + 1 < lines.length) return { index: s.index + 1, shown: 0, done: false };
  return { index: s.index, shown: s.shown, done: true };
}
