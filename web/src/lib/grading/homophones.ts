import table from '@content/homophones.json';

export interface HomophoneSet {
  id: string;
  words: string[];
  hint: string;
}

export const HOMOPHONE_SETS: HomophoneSet[] = (table as { sets: HomophoneSet[] }).sets;

const index = new Map<string, string>();
for (const s of HOMOPHONE_SETS) for (const w of s.words) index.set(w, s.id);

export function homophoneSetOf(norm: string): string | undefined {
  return index.get(norm);
}

export function homophoneHint(setId: string): string {
  return HOMOPHONE_SETS.find((s) => s.id === setId)?.hint ?? '';
}
