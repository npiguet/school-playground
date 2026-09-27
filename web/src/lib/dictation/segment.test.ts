import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { splitSentences, splitChunks, countWords } from './segment';

describe('splitSentences', () => {
  it('splits on terminal punctuation followed by space', () => {
    const s = splitSentences('Il pleut. Elle sort ! Pourquoi ? Parce que.');
    expect(s.map((x) => x.text)).toEqual(['Il pleut.', 'Elle sort !', 'Pourquoi ?', 'Parce que.']);
    expect(s[1]).toMatchObject({ start: 10, end: 21, newParagraph: false });
  });
  it('keeps closing quotes with the sentence', () => {
    expect(splitSentences('Il dit : « Viens ici. » Elle vint.').map((x) => x.text)).toEqual(['Il dit : « Viens ici. »', 'Elle vint.']);
  });
  it('does not split on abbreviations or mid-sentence ellipses', () => {
    expect(splitSentences('La chèvre de M. Seguin broutait. Elle rêvait… et partit.').map((x) => x.text))
      .toEqual(['La chèvre de M. Seguin broutait.', 'Elle rêvait… et partit.']);
  });
  it('treats blank lines as boundaries and flags paragraphs', () => {
    const s = splitSentences('Fin du premier\n\nDébut du second. Suite.');
    expect(s.map((x) => [x.text, x.newParagraph])).toEqual([['Fin du premier', false], ['Début du second.', true], ['Suite.', false]]);
  });
  it('returns nothing for blank text', () => expect(splitSentences('  ')).toEqual([]));
  it('does not bypass the abbreviation guard when a closing quote follows the abbreviation dot', () => {
    // Regression: the closing quote is separated from the '.' by a space
    // ("M. »"), which must not make the abbreviation-dot check see anything
    // other than a bare '.'.
    const s = splitSentences('Elle salua poliment M. » Puis elle partit.');
    expect(s.map((x) => x.text)).toEqual(['Elle salua poliment M. » Puis elle partit.']);
  });
});

describe('splitChunks', () => {
  it('splits at punctuation and merges tiny pieces', () => {
    expect(splitChunks('Le loup, affamé, arriva près de la bergerie.')).toEqual(['Le loup, affamé,', 'arriva près de la bergerie.']);
  });
  it('splits long runs near the middle', () => {
    const s = 'un deux trois quatre cinq six sept huit neuf dix onze douze treize quatorze';
    const chunks = splitChunks(s);
    expect(chunks).toEqual(['un deux trois quatre cinq six sept', 'huit neuf dix onze douze treize quatorze']);
    expect(chunks.join(' ')).toBe(s);
  });
  it('keeps short quoted speech attached', () => {
    expect(splitChunks('Il dit : « Viens ici. »')).toEqual(['Il dit : « Viens ici. »']);
  });
  it('never exceeds ten words per chunk', () => {
    const s = Array.from({ length: 33 }, (_, i) => `mot${i}`).join(' ');
    for (const c of splitChunks(s)) expect(countWords(c)).toBeLessThanOrEqual(10);
  });
});

// A long piece is halved at a sensible boundary near its middle (pace-bug report, open item 2): never
// right after a word that needs the next one (a determiner, a preposition, a subject pronoun, an
// auxiliary, a conjunction or relative word), and rather just before a relative, a conjunction or a
// preposition. This list is the test's own, not the code's.
const NEEDS_NEXT = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd', 'au', 'aux', 'ce', 'cet', 'cette', 'ces',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'leur', 'leurs', 'notre', 'nos', 'votre', 'vos',
  'à', 'sur', 'sous', 'par', 'pour', 'avec', 'sans', 'dans', 'en', 'vers', 'entre', 'chez', 'contre', 'après', 'avant',
  'je', 'tu', 'il', 'elle', 'on', 'ils', 'elles', 'se', 'ne', 'qu', 'j', 's', 'n',
  'a', 'ont', 'avait', 'avaient', 'est', 'sont', 'était', 'étaient', 'fut', 'furent',
  'et', 'ou', 'mais', 'qui', 'que', 'où', 'dont', 'quand', 'lorsque', 'comme',
]);
const lastWord = (chunk: string): string => {
  const words = chunk.toLowerCase().match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  return words[words.length - 1] ?? '';
};
const endsOnWord = (chunk: string): boolean => /[\p{L}\p{N}]$/u.test(chunk);
const seedBody = (file: string): string => (JSON.parse(readFileSync(`../content/seed/${file}`, 'utf-8')) as { body: string }).body;

describe('splitChunks: where a long piece is halved', () => {
  const circe = splitSentences(seedBody('035-muses-circe.json')).map((s) => s.text);

  it("cuts text 35's first sentence before « où » and « et », never after « sur » or « des »", () => {
    expect(splitChunks(circe[0])).toEqual([
      "Quand les marins d'Ulysse débarquèrent sur l'île boisée",
      'où régnait la magicienne Circé,',
      'ils furent accueillis par des lions',
      'et des loups étrangement dociles,',
      'qui les frôlaient sans jamais montrer les crocs.',
    ]);
  });
  it('keeps the cuts that were already before « et » and « que »', () => {
    expect(splitChunks(circe[1])).toEqual([
      "Circé, vêtue d'une robe tissée de fils d'argent,",
      'les invita dans son palais',
      'et leur offrit un vin doré,',
      "parfumé d'herbes qu'elle seule connaissait.",
    ]);
    expect(splitChunks(circe[5])).toEqual([
      'Celui-ci, protégé par une herbe magique',
      'que lui avait donnée le dieu Hermès,',
      'entra chez Circé sans crainte et exigea',
      'que ses compagnons retrouvent aussitôt leur forme humaine.',
    ]);
  });
  it('never ends a group of text 35 on a word that needs the next one', () => {
    for (const s of circe) {
      for (const c of splitChunks(s)) if (endsOnWord(c)) expect(NEEDS_NEXT.has(lastWord(c)), c).toBe(false);
    }
  });
  it('never ends a group of any seed text on a word that needs the next one, and keeps groups within ten words', () => {
    for (const f of readdirSync('../content/seed').filter((n) => n.endsWith('.json'))) {
      for (const s of splitSentences(seedBody(f))) {
        const chunks = splitChunks(s.text);
        for (const c of chunks) {
          expect(countWords(c), `${f}: ${c}`).toBeLessThanOrEqual(10);
          if (endsOnWord(c)) expect(NEEDS_NEXT.has(lastWord(c)), `${f}: ${c}`).toBe(false);
        }
      }
    }
  });
  it('never splits an elided word from the word it leans on', () => {
    const s = "Quand l'enfant d'Ulysse qu'on attendait jusqu'à l'aube s'endormit sur l'herbe humide près de l'étang d'argent.";
    const chunks = splitChunks(s);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toBe(s);
    for (const c of chunks) expect(c, c).not.toMatch(/['’]$/);
    for (const c of chunks) if (endsOnWord(c)) expect(NEEDS_NEXT.has(lastWord(c)), c).toBe(false);
  });
  it('prefers a cut just before a relative or a conjunction to the exact middle', () => {
    // 13 words: the middle falls between words 6 and 7, « qui » starts word 9.
    expect(splitChunks("Le vieux berger compta longuement ses moutons fatigués qui dormaient sous les étoiles d'or"))
      .toEqual(['Le vieux berger compta longuement ses moutons fatigués', "qui dormaient sous les étoiles d'or"]);
  });
});
