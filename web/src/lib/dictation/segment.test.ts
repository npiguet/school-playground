import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { splitSentences, splitChunks, countWords, liaisonAcross } from './segment';
import { buildPlan, longGroups } from './script';

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
  // the first word of a two-word conjunction or idiom, and the adverbs of degree that always lean on the next
  'parce', 'tandis', 'plutôt', 'dès', 'ainsi', 'alors', 'uns', 'unes', 'très', 'trop', 'assez',
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

// Fix round of the chunk review: real seed sentences, each pinned, one per rule of bestCut.
describe('splitChunks: where a long piece of a seed text is halved', () => {
  const sentenceOf = (file: string, start: string): string => {
    const found = splitSentences(seedBody(file)).find((s) => s.text.startsWith(start));
    if (!found) throw new Error(`${file}: no sentence starts with « ${start} »`);
    return found.text;
  };
  const cases: { rule: string; file: string; start: string; groups: string[] }[] = [
    {
      rule: 'a pre-noun adjective stays with its noun (« un petit | chaperon » was cut)',
      file: '001-perrault-chaperon-rouge.json',
      start: 'Cette bonne femme',
      groups: ['Cette bonne femme lui fit faire un petit chaperon rouge', 'qui lui seyait si bien,', "que partout on l'appelait le petit Chaperon rouge."],
    },
    {
      rule: 'no cut inside a two-word conjunction (« plutôt | que »)',
      file: '033-muses-polypheme.json',
      start: "Ulysse comprit qu'il devait ruser",
      groups: ["Ulysse comprit qu'il devait ruser", 'plutôt que combattre, et, tout bas,', 'il chuchota un plan à ses hommes tremblants.'],
    },
    {
      rule: 'a pre-noun adjective (« de grandes | envies »), a verb and its « de » (« venait | de »)',
      file: '017-maupassant-papa-de-simon.json',
      start: 'Et Simon avait des minutes',
      groups: ['Et Simon avait des minutes de béatitude,', "de cet alanguissement qui suit les larmes,", 'où il lui venait de grandes envies', "de s'endormir là, sur l'herbe,", 'dans la chaleur.'],
    },
    {
      rule: 'a pre-noun adjective (« les petites | grenouilles »), and a cut before « au »',
      file: '026-ramuz-aline.json',
      start: "C'est l'heure où les petites",
      groups: ["C'est l'heure où les petites grenouilles souffrent", 'au creux des mottes,', 'à cause du soleil qui a bu la rosée,', 'et leur gorge lisse saute vite.'],
    },
    {
      rule: 'an adverb of degree stays with its adjective (« très | extraordinaire »)',
      file: '006-carroll-alice-terrier.json',
      start: "Il n'y avait rien là de bien étonnant",
      groups: ["Il n'y avait rien là de bien étonnant,", 'et Alice ne trouva même pas très extraordinaire', "d'entendre parler le Lapin qui se disait :", '« Ah ! j\'arriverai trop tard ! »'],
    },
    {
      rule: 'no cut inside a proper name (« Maréchal | Niel »)',
      file: '012-kipling-rikki-tikki.json',
      start: "C'était un grand jardin",
      groups: [
        "C'était un grand jardin,", 'seulement à demi cultivé,', 'avec des buissons de roses Maréchal Niel', 'aussi gros que des kiosques,',
        'des citronniers et des orangers,', 'des bouquets de bambous et des fourrés de hautes herbes.',
      ],
    },
    {
      rule: '« tous » that ends its clause is a cut point (« se ressemblaient tous | et où »)',
      file: '030-muses-fil-ariane.json',
      start: "Thésée s'enfonça",
      groups: ["Thésée s'enfonça dans les couloirs sombres,", 'où les murs de pierre se ressemblaient tous', 'et où les carrefours se multipliaient sans logique apparente.'],
    },
    {
      rule: '« les uns après les autres » stays whole',
      file: '002-andersen-vilain-petit-canard.json',
      start: 'Enfin les œufs',
      groups: ['Enfin les œufs commencèrent à crever', 'les uns après les autres ; on entendait « pi-pip » ;', "c'étaient les petits canards qui vivaient", 'et tendaient leur cou au dehors.'],
    },
    {
      rule: '« les uns contre les autres » stays whole, and « les autres » may end a group',
      file: '033-muses-polypheme.json',
      start: "Les compagnons d'Ulysse",
      groups: ["Les compagnons d'Ulysse, terrifiés,", 'se serrèrent les uns contre les autres', 'au fond de la grotte,', 'retenant leur souffle.'],
    },
    {
      rule: 'an auxiliary, its negation and its participle stay together (« n\'était pas | passé »)',
      file: '014-stevenson-ile-au-tresor.json',
      start: 'Chaque soir, en revenant',
      groups: ['Chaque soir, en revenant de sa promenade,', "il demandait s'il n'était pas passé", 'des marins sur la route.'],
    },
    {
      rule: 'a verb and its « de » stay together (« nous venons | de rapporter »)',
      file: '020-dumas-trois-mousquetaires.json',
      start: 'En sortant de la chambre paternelle',
      groups: [
        'En sortant de la chambre paternelle,', 'le jeune homme trouva sa mère', "qui l'attendait avec la fameuse recette",
        'dont les conseils que nous venons de rapporter', 'devaient nécessiter un assez fréquent emploi.',
      ],
    },
  ];
  for (const c of cases) {
    it(c.rule, () => {
      const s = sentenceOf(c.file, c.start);
      expect(splitChunks(s)).toEqual(c.groups);
    });
  }

  it('cuts before « parce que », never inside it', () => {
    expect(splitChunks('Le petit berger restait assis sous le chêne parce que la pluie tombait sans cesse'))
      .toEqual(['Le petit berger restait assis sous le chêne', 'parce que la pluie tombait sans cesse']);
  });
  it('never cuts after the « . » of « M. »: the title stays with its name', () => {
    expect(splitChunks('Les belles chèvres du bon vieux M. Seguin se sauvaient toujours vers la montagne'))
      .toEqual(['Les belles chèvres du bon vieux M. Seguin', 'se sauvaient toujours vers la montagne']);
  });
  // Chunk re-review, new breakage 1: every title of splitSentences' ABBREVIATIONS, « Mme. » and
  // « Mlle. » too.
  it('never cuts after the « . » of « Mme. » or « Mlle. »', () => {
    expect(splitChunks('Les belles chèvres du bon vieux Mme. Seguin se sauvaient toujours vers la montagne'))
      .toEqual(['Les belles chèvres du bon vieux Mme. Seguin', 'se sauvaient toujours vers la montagne']);
    expect(splitChunks('Les belles chèvres du bon vieux Mlle. Seguin se sauvaient toujours vers la montagne'))
      .toEqual(['Les belles chèvres du bon vieux Mlle. Seguin', 'se sauvaient toujours vers la montagne']);
  });
  // Chunk re-review, new breakage 2: a word that leans on the next one never ends a group before the
  // clause word it makes a conjunction with (« même si », « tout comme », as « bien que »).
  it('never cuts inside « même si » or « tout comme »', () => {
    expect(splitChunks('Le vieux berger gardait ses moutons même si la neige tombait fort'))
      .toEqual(['Le vieux berger gardait ses moutons', 'même si la neige tombait fort']);
    expect(splitChunks('Le jeune garçon aimait beaucoup les chevaux tout comme son frère aîné'))
      .toEqual(['Le jeune garçon aimait beaucoup', 'les chevaux tout comme son frère aîné']);
  });
  it('never cuts between « venir » and its « de »', () => {
    expect(splitChunks('Les bergers du village voisin venaient de rentrer au bercail avec leurs grands troupeaux'))
      .toEqual(['Les bergers du village voisin venaient de rentrer', 'au bercail avec leurs grands troupeaux']);
  });
  it('never cuts after « tous » when a determiner follows', () => {
    expect(splitChunks('Les enfants du village cueillirent tous les fruits mûrs du grand verger'))
      .toEqual(['Les enfants du village cueillirent', 'tous les fruits mûrs du grand verger']);
  });
});

