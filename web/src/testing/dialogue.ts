// Unit tests pin a content line by its key and by membership among the key's variants (the pick is
// random, Ruling E11), never by one variant's exact text.
import { LINES } from '../lib/dialogue/content';
import { fill } from '../lib/dialogue/select';
import { frenchSpacing } from '../lib/text/french';
import type { DialogueKey } from '../lib/dialogue/types';

/** Every text `key` may say, filled and spaced as `sayKey` shows it. */
export function variantsOf(key: DialogueKey, vars: Record<string, string> = {}): string[] {
  return LINES[key].map((l) => frenchSpacing(fill(l.text, vars)));
}
