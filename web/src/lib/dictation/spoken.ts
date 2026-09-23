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

// Title abbreviations that must be read as the full word they stand for,
// never spelled out letter by letter. Two shapes: a bare word ("Mme",
// "Mlle" - no period in French usage) and a word that swallows a following
// abbreviation period ("M." -> "monsieur", never "M, point,").
const ABBREVIATION_WORDS: Record<string, string> = {
  Mme: 'madame',
  Mlle: 'mademoiselle',
};
const ABBREVIATION_WITH_PERIOD: Record<string, string> = {
  M: 'monsieur',
  MM: 'messieurs',
  St: 'saint',
  Ste: 'sainte',
};

export function spokenForm(chunk: string, opts?: { newParagraph?: boolean }): string {
  const tokens = tokenize(chunk);
  const units: Unit[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === 'word') {
      if (ABBREVIATION_WORDS[t.text]) {
        units.push({ isWord: true, text: ABBREVIATION_WORDS[t.text] });
        continue;
      }
      const expanded = ABBREVIATION_WITH_PERIOD[t.text];
      if (expanded && tokens[i + 1]?.kind === 'punct' && tokens[i + 1].text === '.') {
        units.push({ isWord: true, text: expanded });
        i++; // swallow the abbreviation period, it is not spoken as "point"
        continue;
      }
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