// Liaison report 2026-09-28: a breath group never ends inside an obligatory liaison (« elles | ont »
// was heard as « elle… zont »), at any pace. A group that ends on a word ends on a bare comma, which
// makes the voice drop the liaison consonant; the next group, sent alone, starts on its own vowel.
describe('splitChunks: never inside a liaison', () => {
  const firstWord = (chunk: string): string => chunk.match(/[\p{L}\p{N}'’-]+/u)?.[0] ?? '';
  /** Each cut of `groups` that falls between two words carrying a liaison, as « left | right ». */
  const liaisonCuts = (groups: string[]): string[] =>
    groups.slice(0, -1).flatMap((g, i) =>
      endsOnWord(g) && liaisonAcross(lastWord(g), firstWord(groups[i + 1])) ? [`${g} | ${groups[i + 1]}`] : []);

  it('knows the obligatory liaisons, and the h aspiré that has none', () => {
    const yes: [string, string][] = [
      ['elles', 'ont'], ['ils', 'ont'], ["qu'elles", 'ont'], ['nous', 'avons'], ['on', 'a'], ['vous', 'êtes'],
      ['les', 'enfants'], ['des', 'hommes'], ['un', 'ami'], ["d'un", 'homme'], ['mon', 'ami'], ['aux', 'officiers'],
      ['deux', 'yeux'], ['trois', 'enfants'], ['petits', 'enfants'], ['grand', 'arbre'], ['vieux', 'homme'],
      ['très', 'important'], ['plus', 'ancien'], ['bien', 'aimé'], ['tout', 'entier'], ['tout', 'au'],
      ['quand', 'il'], ['dont', 'il'], ['en', 'avant'], ['dans', 'un'], ['chez', 'eux'], ['sans', 'elle'], ['sous', 'un'],
      ['sont', 'allés'], ['est', 'arrivé'], ['fus', 'arrivé'], ['avaient', 'eu'], ['les', 'uns'], ['les', 'autres'],
    ];
    for (const [a, b] of yes) expect(liaisonAcross(a, b), `${a} | ${b}`).toBe(true);
    const no: [string, string][] = [
      ['les', 'héros'], ['les', 'haricots'], ['les', 'hiboux'], ['des', 'hauteurs'], ['les', 'onze'], ['les', 'yaourts'],
      // not a liaison consonant, a consonant next, or the elided « l' » next
      ['elle', 'a'], ['les', 'loups'], ['ils', "l'ont"],
      // not an obligatory context: a noun, a verb, a stressed pronoun or an attribute before a clause or a phrase
      ['lions', 'et'], ['autres', 'au'], ['paysans', 'étaient'], ['souffrent', 'au'], ['grands', 'avec'], ['plus', 'au'],
      ['tous', 'et'], ['assis', 'au'],
    ];
    for (const [a, b] of no) expect(liaisonAcross(a, b), `${a} | ${b}`).toBe(false);
  });

  it('never cuts « elles ont », « les enfants », « très important », « nous avons », « ils sont allés »', () => {
    const cases: [string, string[]][] = [
      ['Les deux sœurs restèrent longtemps au bord de la mer grise et elles ont regardé les bateaux',
        ['Les deux sœurs restèrent longtemps', 'au bord de la mer grise', 'et elles ont regardé les bateaux']],
      ['Au bout du long chemin poussiéreux attendaient patiemment les enfants du village voisin',
        ['Au bout du long chemin poussiéreux', 'attendaient patiemment les enfants du village voisin']],
      ['Le vieux berger trouvait ce travail du soir très important pour son grand troupeau',
        ['Le vieux berger trouvait ce travail', 'du soir très important pour son grand troupeau']],
      ['Le vieux berger répétait souvent que nous avons tous besoin de repos le soir',
        ['Le vieux berger répétait souvent', 'que nous avons tous besoin de repos le soir']],
      ['Les bergers du village voisin disent que ils sont allés vers la montagne',
        ['Les bergers du village voisin disent', 'que ils sont allés vers la montagne']],
    ];
    for (const [s, groups] of cases) {
      expect(splitChunks(s), s).toEqual(groups);
      expect(liaisonCuts(splitChunks(s)), s).toEqual([]);
    }
  });

  it('never cuts after a numeral or « tout » before a vowel (« deux | agneaux », « tout | au fond »)', () => {
    // Both were cut there before the liaison rule: « les deux | agneaux », « moutons tout | au fond ».
    expect(splitChunks('Le berger savait bien que les deux agneaux dormaient déjà sous le grand chêne'))
      .toEqual(['Le berger savait bien que les deux agneaux', 'dormaient déjà sous le grand chêne']);
    expect(splitChunks('Les jeunes bergers du village voisin gardaient leurs moutons tout au fond de la vallée verte'))
      .toEqual(['Les jeunes bergers du village voisin gardaient', 'leurs moutons tout au fond de la vallée verte']);
  });

  it('when every cut is blocked, takes the one nearest the middle that splits no liaison; « les | héros » is one', () => {
    // Every word capitalised: no cut is allowed, so the least bad is taken. The middle, « Les | Enfants »,
    // is a liaison: the next nearest is taken. « Les | Héros » (h aspiré) is none, so the middle is kept.
    expect(splitChunks('Le Grand Livre De Tous Les Enfants Du Vieux Monde Entier Réunis'))
      .toEqual(['Le Grand Livre De Tous', 'Les Enfants Du Vieux Monde Entier Réunis']);
    expect(splitChunks('Le Grand Livre De Tous Les Héros Du Vieux Monde Entier Réunis'))
      .toEqual(['Le Grand Livre De Tous Les', 'Héros Du Vieux Monde Entier Réunis']);
  });

  it('pins the seed sentences whose liaison the word-count middle once split (« les | uns », « je fus | arrivé »…)', () => {
    const sentenceOf = (file: string, start: string): string =>
      splitSentences(seedBody(file)).find((s) => s.text.startsWith(start))?.text ?? `${file}: no « ${start} »`;
    expect(splitChunks(sentenceOf('003-andersen-petite-sirene.json', 'Bien loin dans la mer'))).toEqual([
      'Bien loin dans la mer,', "l'eau est bleue comme les feuilles des bluets,", 'pure comme le verre le plus transparent,',
      "mais si profonde qu'il serait inutile d'y jeter l'ancre,", "et qu'il faudrait y entasser",
      "une quantité infinie de tours d'églises", 'les unes sur les autres pour mesurer', 'la distance du fond à la surface.',
    ]);
    expect(splitChunks(sentenceOf('004-perrault-chat-botte.json', 'Le roi ordonna aussitôt'))).toEqual([
      'Le roi ordonna aussitôt', "aux officiers de sa garde-robe d'aller quérir", 'un de ses plus beaux habits',
      'pour monsieur le marquis de Carabas.',
    ]);
    expect(splitChunks(sentenceOf('025-topffer-col-anterne.json', "C'est pourquoi, dès que"))).toEqual([
      "C'est pourquoi, dès que je fus arrivé", 'dans la petite hôtellerie de Servoz,', "je m'informai de la nature des cols et passages.",
    ]);
  });

  it('splits no liaison in any seed text, at paces I and II (breath groups) or III (merged groups)', () => {
    for (const f of readdirSync('../content/seed').filter((n) => n.endsWith('.json'))) {
      const body = seedBody(f);
      for (const s of splitSentences(body)) expect(liaisonCuts(splitChunks(s.text)), f).toEqual([]);
      const long = longGroups(buildPlan(body).chunks);
      const sentences = [...new Set(long.map((c) => c.sentenceIndex))];
      for (const i of sentences) expect(liaisonCuts(long.filter((c) => c.sentenceIndex === i).map((c) => c.text)), f).toEqual([]);
    }
  });
});
