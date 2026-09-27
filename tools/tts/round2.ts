// Writes tools/tts/round2.json: the round-2 (Kokoro only) lines. Variant A is the game's own spoken form
// (spokenForm, unchanged); B-E are made from A by the small transform below, in the bake-off tooling
// only: the game code is not changed. Bundled and run like lines.ts (README).
import { writeFileSync } from 'node:fs';
import { splitSentences } from '$lib/dictation/segment';
import { spokenForm } from '$lib/dictation/spoken';
import { PACE_RATES } from '$lib/dictation/script';
import dragon from '@content/seed/028-muses-dragon-des-muses.json';
import etoiles from '@content/seed/010-daudet-etoiles.json';
import canard from '@content/seed/002-andersen-vilain-petit-canard.json';
import chevre from '@content/seed/009-daudet-chevre-loup.json';
import pomme from '@content/seed/027-muses-pomme-or.json';

// Sentence-level marks spokenForm names, with the name it gives them (its PUNCT_NAMES). The comma,
// guillemets, parentheses and tirets keep their current ", name," rendering in every variant.
const MARKS: [name: string, mark: string][] = [
  ['points de suspension', '…'],
  ["point d'interrogation", '?'],
  ["point d'exclamation", '!'],
  ['point-virgule', ';'],
  ['deux-points', ':'],
  ['point', '.'],
];
const CLOSING = new Set(['.', '?', '!', '…']); // marks that end a sentence
const NAME_RE = new RegExp(`, (${MARKS.map(([n]) => n).join('|')})(?=[,.])`, 'g');

type Variant = 'A' | 'B' | 'C' | 'D' | 'E';
// In A a mark's name is joined by ", " (spokenForm). B-E put the mark itself back before its name:
//   B  "froissées. point."    the mark, then the name (the user's form)
//   C  "froissées. Point."    B, with the name capitalised after a sentence-closing mark
//   D  "froissées… point."    B, with « … » in place of « . » (the user's D)
//   E  "froissées.\npoint."   B, with a line break after a sentence-closing mark: Kokoro's pipeline
//                              splits its input on newlines, so the name is a separate synthesis and
//                              the sentence gets its own final cadence (our extra variant)
// ";" and ":" do not close a sentence: C, D and E render them as B does ("chèvre ; point-virgule, et").
function variant(a: string, v: Variant): string {
  if (v === 'A') return a;
  return a.replace(NAME_RE, (_, name: string) => {
    let mark = MARKS.find(([n]) => n === name)![1];
    const closing = CLOSING.has(mark);
    if (v === 'D' && mark === '.') mark = '…';
    const glue = v === 'E' && closing ? '\n' : ' ';
    const said = v === 'C' && closing ? name[0].toUpperCase() + name.slice(1) : name;
    // French typography: a space before ; : ? ! (a plain one: the voice does not see the difference).
    return (mark === '.' || mark === '…' ? mark : ' ' + mark) + glue + said;
  });
}

function sentence(source: string, body: string, text: string) {
  const s = splitSentences(body).find((x) => x.text === text);
  if (!s) throw new Error(`not a sentence of ${source}: ${text}`);
  const a = spokenForm(s.text, { newParagraph: s.newParagraph });
  const variants = Object.fromEntries((['A', 'B', 'C', 'D', 'E'] as Variant[]).map((v) => [v, variant(a, v)]));
  return { source, text: s.text, newParagraph: s.newParagraph, variants };
}

const sentences = {
  a: sentence('028-muses-dragon-des-muses (round-1 line a)', dragon.body,
    "Un matin, l'œuf se fendit en craquant, et un petit dragon aux écailles vertes en sortit, les ailes encore froissées."),
  q: sentence('010-daudet-etoiles', etoiles.body, 'Est-ce que tu sais leurs noms, berger ?'),
  x: sentence('002-andersen-vilain-petit-canard', canard.body, 'Que la campagne était belle !'),
  el: sentence('010-daudet-etoiles', etoiles.body, "Jamais je n'en avais tant vu…"),
  sc: sentence('009-daudet-chevre-loup', chevre.body, "— Déjà ! dit la petite chèvre ; et elle s'arrêta fort étonnée."),
  co: sentence('027-muses-pomme-or', pomme.body, 'Sur la pomme, quelques mots étaient gravés : « À la plus belle. »'),
};

writeFileSync(process.argv[2], JSON.stringify({
  paces: [PACE_RATES[1], PACE_RATES[2]],
  sentences,
}, null, 2) + '\n');
