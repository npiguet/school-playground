import table from '@content/homophones.json';
import { normalizeWord } from './normalize';

export interface HomophoneSet {
  id: string;
  words: string[];
  hint: string;
}

export const HOMOPHONE_SETS: HomophoneSet[] = (table as { sets: HomophoneSet[] }).sets;

// Keys are normalized defensively: content/homophones.json entries are expected to already be
// normalized, but this keeps the index correct even if a set ships a variant (e.g. mixed case
// or a typographic apostrophe) that hasn't gone through normalizeWord.
const index = new Map<string, string>();
for (const s of HOMOPHONE_SETS) for (const w of s.words) index.set(normalizeWord(w), s.id);

export function homophoneSetOf(norm: string): string | undefined {
  return index.get(norm);
}

export function homophoneHint(setId: string): string {
  return HOMOPHONE_SETS.find((s) => s.id === setId)?.hint ?? '';
}
