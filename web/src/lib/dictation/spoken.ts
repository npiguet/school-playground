// Turns a chunk of text into the words a teacher would say aloud while dictating, the punctuation said
// by name. Spec §3.3; the Kokoro voice's endings (spec 2026-09-27 §2, bake-off variant C, Kokoro plan
// Ruling K2): a mark that ends a sentence (. ? ! …) is kept as the mark itself and followed by its name,
// capitalised - « froissées. Point. », « berger ? Point d'interrogation. » - so the voice closes the
// sentence before naming it; « ; » and « : » are kept too, their name in lower case - « chèvre ;
// point-virgule, »; the comma and every other mark are said as before - « , virgule, ». This string is
// the voice's input, never shown: the space before « ? ! ; : » is a plain one.
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

/** Marks that end a sentence: the mark, then its capitalised name. */
const CLOSING = new Set(['.', '?', '!', '…', '...']);
/** Marks kept before their name, in lower case (they do not end the sentence). */
const KEPT = new Set([';', ':']);
const SPACE = ' ';

type Unit = { kind: 'word'; text: string } | { kind: 'name'; text: string } | { kind: 'mark'; mark: string; text: string };

const capitalise = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

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

/**
 * `continues`: the chunk is a breath group that stops before its sentence ends (buildPlan). When it stops
 * on a word, not on the text's own punctuation (splitChunks halved a long piece there), the line ends
 * with a bare comma instead of the full stop (pace-bug report 2026-09-27, open item 2): a full stop
 * makes the voice close the phrase with a falling cadence, a comma keeps it open, as a teacher's voice
 * stays up mid-phrase. The comma is only a cue to the voice (espeak's clause-continuing intonation,
 * where a line with no mark at all ends as a full stop does); nothing names it. A group that stops on
 * the text's own mark (« , virgule. », « ; point-virgule. ») and a sentence's last group (« . Point. »)
 * end as before.
 */
export function spokenForm(chunk: string, opts?: { newParagraph?: boolean; continues?: boolean }): string {
  const tokens = tokenize(chunk);
  const units: Unit[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind === 'word') {
      if (ABBREVIATION_WORDS[t.text]) {
        units.push({ kind: 'word', text: ABBREVIATION_WORDS[t.text] });
        continue;
      }
      const expanded = ABBREVIATION_WITH_PERIOD[t.text];
      if (expanded && tokens[i + 1]?.kind === 'punct' && tokens[i + 1].text === '.') {
        units.push({ kind: 'word', text: expanded });
        i++; // swallow the abbreviation period, it is not spoken as "point"
        continue;
      }
      units.push({ kind: 'word', text: t.text });
    } else {
      const name = PUNCT_NAMES[t.text];
      if (!name) continue; // Unknown punctuation tokens are silently skipped (never spoken).
      if (CLOSING.has(t.text)) units.push({ kind: 'mark', mark: t.text === '...' ? '…' : t.text, text: capitalise(name) });
      else if (KEPT.has(t.text)) units.push({ kind: 'mark', mark: t.text, text: name });
      else units.push({ kind: 'name', text: name });
    }
  }

  // Words next to each other are joined by a space; a name is set off by commas, as an aside; a kept
  // mark sits against the word before it (« . », « … ») or after a space (« ? ! ; : »), then its name.
  // A mark with nothing before it is said by its name alone.
  let out = '';
  units.forEach((u, i) => {
    if (i > 0) {
      const prev = units[i - 1];
      if (u.kind === 'mark') out += (u.mark === '.' || u.mark === '…' ? '' : SPACE) + u.mark + SPACE;
      else out += prev.kind === 'word' && u.kind === 'word' ? SPACE : ', ';
    }
    out += u.text;
  });
  out += opts?.continues && units.at(-1)?.kind === 'word' ? ',' : '.';

  if (opts?.newParagraph) out = 'À la ligne. ' + (units[0] && units[0].kind !== 'word' ? capitalise(out) : out);
  return out;
}
