// The camp's copy rules, shared by the guards that scan the sources (registerGuard, noGuilt,
// lib/battle/lines.test.ts) and the dialogue content test (lib/dialogue/content.test.ts), which
// checks the content files those source scans never read.

/** Immersion wave (spec §1 "not a school application"): the camp's words, not the school's, the
 *  office's or the IT department's. */
export const BANNED: [RegExp, string][] = [
  [/\bfacultatif\b/i, 'admin word: say what it does instead'],
  [/\bprofils?\b/i, 'admin word: « héros » or « bouclier »'],
  [/\bHarmoS\b/, 'school system'],
  [/comme à l'école/i, 'school register'],
  // No trailing \b: after « é » (not a \w character) it would never match « Scanné ».
  [/\bscann(?:er|é|ée)(?!\p{L})/iu, 'technical word: « déchiffrer »'],
  [/\bsauvegarder\b/i, 'technical word: « poser sur l\'étagère »'],
  [/jamais joué/i, 'say « Jamais défendu »'],
  [/\bréviser\b/i, 'school register: « Te préparer »'],
  [/≈/, 'catalogue metadata'],
  [/multipliée par/i, 'mechanic-speak'],
  [/domaine public/i, 'credits live in ASSETS-LICENSES.md (Ruling W9)'],
  // Singular and plural (« Autres niveaux » became « Autres classes », controller ruling after the
  // B5 batch): « niveau 3 », « à ce niveau », a « Niveau » heading, « Autres niveaux » are not.
  [/\bniveaux?\b/i, 'school register: a medallion says the class (« Ta classe », « Autres classes »)'],
  [/\btableau des quêtes\b/i, 'one name: « Le mur des quêtes » (Ruling W13)'],
];

/** The banned words found in `text`, each with its reason. */
export const banned = (text: string): string[] => BANNED.filter(([re]) => re.test(text)).map(([re, why]) => `${re} (${why})`);

/** Plan Global Constraints (Ethics): nothing is lost and no guilt wording. Only the participles:
 *  « Il manque un mot » (a neutral hint) and « ratisser » are fine. Global: use with matchAll/match. */
export const GUILT = /(?<![\p{L}])(manquée?s?|ratée?s?|perdue?s?)(?![\p{L}])/giu;

/** The adjectives and participles that would agree with the player (« perdue » is GUILT's), in
 *  both genders: « tu es prêt » genders her as much as « tu es prête » (final review M10). */
export const AGREEING = [
  'prête',
  'sûre',
  'arrêtée',
  'piégée',
  'seule',
  'contente',
  'fatiguée',
  'prêt',
  'sûr',
  'arrêté',
  'piégé',
  'seul',
  'content',
  'fatigué',
];

// Said to the player: « tu es », « es-tu », « t'es », « te sens », « sois », « te voilà »… A bare
// word would also flag a right agreement with a feminine noun (« la dictée avancera toute seule »,
// « une seule catégorie »), so only these second-person frames count.
const YOU = String.raw`(?:tu (?:es|étais|seras|serais|sembles|semblais|parais|restes|deviens|as l[’']air)|tu n[’'](?:es|étais|as pas l[’']air)|es-tu|étais-tu|seras-tu|t[’'](?:es|étais|as l[’']air)|te (?:sens|sentais|voilà|revoilà|voici)|sois)`;
// Adverbs that may sit between the verb and the adjective (« Tu es bien prête ? », « pas toute seule »).
const FILLER = String.raw`(?:(?:si|très|bien|trop|tout|toute|déjà|enfin|encore|vraiment|pas|plus|jamais|assez)\s+)*`;

/** Rulings C7, C8: never an adjective or participle agreeing with the player, never « héros » as a
 *  vocative addressed to her. */
export const GENDERED = new RegExp(
  String.raw`(?<!\p{L})${YOU}\s+${FILLER}(?:${AGREEING.join('|')})(?!\p{L})|(^|[,!?«]\s*)(cher |jeune |petite? )?héro(s|ïne)\s*[,!]`,
  'iu',
);
