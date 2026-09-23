// Turns a chunk of text into the words a teacher would say aloud while
// dictating, including spoken punctuation names. Spec §3.3.
import { tokenize } from '$lib/grading/tokenize';

const PUNCT_NAMES: Record<string, string> = {
  ',': 'virgule',
  '.': 'point',
  ';': 'point-virgule',
  ':': 'deux-points',
  '?': "point d'interrogation",
  '!': "point d'exclamation",
  '…': 'points de suspension',
  '...': 'points de suspension',
  '«': 'ouvrez les guillemets',
  '»': 'fermez les guillemets',
  '(': 'ouvrez la parenthèse',
  ')': 'fermez la parenthèse',
  '—': 'tiret',
  '–': 'tiret',
  '-': 'tiret',
  '"': 'guillemet',
  "'": 'apostrophe',
};

interface Unit {
  isWord: boolean;
  text: string;
}

export function spokenForm(chunk: string, opts?: { newParagraph?: boolean }): string {
  const tokens = tokenize(chunk);
  const units: Unit[] = [];
  for (const t of tokens) {
    if (t.kind === 'word') {
      units.push({ isWord: true, text: t.text });
    } else {
      const name = PUNCT_NAMES[t.text];
      if (name) units.push({ isWord: false, text: name });
      // Unknown punctuation tokens are silently skipped (never spoken).
    }
  }

  // Words next to each other are joined with a plain space; whenever a
  // punctuation name is involved (on either side), the join is ", " so it
  // reads as an aside, as a teacher would say it.
  let out = '';
  for (let i = 0; i < units.length; i++) {
    if (i > 0) {
      const prev = units[i - 1];
      out += prev.isWord && units[i].isWord ? ' ' : ', ';
    }
    out += units[i].text;
  }
  out += '.';

  if (opts?.newParagraph) out = 'À la ligne. ' + out;
  return out;
}
